# tasks.py
import json # Celery 任务可能直接处理JSON，或者redis_client中的辅助函数处理
from datetime import datetime, timezone
import pytz # 用于将ISO 8601时间字符串转为datetime对象，再获取时间戳
from celery import chain

from core.celery_setup import app # 导入Celery app实例
from core.redis.client import (
    redis_client, 
    SINA_LIVE_FLASHES_LAST_PROCESSED_ID_KEY,
    FLASH_DATA_PREFIX,
    SYMBOL_FLASHES_PREFIX,
    ALL_FLASHES_BY_TIME_KEY, # 导入新的 Key
    get_flash_data, # 显式导入辅助函数
    store_flash_data, # 显式导入辅助函数
    DEFAULT_EXPIRATION_SECONDS
)
from core.news_sources.sina_live_client import get_sina_live_flashes
from celery.utils.log import get_task_logger
from core.llm.interface import get_flash_analysis_from_llm, MODEL_ENDPOINT_ID # 导入 MODEL_ENDPOINT_ID

logger = get_task_logger(__name__)

# --- Celery Beat Schedule (定时任务规则) ---
# 此处定义的 schedule 会在 Celery Beat 服务启动时被加载。
# 也可以在 celery_app.py 中定义，或通过命令行参数传递给 beat 服务。
app.conf.beat_schedule = {
    'fetch-sina-flashes-every-60-seconds': {
        'task': 'app.tasks.fetch_sina_live_flashes_and_store', # 更新任务的名称
        'schedule': 60.0,  # 每 60 秒执行一次
        # 'args': (arg1, arg2), # 如果任务需要固定参数，可以在这里指定
    },
}
# Celery Beat 时区默认使用在 celery_app.py 中 app.conf.timezone 定义的时区。

