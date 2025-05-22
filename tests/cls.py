import akshare as ak
from akshare.request import make_request_with_retry_json
from akshare.utils.cons import headers
import pprint

a = ak.index_news_sentiment_scope()
print(a)

# url = "https://www.cls.cn/nodeapi/telegraphList"
# data_json = make_request_with_retry_json(url, max_retries=10, headers=headers)
# pprint.pprint(data_json)