# core/redis_client.py
import redis
import redis.asyncio as aioredis # Import for asyncio client
import os
import json # 主要用于 Celery 任务中序列化/反序列化数据，或直接存储复杂对象

# 从环境变量读取 Redis URL，或者使用默认值
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

# Synchronous client (for Celery tasks and potentially other sync code)
redis_client = redis.StrictRedis.from_url(REDIS_URL, decode_responses=True)

# Asynchronous client (for FastAPI and other asyncio code)
async_redis_client = aioredis.StrictRedis.from_url(REDIS_URL, decode_responses=True)

# --- Redis Key 常量定义 ---
# 将所有 Redis key 的前缀或模式统一定义为常量，方便管理和避免在代码中硬编码字符串。

# 用于存储上次成功处理的新浪财经直播快讯的最新 ID
SINA_LIVE_FLASHES_LAST_PROCESSED_ID_KEY = "sina_live_flashes:last_processed_id"

# 单条快讯数据的 Key 前缀 (后跟 flash_id)
# 例如: flash:sina_live_12345
FLASH_DATA_PREFIX = "flash:"

# 按股票代码索引快讯 ID 的 Sorted Set Key 前缀 (后跟 symbol_code)
# 例如: symbol_flashes:SZ000001
# Score: 快讯的发布时间戳 (Unix timestamp), Member: 快讯的 ID (例如 sina_live_12345)
SYMBOL_FLASHES_PREFIX = "symbol_flashes:"

# 全局快讯ID列表 (Sorted Set)，member: <flash_id>, score: publish_timestamp
ALL_FLASHES_BY_TIME_KEY = "all_flashes_by_time"

# 默认过期时间（例如7天）
DEFAULT_EXPIRATION_SECONDS = 7 * 24 * 60 * 60

# --- 辅助函数 --- 
def store_flash_data(key_suffix: str, data_to_store: dict, pipeline=None, expiration_seconds: int = DEFAULT_EXPIRATION_SECONDS) -> bool:
    """
    将字典数据存储到 Redis 中，键的格式为 'flash:<key_suffix>'。
    数据会序列化为 JSON 字符串，并确保中文字符正确显示。
    可以选择性地使用传入的 pipeline 对象。默认过期时间由 DEFAULT_EXPIRATION_SECONDS 定义。

    参数:
        key_suffix (str): 用于构成 Redis 键的后缀部分 (例如快讯的 ID)。
        data_to_store (dict): 需要存储的字典数据。
        pipeline (redis.client.Pipeline | None): Redis pipeline 对象，如果提供，则命令将通过 pipeline 执行。
        expiration_seconds (int): 键的过期时间（秒）。

    返回:
        bool: 如果操作成功则返回 True，否则返回 False。
    """
    redis_key = f"{FLASH_DATA_PREFIX}{key_suffix}"
    try:
        # 确保中文字符按原样存储，而不是ASCII转义
        json_data = json.dumps(data_to_store, ensure_ascii=False)
        target_client = pipeline if pipeline else redis_client
        target_client.set(redis_key, json_data, ex=expiration_seconds)
        return True
    except redis.RedisError as e:
        print(f"Redis 存储错误 (key: {redis_key}): {e}")
        return False
    except TypeError as e:
        print(f"JSON 序列化错误 (key: {redis_key}): {e}")
        return False