@app.task(bind=True, max_retries=3, default_retry_delay=60) # 添加重试机制
def fetch_sina_live_flashes_and_store(self):
    """
    Celery 核心任务：获取新浪财经直播快讯，进行处理并存储到 Redis。
    """
    logger.info("执行 fetch_sina_live_flashes_and_store 任务")
    try:
        last_id_str = redis_client.get(SINA_LIVE_FLASHES_LAST_PROCESSED_ID_KEY)
        last_processed_api_id = int(last_id_str) if last_id_str else None
        logger.info(f"获取到的上一次处理的API ID: {last_processed_api_id}")

        new_flashes, batch_latest_api_id = get_sina_live_flashes(last_processed_id=last_processed_api_id)

        if not new_flashes and batch_latest_api_id is not None and \
           ((last_processed_api_id is None) or (batch_latest_api_id > last_processed_api_id)):
            redis_client.set(SINA_LIVE_FLASHES_LAST_PROCESSED_ID_KEY, str(batch_latest_api_id))
            logger.info(f"没有新的快讯内容被处理，但已根据API响应更新 last_processed_api_id 为 {batch_latest_api_id}")
            return "没有新的快讯内容，但API的最新ID已更新。"
        
        if not new_flashes:
            logger.info("没有新的快讯需要处理。")
            if batch_latest_api_id is not None and \
               ((last_processed_api_id is None) or (batch_latest_api_id > last_processed_api_id)):
                 redis_client.set(SINA_LIVE_FLASHES_LAST_PROCESSED_ID_KEY, str(batch_latest_api_id))
                 logger.info(f"再次确认：没有新的快讯内容，但已根据API响应更新 last_processed_api_id 为 {batch_latest_api_id}")
            return "没有新的快讯需要处理。"

        processed_count = 0
        actual_new_latest_api_id = last_processed_api_id
        tasks_to_chain = []

        with redis_client.pipeline() as pipe:
            for flash_item in new_flashes: # new_flashes 是已经转换和筛选过的标准格式列表
                flash_id_str = flash_item.get("flash_id")
                if not flash_id_str:
                    logger.warning(f"跳过一个没有flash_id的快讯项: {flash_item.get('content', '')[:50]}...")
                    continue
                
                # 存储快讯数据
                store_flash_data(flash_id_str, flash_item, pipeline=pipe, expiration_seconds=DEFAULT_EXPIRATION_SECONDS)

                # 将 flash_id 添加到全局按时间排序的 Sorted Set
                try:
                    publish_ts_str = flash_item.get("publish_timestamp_utc")
                    if publish_ts_str:
                        # 转换ISO格式时间字符串为 Unix 时间戳 (float)
                        # 移除末尾的 'Z' (如果存在)，因为 fromisoformat 不直接处理它，但通常表示UTC
                        if publish_ts_str.endswith('Z'):
                            publish_ts_str = publish_ts_str[:-1]
                        dt_object = datetime.fromisoformat(publish_ts_str).replace(tzinfo=timezone.utc)
                        publish_timestamp = dt_object.timestamp()
                        pipe.zadd(ALL_FLASHES_BY_TIME_KEY, {flash_id_str: publish_timestamp})
                    else:
                        logger.warning(f"快讯 {flash_id_str} 缺少 publish_timestamp_utc，无法添加到 {ALL_FLASHES_BY_TIME_KEY}")
                except ValueError as ve:
                    logger.error(f"无法将 publish_timestamp_utc '{publish_ts_str}' 转换为时间戳 (快讯ID: {flash_id_str}): {ve}")
                except Exception as e:
                    logger.error(f"为快讯 {flash_id_str} 添加到 {ALL_FLASHES_BY_TIME_KEY} 时发生未知错误: {e}")

                # 为关联股票创建/更新 Sorted Set 索引
                if flash_item.get("associated_symbols"):
                    for symbol_info in flash_item["associated_symbols"]:
                        symbol_code = symbol_info.get("symbol")
                        if symbol_code:
                            symbol_key = f"{SYMBOL_FLASHES_PREFIX}{symbol_code}"
                            # 使用快讯的发布时间戳作为 score
                            if 'publish_timestamp' in locals(): # 确保 publish_timestamp 已成功转换
                                pipe.zadd(symbol_key, {flash_id_str: publish_timestamp})
                            else: # Fallback or log error if timestamp wasn't available for ALL_FLASHES_BY_TIME_KEY
                                logger.warning(f"快讯 {flash_id_str} 因缺少有效时间戳，未添加到股票索引 {symbol_key}")
                
                # 准备LLM分析任务链
                tasks_to_chain.append(analyze_flash_with_llm_task.s(flash_id_str))
                
                processed_count += 1
                current_api_id = flash_item.get("raw_api_response_item", {}).get("id")
                if current_api_id:
                    if actual_new_latest_api_id is None or current_api_id > actual_new_latest_api_id:
                        actual_new_latest_api_id = current_api_id
            
            # 更新 SINA_LIVE_FLASHES_LAST_PROCESSED_ID_KEY
            # 使用本次处理的快讯中最大的API ID，或者API直接返回的批次最新ID（如果前者不可用或后者更大）
            final_id_to_store = actual_new_latest_api_id
            if batch_latest_api_id is not None:
                if final_id_to_store is None or batch_latest_api_id > final_id_to_store:
                    final_id_to_store = batch_latest_api_id
            
            if final_id_to_store is not None:
                 pipe.set(SINA_LIVE_FLASHES_LAST_PROCESSED_ID_KEY, str(final_id_to_store))
            
            pipe.execute()

        if tasks_to_chain:
            # 使用 Celery chain 确保按顺序执行（如果需要，但这里每个任务独立，直接并发也可以）
            # 为了简单起见，我们让它们并发执行，因为它们是独立的分析任务
            for task_signature in tasks_to_chain:
                task_signature.delay()
            logger.info(f"成功处理并存储了 {processed_count} 条新快讯，并为它们创建了LLM分析任务。最新的API ID更新为: {final_id_to_store}")
        else:
            logger.info(f"处理了 {processed_count} 条快讯，但没有新的LLM任务需要触发。最新的API ID更新为: {final_id_to_store}")
            
        return f"成功处理 {processed_count} 条新快讯。最新API ID: {final_id_to_store}"

    except Exception as e:
        logger.error(f"严重错误：Celery 任务 fetch_sina_live_flashes_and_store 执行失败: {e}", exc_info=True)
        # 使用 self.retry() 来利用Celery的重试机制
        try:
            raise self.retry(exc=e, countdown=60) # 60秒后重试
        except self.MaxRetriesExceededError:
            logger.critical(f"任务 fetch_sina_live_flashes_and_store 达到最大重试次数，放弃执行。错误: {e}")
            return f"任务失败且达到最大重试次数: {e}"

