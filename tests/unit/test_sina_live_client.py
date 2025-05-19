import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime
import pytz
import json
import requests

from core.news_sources.sina_live_client import get_sina_live_flashes, CST

class TestGetSinaLiveFlashes(unittest.TestCase):

    def _generate_mock_api_item(self, item_id, create_time_str, content, stocks_data=None, docurl_in_ext=None):
        """Helper to generate a single feed item for the mock API response."""
        item = {
            "id": item_id,
            "zhibo_id": 152,
            "type": 0,
            "rich_text": content,
            "create_time": create_time_str, # CST
            "update_time": create_time_str,
            "tag": [{"id": "3", "name": "公司"}],
            "docurl": f"https://finance.sina.com.cn/top_level_doc_{item_id}.shtml"
        }
        ext_dict = {}
        if stocks_data:
            ext_dict["stocks"] = stocks_data
        if docurl_in_ext:
            ext_dict["docurl"] = docurl_in_ext
        
        if ext_dict:
            item["ext"] = json.dumps(ext_dict)
        else:
            item["ext"] = json.dumps({}) # Ensure ext is always a JSON string

        return item

    @patch('core.news_sources.sina_live_client.requests.get')
    def test_fetch_new_flashes_success(self, mock_requests_get):
        # --- Mock API Response ---
        mock_response = MagicMock()
        mock_response.status_code = 200
        
        item1_id = 4194230
        item1_time_str = "2025-05-15 10:00:00" # CST
        item1_content = "【快讯1】新内容"
        item1_stocks = [{"market": "cn", "symbol": "sz000001", "key": "平安银行"}]
        
        item2_id = 4194229
        item2_time_str = "2025-05-15 09:59:00" # CST
        item2_content = "【快讯2】旧一点的内容"
        item2_docurl_ext = f"https://finance.sina.com.cn/ext_doc_{item2_id}.shtml"


        api_data = {
            "result": {
                "status": {"code": 0, "msg": "OK"},
                "data": {
                    "feed": {
                        "list": [
                            self._generate_mock_api_item(item1_id, item1_time_str, item1_content, stocks_data=item1_stocks),
                            self._generate_mock_api_item(item2_id, item2_time_str, item2_content, docurl_in_ext=item2_docurl_ext),
                        ]
                    }
                }
            }
        }
        mock_response.json.return_value = api_data
        mock_requests_get.return_value = mock_response

        # --- Call the function ---
        # last_processed_id is None, so both items should be new
        flashes, batch_latest_id = get_sina_live_flashes(last_processed_id=None, page_size=10)

        # --- Assertions ---
        mock_requests_get.assert_called_once()
        self.assertEqual(len(flashes), 2)
        self.assertEqual(batch_latest_id, item1_id)

        # Flashes should be sorted: oldest first
        flash_old, flash_new = flashes[0], flashes[1]

        # Check flash_old (item2)
        self.assertEqual(flash_old["flash_id"], f"sina_live_{item2_id}")
        self.assertEqual(flash_old["content"], item2_content)
        # Convert expected time to UTC
        dt_cst_item2 = CST.localize(datetime.strptime(item2_time_str, "%Y-%m-%d %H:%M:%S"))
        dt_utc_item2 = dt_cst_item2.astimezone(pytz.utc)
        self.assertEqual(flash_old["publish_timestamp_utc"], dt_utc_item2.isoformat(timespec='seconds').replace('+00:00', 'Z'))
        self.assertTrue(isinstance(flash_old["crawl_timestamp_utc"], str))
        self.assertEqual(flash_old["source_name"], "SinaLiveFlashes")
        self.assertEqual(flash_old["tags"], ["公司"])
        self.assertEqual(len(flash_old["associated_symbols"]), 0) # item2 had no stocks in this setup
        self.assertEqual(flash_old["detail_url"], item2_docurl_ext) # Should pick from ext

        # Check flash_new (item1)
        self.assertEqual(flash_new["flash_id"], f"sina_live_{item1_id}")
        self.assertEqual(flash_new["content"], item1_content)
        dt_cst_item1 = CST.localize(datetime.strptime(item1_time_str, "%Y-%m-%d %H:%M:%S"))
        dt_utc_item1 = dt_cst_item1.astimezone(pytz.utc)
        self.assertEqual(flash_new["publish_timestamp_utc"], dt_utc_item1.isoformat(timespec='seconds').replace('+00:00', 'Z'))
        self.assertEqual(len(flash_new["associated_symbols"]), 1)
        self.assertEqual(flash_new["associated_symbols"][0]["symbol"], "SZ000001") # Note: standardized to upper
        self.assertEqual(flash_new["associated_symbols"][0]["name"], "平安银行")
        self.assertEqual(flash_new["detail_url"], f"https://finance.sina.com.cn/top_level_doc_{item1_id}.shtml") # No ext docurl

        # Check raw API item is included
        self.assertIn("raw_api_response_item", flash_new)
        self.assertEqual(flash_new["raw_api_response_item"]["id"], item1_id)

    @patch('core.news_sources.sina_live_client.requests.get')
    def test_no_new_flashes_due_to_last_id(self, mock_requests_get):
        # --- Mock API Response (similar to success, but all items will be "old") ---
        mock_response = MagicMock()
        mock_response.status_code = 200
        
        item1_id = 4194230
        item1_time_str = "2025-05-15 10:00:00" 
        item1_content = "【快讯1】新内容"
        
        item2_id = 4194229
        item2_time_str = "2025-05-15 09:59:00"
        item2_content = "【快讯2】旧一点的内容"

        api_data = {
            "result": {
                "status": {"code": 0, "msg": "OK"},
                "data": {
                    "feed": {
                        "list": [
                            self._generate_mock_api_item(item1_id, item1_time_str, item1_content),
                            self._generate_mock_api_item(item2_id, item2_time_str, item2_content),
                        ]
                    }
                }
            }
        }
        mock_response.json.return_value = api_data
        mock_requests_get.return_value = mock_response

        # --- Call the function ---
        # last_processed_id is item1_id, so both items should be skipped
        flashes, batch_latest_id = get_sina_live_flashes(last_processed_id=item1_id, page_size=10)

        # --- Assertions ---
        mock_requests_get.assert_called_once() # API should still be called
        self.assertEqual(len(flashes), 0)       # No new flashes should be processed
        self.assertEqual(batch_latest_id, item1_id) # batch_latest_id should still be the latest from API

        # Test with last_processed_id greater than any ID in the feed
        flashes_v2, batch_latest_id_v2 = get_sina_live_flashes(last_processed_id=item1_id + 100, page_size=10)
        self.assertEqual(len(flashes_v2), 0)
        self.assertEqual(batch_latest_id_v2, item1_id)

    @patch('core.news_sources.sina_live_client.requests.get')
    def test_api_returns_empty_feed_list(self, mock_requests_get):
        """Test the case where the API returns a success code but an empty feed list."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        api_data = {
            "result": {
                "status": {"code": 0, "msg": "OK"},
                "data": {
                    "feed": {
                        "list": [] # Empty list
                    }
                }
            }
        }
        mock_response.json.return_value = api_data
        mock_requests_get.return_value = mock_response

        flashes, batch_latest_id = get_sina_live_flashes()

        mock_requests_get.assert_called_once()
        self.assertEqual(len(flashes), 0)
        self.assertIsNone(batch_latest_id) # No items, so no latest ID

    @patch('core.news_sources.sina_live_client.requests.get')
    def test_api_returns_error_code(self, mock_requests_get):
        """Test the case where the API result status code is not 0."""
        mock_response = MagicMock()
        mock_response.status_code = 200 # HTTP request itself is successful
        api_data = {
            "result": {
                "status": {"code": -1, "msg": "Error from API"}, # API level error
                "data": {}
            }
        }
        mock_response.json.return_value = api_data
        mock_requests_get.return_value = mock_response

        flashes, batch_latest_id = get_sina_live_flashes()

        mock_requests_get.assert_called_once()
        self.assertEqual(len(flashes), 0)
        self.assertIsNone(batch_latest_id)

    @patch('core.news_sources.sina_live_client.requests.get')
    def test_api_returns_malformed_json(self, mock_requests_get):
        """Test the case where the API returns a non-JSON response or malformed JSON."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        # Simulate json.JSONDecodeError by having .json() raise it
        mock_response.json.side_effect = json.JSONDecodeError("mock error", "doc", 0)
        mock_requests_get.return_value = mock_response

        flashes, batch_latest_id = get_sina_live_flashes()

        mock_requests_get.assert_called_once()
        self.assertEqual(len(flashes), 0)
        self.assertIsNone(batch_latest_id)

    @patch('core.news_sources.sina_live_client.requests.get')
    def test_requests_exception(self, mock_requests_get):
        """Test the case where requests.get raises an exception (e.g., network error)."""
        # Configure the mock to raise RequestException when called
        mock_requests_get.side_effect = requests.exceptions.RequestException("mock network error")

        flashes, batch_latest_id = get_sina_live_flashes()

        mock_requests_get.assert_called_once()
        self.assertEqual(len(flashes), 0)
        self.assertIsNone(batch_latest_id)

    @patch('core.news_sources.sina_live_client.requests.get')
    def test_item_processing_exception(self, mock_requests_get):
        """Test that an exception during single item processing doesn't stop others."""
        mock_response = MagicMock()
        mock_response.status_code = 200

        item1_id = 4194230
        item1_time_str = "2025-05-15 10:00:00"
        item1_content = "【快讯1】正常内容"

        # This item will cause a processing error due to malformed time
        item_malformed_id = 4194229 
        item_malformed_time_str = "INVALID-TIME-FORMAT"
        item_malformed_content = "【快讯2】时间格式错误"

        item3_id = 4194228
        item3_time_str = "2025-05-15 09:58:00"
        item3_content = "【快讯3】另一条正常内容"

        api_data = {
            "result": {
                "status": {"code": 0, "msg": "OK"},
                "data": {
                    "feed": {
                        "list": [
                            self._generate_mock_api_item(item1_id, item1_time_str, item1_content),
                            self._generate_mock_api_item(item_malformed_id, item_malformed_time_str, item_malformed_content),
                            self._generate_mock_api_item(item3_id, item3_time_str, item3_content),
                        ]
                    }
                }
            }
        }
        mock_response.json.return_value = api_data
        mock_requests_get.return_value = mock_response

        # Call the function with last_processed_id = None
        flashes, batch_latest_id = get_sina_live_flashes(last_processed_id=None, page_size=10)

        mock_requests_get.assert_called_once()
        self.assertEqual(batch_latest_id, item1_id) # Latest ID from API batch
        self.assertEqual(len(flashes), 2)           # Only two items should be processed successfully

        # Check that the processed flashes are the correct ones (item1 and item3)
        # Flashes are returned oldest first, so item3 then item1
        processed_flash_ids = [f["flash_id"] for f in flashes]
        self.assertIn(f"sina_live_{item3_id}", processed_flash_ids)
        self.assertIn(f"sina_live_{item1_id}", processed_flash_ids)
        self.assertNotIn(f"sina_live_{item_malformed_id}", processed_flash_ids)

        # Verify order (optional but good)
        self.assertEqual(flashes[0]["flash_id"], f"sina_live_{item3_id}")
        self.assertEqual(flashes[1]["flash_id"], f"sina_live_{item1_id}")

    @patch('core.news_sources.sina_live_client.requests.get')
    def test_unicode_in_content_and_tags(self, mock_requests_get):
        """Test processing of items with Unicode characters (e.g., Chinese) in content and tags."""
        mock_response = MagicMock()
        mock_response.status_code = 200

        item_id = 4194240
        item_time_str = "2025-05-15 11:00:00"
        unicode_content = "【中文快讯】这是一个包含中文字符的快讯内容。"
        unicode_tag_name = "行业动态"

        # Construct the item with Unicode tag name. Note: _generate_mock_api_item uses a default tag.
        # We'll manually create the item here or modify _generate_mock_api_item if this becomes common.
        api_item = {
            "id": item_id,
            "zhibo_id": 152,
            "type": 0,
            "rich_text": unicode_content,
            "create_time": item_time_str,
            "update_time": item_time_str,
            "tag": [{"id": "10", "name": unicode_tag_name}], # Unicode tag
            "docurl": f"https://finance.sina.com.cn/doc_{item_id}.shtml",
            "ext": json.dumps({})
        }

        api_data = {
            "result": {
                "status": {"code": 0, "msg": "OK"},
                "data": {
                    "feed": {
                        "list": [api_item]
                    }
                }
            }
        }
        mock_response.json.return_value = api_data
        mock_requests_get.return_value = mock_response

        flashes, batch_latest_id = get_sina_live_flashes(last_processed_id=None, page_size=10)

        mock_requests_get.assert_called_once()
        self.assertEqual(batch_latest_id, item_id)
        self.assertEqual(len(flashes), 1)

        processed_flash = flashes[0]
        self.assertEqual(processed_flash["flash_id"], f"sina_live_{item_id}")
        self.assertEqual(processed_flash["content"], unicode_content)
        self.assertIn(unicode_tag_name, processed_flash["tags"])
        self.assertEqual(len(processed_flash["tags"]), 1)

    @patch('core.news_sources.sina_live_client.requests.get')
    def test_ext_field_variations(self, mock_requests_get):
        """Test variations in the 'ext' field, like missing stocks or docurl."""
        mock_response = MagicMock()
        mock_response.status_code = 200

        base_item_id = 4194250
        base_time_str = "2025-05-15 12:00:00"
        base_content = "【快讯】测试ext字段变体"
        top_level_docurl = f"https://finance.sina.com.cn/top_level_doc_{base_item_id}.shtml"

        test_cases = [
            ("ext_missing_stocks_key", json.dumps({"other_key": "value"}), [], top_level_docurl, 1),
            ("ext_empty_stocks_list", json.dumps({"stocks": []}), [], top_level_docurl, 1),
            ("ext_with_stocks_no_ext_docurl", json.dumps({"stocks": [{"market": "cn", "symbol": "sh600000", "key": "浦发银行"}]}), [{"market": "cn", "symbol": "SH600000", "name": "浦发银行"}], top_level_docurl, 1),
            ("ext_with_stocks_and_ext_docurl", json.dumps({"stocks": [{"market": "cn", "symbol": "sz000002", "key": "万科A"}], "docurl": f"https://finance.sina.com.cn/ext_doc_{base_item_id}.shtml"}), [{"market": "cn", "symbol": "SZ000002", "name": "万科A"}], f"https://finance.sina.com.cn/ext_doc_{base_item_id}.shtml", 1),
            ("ext_is_none", None, [], top_level_docurl, 1),
            ("ext_is_empty_string", "", [], top_level_docurl, 1),
            ("ext_is_invalid_json", "{\"malformed", [], top_level_docurl, 0), # Corrected expectation
        ]

        for i, (desc, ext_str, expected_symbols, expected_docurl, expected_flash_count) in enumerate(test_cases):
            with self.subTest(description=desc):
                item_id = base_item_id + i
                # Reset mock for each subtest
                current_mock_response = MagicMock()
                current_mock_response.status_code = 200
                
                api_item = {
                    "id": item_id,
                    "zhibo_id": 152,
                    "type": 0,
                    "rich_text": base_content,
                    "create_time": base_time_str,
                    "update_time": base_time_str,
                    "tag": [],
                    "docurl": top_level_docurl, 
                }
                if ext_str is not None:
                    api_item["ext"] = ext_str
                
                current_api_data = {
                    "result": {"status": {"code": 0, "msg": "OK"},
                               "data": {"feed": {"list": [api_item]}}}}
                
                if desc == "ext_is_invalid_json": # Simulate JSON error for this specific subcase
                    current_mock_response.json.side_effect = json.JSONDecodeError("mock error", "doc", 0)
                else:
                    current_mock_response.json.return_value = current_api_data
                    current_mock_response.json.side_effect = None # Clear side_effect if any

                mock_requests_get.return_value = current_mock_response # Assign to the main mock_requests_get
                
                flashes, batch_latest_id = get_sina_live_flashes(last_processed_id=None, page_size=10)

                # Assert that requests.get was called
                mock_requests_get.assert_called_with(
                    'https://zhibo.sina.com.cn/api/zhibo/feed',
                    params={'page': 1, 'page_size': 10, 'zhibo_id': 152, 'type': 1}, 
                    timeout=10
                )
                
                # In all cases where API call itself is mocked as successful, batch_latest_id should be the item_id
                # unless the feed list itself is empty or API status is non-zero (not these subcases).
                # For "ext_is_invalid_json", the item is fetched but fails processing.
                # get_sina_live_flashes is designed to return the latest ID from the batch if any items were in the list.
                if current_api_data["result"]["data"]["feed"]["list"]: # if there were items to begin with
                     self.assertEqual(batch_latest_id, item_id, f"Subtest '{desc}': batch_latest_id mismatch. Got {batch_latest_id}")
                else: # Should not happen in these test_cases
                     self.assertIsNone(batch_latest_id, f"Subtest '{desc}': batch_latest_id should be None for empty list. Got {batch_latest_id}")

                self.assertEqual(len(flashes), expected_flash_count, f"Subtest '{desc}': flashes length mismatch. Got {len(flashes)}")

                if expected_flash_count > 0:
                    processed_flash = flashes[0]
                    self.assertEqual(processed_flash["associated_symbols"], expected_symbols, f"Subtest '{desc}': associated_symbols mismatch")
                    self.assertEqual(processed_flash["detail_url"], expected_docurl, f"Subtest '{desc}': detail_url mismatch")

if __name__ == '__main__':
    unittest.main() 