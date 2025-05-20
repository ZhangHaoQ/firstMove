from celery import Celery
import os

# 从环境变量读取 Redis URL，或者使用默认值
# 将 REDIS_URL 设置为您的 Redis 服务器地址，例如: redis://localhost:6379/0
# 如果您使用的是默认的本地 Redis 实例，则下面的配置应该可以直接工作
REDIS_BROKER_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
REDIS_BACKEND_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/1') # 使用不同的数据库作为 backend (推荐)

# 创建 Celery 应用实例
# 第一个参数是当前模块的名称 (随意命名，但最好与项目相关)，这对于自动生成任务名称很重要。
# broker 参数指定了消息中间件的 URL。
# backend 参数指定了存储任务结果的 URL。
app = Celery(
    'stock_intelligence_tasks', 
    broker=REDIS_BROKER_URL,
    backend=REDIS_BACKEND_URL,
    include=['core.celery.tasks']  # 更新为包含任务模块的正确路径
)

# Celery 配置
app.conf.update(
    task_serializer='json',         # 任务序列化方式
    result_serializer='json',       # 结果序列化方式
    accept_content=['json'],        # 可接受的内容类型
    timezone='Asia/Shanghai',       # 设置时区，建议与数据源或业务逻辑时区一致
    enable_utc=True,                # 建议启用 UTC，Celery 内部时间将使用 UTC
    # 可以添加更多配置，例如任务路由、速率限制等
)

# Celery Beat (定时任务) 配置
# 我们通常在 tasks.py 或专门的 beat 配置文件中定义具体的定时规则，
# 以便 Celery Beat 服务能够发现它们。
# 此处注释掉的示例展示了如何在 app.conf 中直接配置:
# app.conf.beat_schedule = {
#     'fetch-sina-flashes-every-60s': {
#         'task': 'tasks.fetch_sina_live_flashes_and_store', # 指向任务的完整路径
#         'schedule': 60.0, # 单位：秒
#     },
# }

if __name__ == '__main__':
    # 以下命令用于启动 Celery 服务 (在项目根目录下运行):
    # 启动 Celery Worker (处理任务):
    # celery -A core.celery_setup:app worker -l info
    # 
    # 启动 Celery Beat (定时调度器，如果 beat_schedule 在此文件或 include 的模块中配置):
    # celery -A core.celery_setup:app beat -l info -s /tmp/celerybeat-schedule # -s 指定状态文件路径
    print("Celery 应用已配置。请通过命令行启动 worker 和 beat 服务。")
    pass 