@app.task(bind=True, max_retries=2, default_retry_delay=30)
def analyze_flash_with_llm_task(self, flash_id: str):
    """
    Celery 任务，用于对单个财经快讯进行LLM分析并存储结果。
    """
    try:
        logger.info(f"[LLM分析任务] 开始分析快讯ID: {flash_id}")
        flash_data = get_flash_data(flash_id)

        if not flash_data:
            logger.error(f"[LLM分析任务] 无法从Redis获取快讯ID: {flash_id} 的数据。任务终止。")
            return f"错误：无法获取快讯 {flash_id} 数据"
        
        content_to_analyze = flash_data.get("content")
        if not content_to_analyze:
            logger.warning(f"[LLM分析任务] 快讯ID: {flash_id} 内容为空，无法进行LLM分析。")
            flash_data["llm_analysis"] = {
                "success": False,
                "error": "快讯内容为空",
                "summary": None, "sentiment": None, "analysis_type": "general_news_no_analysis",
                "stock_specific_analysis": None, "macro_analysis": None,
                "llm_model_used": MODEL_ENDPOINT_ID
            }
            store_flash_data(flash_id, flash_data, expiration_seconds=DEFAULT_EXPIRATION_SECONDS)
            return "快讯内容为空，已标记。"

        # 获取关联股票信息传递给LLM接口
        associated_symbols_for_llm = flash_data.get("associated_symbols", []) # 默认为空列表

        logger.info(f"[LLM分析任务] 准备调用LLM分析快讯ID: {flash_id}，关联股票数: {len(associated_symbols_for_llm)}")
        analysis_result = get_flash_analysis_from_llm(content_to_analyze, target_symbols=associated_symbols_for_llm)
        logger.info(f"[LLM分析任务] 快讯ID: {flash_id} LLM分析原始结果: {analysis_result}")

        # 将LLM分析结果（整个字典）存入原快讯数据的 llm_analysis 字段
        flash_data["llm_analysis"] = {
            **analysis_result, 
            "llm_model_used": MODEL_ENDPOINT_ID, # 记录实际使用的模型
            "analysis_timestamp_utc": datetime.now(timezone.utc).isoformat() # 记录分析时间
        }

        store_flash_data(flash_id, flash_data, expiration_seconds=DEFAULT_EXPIRATION_SECONDS)
        
        if analysis_result.get("success"):
            logger.info(f"[LLM分析任务] 快讯ID: {flash_id} 分析完成并成功存储。摘要: {analysis_result.get('summary')}, 类型: {analysis_result.get('analysis_type')}")
        else:
            logger.error(f"[LLM分析任务] 快讯ID: {flash_id} LLM分析失败或返回错误。错误: {analysis_result.get('error')}")
        
        # Publish the new/updated flash data to a Redis channel (No longer needed for polling)
        # /* Commenting out Redis publish for SSE
        # try:
        #     flash_data_json_to_publish = json.dumps(flash_data, ensure_ascii=False)
        #     logger.info(f"[LLM分析任务 DEBUG] 准备发布到 'new_flashes_channel' 的数据 (flash_id: {flash_id}): {flash_data_json_to_publish[:500]}...") # Log first 500 chars
        # except Exception as json_e:
        #     logger.error(f"[LLM分析任务 DEBUG] 序列化 flash_data (flash_id: {flash_id}) 到 JSON 失败: {json_e}")
        #     flash_data_json_to_publish = None 
        # 
        # if flash_data_json_to_publish:
        #     publish_count = redis_client.publish('new_flashes_channel', flash_data_json_to_publish)
        #     logger.info(f"[LLM分析任务] 已将快讯 (flash_id: {flash_id}) 发布到频道 'new_flashes_channel'。接收者数量: {publish_count}.")
        # else:
        #     logger.warning(f"[LLM分析任务] 由于JSON序列化失败，未发布快讯 (flash_id: {flash_id}) 到 'new_flashes_channel'。")
        # */
        
        return f"快讯 {flash_id} LLM分析处理完毕。"
            
    except Exception as e:
        logger.error(f"[LLM分析任务] 处理快讯ID {flash_id} 时发生意外错误: {e}", exc_info=True)
        try:
            raise self.retry(exc=e, countdown=30)
        except self.MaxRetriesExceededError:
            logger.critical(f"任务 analyze_flash_with_llm_task ({flash_id}) 达到最大重试次数，放弃执行。错误: {e}")
            # 即使LLM分析失败，也尝试更新Redis中的记录，标记错误
            try:
                flash_data_on_error = get_flash_data(flash_id)
                if flash_data_on_error:
                    flash_data_on_error["llm_analysis"] = {
                        "success": False,
                        "error": f"LLM任务达到最大重试次数: {str(e)}",
                        "summary": None, "sentiment": None, "analysis_type": None,
                        "stock_specific_analysis": None, "macro_analysis": None,
                        "llm_model_used": MODEL_ENDPOINT_ID,
                        "analysis_timestamp_utc": datetime.now(timezone.utc).isoformat()
                    }
                    store_flash_data(flash_id, flash_data_on_error, expiration_seconds=DEFAULT_EXPIRATION_SECONDS)
                    logger.info(f"已为快讯 {flash_id} 标记LLM分析失败（重试耗尽）。")
            except Exception as inner_e:
                logger.error(f"在LLM任务 ({flash_id}) 重试耗尽后尝试标记错误时再次失败: {inner_e}")
            return f"LLM分析任务 {flash_id} 失败且达到最大重试次数。"

# 如果您想直接运行此脚本来测试任务逻辑 (不通过 Celery worker，而是作为普通 Python 脚本)：
if __name__ == '__main__':
    print("开始直接调用 fetch_sina_live_flashes_and_store 任务进行测试...")
    # 注意：直接调用不会经过 Celery 的消息队列和 worker 执行机制。
    #      这种方式主要用于调试任务内部逻辑。请确保 Redis 服务正在运行。
    result = fetch_sina_live_flashes_and_store()
    print(f"测试调用结果: {result}") 