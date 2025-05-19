# news_sources/sina_live_client.py

import requests
import json
from datetime import datetime
import pytz # 用于时区处理

# API 常量
SINA_LIVE_API_URL = "https://zhibo.sina.com.cn/api/zhibo/feed"
ZHIBO_ID = 152  # 根据示例 URL
API_TYPE = 1    # 根据示例 URL
DEFAULT_PAGE_SIZE = 50 # 默认的每页条目数，一个合理的默认值

# 定义中国标准时间 (CST) 时区
CST = pytz.timezone('Asia/Shanghai')

def get_sina_live_flashes(
    last_processed_id: int | None = None,
    page_size: int = DEFAULT_PAGE_SIZE
) -> tuple[list[dict], int | None]:
    """
    从新浪财经直播API获取最新的财经快讯。

    参数:
        last_processed_id (int | None): 上次成功处理的最新一条快讯的 ID。
                                        如果为 None，则获取所有能获取到的最新快讯。
        page_size (int): 每次API调用希望获取的条目数。

    返回:
        tuple[list[dict], int | None]:
            - list[dict]: 包含新的、标准化快讯数据字典的列表 (按发布时间从旧到新排序)。
            - int | None: 本次 API 调用返回的原始数据中最新的快讯 ID。
                          如果没有从API获取到任何条目，则返回 None。
    """
    params = {
        "page": 1, # 始终获取第一页，因为它包含最新的条目
        "page_size": page_size,
        "zhibo_id": ZHIBO_ID,
        "type": API_TYPE,
    }

    new_flashes_processed = []
    batch_latest_id: int | None = None

    try:
        response = requests.get(SINA_LIVE_API_URL, params=params, timeout=10) # 10 秒超时
        response.raise_for_status()  # 如果返回状态码为 4XX 或 5XX，则抛出 HTTPError
        api_data = response.json()

        if not api_data or api_data.get("result", {}).get("status", {}).get("code") != 0:
            print(f"新浪财经直播 API 返回错误或非预期数据: {api_data.get('result', {}).get('status', {})}")
            return [], None

        feed_list = api_data.get("result", {}).get("data", {}).get("feed", {}).get("list", [])
        if not feed_list:
            print("新浪财经直播 API：未找到任何快讯条目。")
            return [], None

        # feed_list 中的第一项是此批次中来自 API 的最新条目
        batch_latest_id = int(feed_list[0].get("id"))

        # 反向迭代以首先处理较旧的条目，这样我们可以按时间顺序附加它们
        for item in reversed(feed_list):
            current_item_id = int(item.get("id"))

            if last_processed_id is not None and current_item_id <= last_processed_id:
                continue # 跳过已处理的条目

            try:
                # 1. 内容 (rich_text 通常已被 response.json() 解码)
                content = item.get("rich_text", "")

                # 2. 发布时间戳 (将 CST 转换为 UTC ISO 8601 格式)
                create_time_str = item.get("create_time") # 例如: "2025-05-14 16:33:56"
                publish_timestamp_utc_str = None
                if create_time_str:
                    dt_cst = datetime.strptime(create_time_str, "%Y-%m-%d %H:%M:%S")
                    dt_aware_cst = CST.localize(dt_cst)
                    dt_utc = dt_aware_cst.astimezone(pytz.utc)
                    publish_timestamp_utc_str = dt_utc.isoformat(timespec='seconds').replace('+00:00', 'Z')

                # 3. 抓取时间戳
                crawl_timestamp_utc_str = datetime.now(pytz.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')

                # 4. 标签
                tags = [tag.get("name") for tag in item.get("tag", []) if tag.get("name")]

                # 5. 从 'ext' 字段获取关联股票和详情链接
                associated_symbols = []
                detail_url = item.get("docurl") # 如果 ext 中没有，则回退到顶层的 docurl

                ext_str = item.get("ext")
                if ext_str:
                    try:
                        ext_data = json.loads(ext_str) # 'ext' 本身是一个 JSON 字符串
                        if isinstance(ext_data.get("stocks"), list):
                            for stock_info in ext_data["stocks"]:
                                market = stock_info.get("market")
                                symbol_raw = stock_info.get("symbol")
                                name = stock_info.get("key") # 公司名称/标识
                                if market and symbol_raw:
                                    # 标准化股票代码: 例如 sz002651 -> SZ002651
                                    std_symbol = symbol_raw.upper()
                                    associated_symbols.append({
                                        "market": market,
                                        "symbol": std_symbol,
                                        "name": name
                                    })
                        # 如果 ext 中有 docurl，优先使用它
                        if ext_data.get("docurl"):
                             detail_url = ext_data.get("docurl")
                    except json.JSONDecodeError as je:
                        print(f"处理快讯条目 ID {current_item_id} 时解析 ext 字段失败: {je}。ext 内容: '{ext_str[:100]}'...")
                        # ext字段解析失败不应阻止整个条目的处理，除非关键信息依赖它
                        # 这里我们选择继续，associated_symbols 可能为空，detail_url 可能为顶层URL

                standardized_flash = {
                    "flash_id": f"sina_live_{current_item_id}",
                    "content": content,
                    "publish_timestamp_utc": publish_timestamp_utc_str,
                    "crawl_timestamp_utc": crawl_timestamp_utc_str,
                    "source_name": "SinaLiveFlashes",
                    "source_api_url": SINA_LIVE_API_URL + f"?zhibo_id={ZHIBO_ID}&type={API_TYPE}",
                    "tags": tags,
                    "associated_symbols": associated_symbols,
                    "detail_url": detail_url,
                    "raw_api_response_item": item # 用于调试或未来使用
                }
                new_flashes_processed.append(standardized_flash)

            except Exception as e:
                print(f"处理新浪财经直播 API 条目 ID {current_item_id} 时发生错误: {e}")
                # 可选: 如果此条目非常关键，可以考虑将其记录下来以供稍后检查
                continue # 继续处理下一个条目

        return new_flashes_processed, batch_latest_id

    except requests.exceptions.RequestException as e:
        print(f"从新浪财经直播 API 获取数据时发生网络请求错误: {e}")
        return [], None 
    except json.JSONDecodeError as e:
        print(f"从新浪财经直播 API 解码 JSON 数据时发生错误: {e}")
        return [], None 
    except Exception as e: # 捕获任何其他意外错误
        print(f"在 get_sina_live_flashes 函数中发生未知错误: {e}")
        return [], None


if __name__ == '__main__':
    # 示例用法:
    print("首次运行，获取所有最近的快讯:")
    # 为测试确保 page_size 较小，以防快讯源更新不频繁
    news_list, latest_id = get_sina_live_flashes(page_size=10) 
    if news_list:
        print(f"获取到 {len(news_list)} 条新快讯。此批次最新 ID: {latest_id}")
        for news_item in news_list:
            print(f"  ID: {news_item['flash_id']}, 时间: {news_item['publish_timestamp_utc']}, 内容: {news_item['content'][:50]}...")
            if news_item['associated_symbols']:
                print(f"    关联股票: {news_item['associated_symbols']}")

        print(f"\n模拟下次运行，使用本批次最新 ID: {latest_id}")
        # 在实际场景中，应存储并使用 *成功处理的* 快讯中的 latest_id (或 batch_latest_id)。
        
        test_last_processed_id = latest_id # 使用本批次API返回的最新ID进行下一次调用
                                            # 如果立即运行，理想情况下应返回0条新快讯。
        
        if test_last_processed_id is not None:
            news_list_update, latest_id_update = get_sina_live_flashes(last_processed_id=test_last_processed_id, page_size=10)
            print(f"使用 last_id {test_last_processed_id} 获取到 {len(news_list_update)} 条更新快讯。此批次最新 ID: {latest_id_update}")
            if not news_list_update:
                print("  符合预期，如果立即运行，则没有获取到新的快讯。")
            for news_item_u in news_list_update:
                    print(f"  ID: {news_item_u['flash_id']}, 时间: {news_item_u['publish_timestamp_utc']}, 内容: {news_item_u['content'][:50]}...")
        else:
            print("首次运行未获取到 latest_id，无法测试增量更新。")

    else:
        print("首次运行未获取到任何快讯条目。") 