def get_flash_data(key_suffix: str) -> dict | None:
    """
    从 Redis 中获取指定键的快讯数据（JSON字符串）并反序列化为字典。

    参数:
        key_suffix (str): 用于构成 Redis 键的后缀部分 (例如快讯的 ID)。

    返回:
        dict | None: 如果键存在且数据有效，则返回反序列化后的字典，否则返回 None。
    """
    redis_key = f"{FLASH_DATA_PREFIX}{key_suffix}"
    try:
        json_data = redis_client.get(redis_key)
        if json_data:
            return json.loads(json_data)
        return None
    except redis.RedisError as e:
        print(f"Redis 读取错误 (key: {redis_key}): {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"JSON 反序列化错误 (key: {redis_key}): {e}. Data: {json_data[:200] if json_data else 'None'}") # 打印部分数据帮助调试
        return None

# --- Async helper example (if needed by FastAPI for general gets/sets) ---
# async def get_flash_data_async(key_suffix: str) -> dict | None:
#     redis_key = f"{FLASH_DATA_PREFIX}{key_suffix}"
#     try:
#         json_data = await async_redis_client.get(redis_key)
#         if json_data:
#             return json.loads(json_data)
#         return None
#     except aioredis.RedisError as e:
#         print(f"Async Redis 读取错误 (key: {redis_key}): {e}")
#         return None
#     except json.JSONDecodeError as e:
#         print(f"JSON 反序列化错误 (key: {redis_key}): {e}. Data: {json_data[:200] if json_data else 'None'}")
#         return None

if __name__ == '__main__':
    # Test synchronous client
    try:
        if redis_client.ping():
            print("成功连接到 Redis (同步客户端)！")
            
            # 示例：设置和获取 last_processed_id
            test_last_id_key = "test:last_id"
            redis_client.set(test_last_id_key, "98765")
            last_id = redis_client.get(test_last_id_key)
            print(f"测试获取的 last_id: {last_id}")
            redis_client.delete(test_last_id_key) # 清理测试数据
            
            # 示例：存储和获取快讯
            sample_flash_id = "test_flash_001"
            sample_flash_data = {
                "flash_id": sample_flash_id, 
                "content": "这是一条测试快讯内容。", 
                "publish_timestamp_utc": "2024-01-01T12:00:00Z",
                "associated_symbols": [{"symbol": "SZ000001", "name": "平安银行"}]
            }
            # 注意测试 store_flash_data 时使用新的参数顺序
            if store_flash_data(sample_flash_id, sample_flash_data):
                print(f"已存储测试快讯: {sample_flash_id}")
                retrieved_flash = get_flash_data(sample_flash_id)
                print(f"获取到的测试快讯: {retrieved_flash}")
                redis_client.delete(f"{FLASH_DATA_PREFIX}{sample_flash_id}") # 清理测试数据
            else:
                print(f"存储测试快讯 {sample_flash_id} 失败。")

            # 测试新的 Sorted Set (模拟)
            print(f"\n测试 Sorted Set {ALL_FLASHES_BY_TIME_KEY} (模拟添加)... ")
            import time
            current_ts = int(time.time())
            # 模拟添加到 Sorted Set
            added_count = redis_client.zadd(ALL_FLASHES_BY_TIME_KEY, {sample_flash_id: current_ts})
            if added_count == 1:
                print(f"成功将 {sample_flash_id} 添加到 {ALL_FLASHES_BY_TIME_KEY}，score 为 {current_ts}")
                
                # 验证获取
                latest_ids = redis_client.zrevrange(ALL_FLASHES_BY_TIME_KEY, 0, 0) # 获取最新的一个
                if latest_ids and latest_ids[0] == sample_flash_id:
                    print(f"成功从 {ALL_FLASHES_BY_TIME_KEY} 获取到最新的ID: {latest_ids[0]}")
                else:
                    print(f"从 {ALL_FLASHES_BY_TIME_KEY} 获取最新ID失败或不匹配。获取到: {latest_ids}")
                
                # 清理测试数据
                redis_client.delete(f"{FLASH_DATA_PREFIX}{sample_flash_id}")
                redis_client.zrem(ALL_FLASHES_BY_TIME_KEY, sample_flash_id)
                print(f"已清理测试键 flash:{sample_flash_id} 和 {ALL_FLASHES_BY_TIME_KEY} 中的条目。")
            else:
                print(f"添加到 {ALL_FLASHES_BY_TIME_KEY} 失败。")
        else:
            print("无法连接到 Redis (同步客户端)。")
    except redis.exceptions.ConnectionError as e:
        print(f"同步 Redis 连接错误: {e}")

    # Test asynchronous client
    async def test_async():
        try:
            if await async_redis_client.ping():
                print("成功连接到 Redis (异步客户端)！")
                
                # Example: Set and get with async client
                await async_redis_client.set("my_async_key", "async_value")
                val = await async_redis_client.get("my_async_key")
                print(f"Async get: my_async_key = {val}")
                await async_redis_client.delete("my_async_key")
            else:
                print("无法连接到 Redis (异步客户端)。")
        except aioredis.exceptions.ConnectionError as e:
            print(f"异步 Redis 连接错误: {e}")
        finally:
            # Gracefully close the async client connection pool when done testing
            await async_redis_client.close()
            # Note: In a FastAPI app, you'd typically manage the lifecycle with startup/shutdown events.

    import asyncio
    print("\n开始测试异步客户端...")
    asyncio.run(test_async()) 