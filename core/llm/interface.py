import os
import json
from openai import OpenAI, APIError, APITimeoutError

# 从环境变量中获取 API Key
VOLCANO_ENGINE_API_KEY = os.environ.get("VOLCANO_ENGINE_API_KEY")
VOLCANO_ENGINE_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
MODEL_ENDPOINT_ID = "deepseek-r1-250120"

if not VOLCANO_ENGINE_API_KEY:
    print("错误：环境变量 VOLCANO_ENGINE_API_KEY 未设置。请设置该环境变量后重试。")

client = OpenAI(
    api_key=VOLCANO_ENGINE_API_KEY,
    base_url=VOLCANO_ENGINE_BASE_URL,
)

def get_flash_analysis_from_llm(flash_content: str, target_symbols: list[dict] | None = None) -> dict:
    """
    调用大语言模型分析财经快讯文本。
    根据是否存在关联股票，进行针对性股票分析或宏观/行业分析。

    参数:
        flash_content (str): 需要分析的财经快讯文本内容。
        target_symbols (list[dict] | None): 关联的股票列表，每个股票是一个字典，
                                           例如 [{'symbol': 'SZ000001', 'name': '平安银行'}, ...]。
                                           如果为 None 或空列表，则进行宏观/行业分析。
    返回:
        dict: 包含分析结果的字典。
    """
    if not VOLCANO_ENGINE_API_KEY:
        return {
            "success": False,
            "error": "API Key未配置",
            "summary": None,
            "sentiment": None,
            "analysis_type": None,
            "category": None,
            "stock_specific_analysis": None,
            "macro_analysis": None,
            "suggested_title": None
        }

    # 1. 定义期望的JSON输出结构的Python字典示例
    example_json_output_structure = {
        "suggested_title": "基于内容生成的吸引人标题（不超过20字）",
        "summary": "快讯的简明摘要（不超过80字）",
        "sentiment": "快讯的整体市场情绪（选项：积极, 中性, 消极）",
        "analysis_type": "分析类型（选项：stock_specific, macroeconomic, general_news_no_analysis）",
        "category": "快讯的分类（选项：重大先机, 行业趋势, 政策动态, 市场看点, 其他）",
        "stock_specific_analysis": {
            "analyzed_symbol": "被分析股票的代码（例如SZ000001）或 \"不适用\"",
            "key_info_points": ["从快讯中提取的与该股票直接相关的核心信息点（1-3个）"] or ["信息不足"],
            "potential_impact": "这些信息点可能对该股票产生的正面或负面影响的简述",
            "attention_level": "综合关注度建议（选项：高度关注价值, 值得进一步观察, 影响有限或不明确, 注意潜在风险, 不适用）",
            "reasoning": "给出上述股票分析的综合理由（不超过100字）"
        }, # or null
        "macro_analysis": {
            "key_macro_points": ["从快讯中提取的核心宏观/行业信息点（1-3个）"] or ["信息不足"],
            "potential_market_impact": "这些信息对整体市场或特定行业板块可能产生的影响的简述",
            "outlook_tendency": "对宏观趋势或相关行业的展望倾向的描述（例如：整体积极, 关注XX行业机会, 短期谨慎, 政策驱动等）",
            "reasoning": "给出上述宏观分析的综合理由（不超过100字）"
        } # or null
    }
    # 将字典示例转换为格式化的JSON字符串
    example_json_string = json.dumps(example_json_output_structure, indent=2, ensure_ascii=False)

    # 2. 构建 System Prompt，嵌入JSON示例字符串
    system_prompt_intro = "你是一位专业的财经分析助手。你的任务是基于提供的快讯内容和可能的关联股票信息，进行深入分析。"
    system_prompt_format_instruction = "请严格按照以下JSON格式返回你的分析结果，确保JSON可以被直接解析，不要在JSON前后添加任何额外文本或Markdown标记："
    
    # 使用三重引号确保 task 指令部分的字符串完整性
    system_prompt_tasks = """---
任务指令：
1. 生成标题：根据快讯内容，生成简洁有力、能够吸引读者注意的标题，不超过20字。
   标题应具备以下特点：
   - 准确反映快讯核心内容
   - 包含关键的公司名称、数据或政策信息
   - 使用适当的积极/消极情感词增强可读性
   - 对于股票变动相关内容，应包含具体数字

2. 生成摘要：对快讯内容进行总结，不超过80字。
3. 判断情绪：评估快讯所传达的整体市场情绪，从【积极, 中性, 消极】中选择一个。
4. 确定快讯分类：
   对快讯进行分类，从以下选项中选择一个最匹配的：
   - "重大先机"：可能带来重大投资机会的积极消息、技术突破、高增长预、潜在风险、业绩下滑、负面事件期等
   - "行业趋势"：描述特定行业的发展动态、市场分析、供需变化等
   - "政策动态"：关于宏观经济政策、行业法规、政府举措等的快讯
   - "市场看点"：其他值得关注的市场信息
   - "其他"：不属于以上任何明确分类的快讯
5. 进行深度分析：
   - 如果提供了明确的"关联股票"列表：选择其中最受快讯内容影响的一只股票进行分析。
     设置 `analysis_type` 为 `stock_specific`。
     填充 `stock_specific_analysis` 对象中的所有字段。`macro_analysis` 设为 `null`。
     注意：当 `analysis_type` 为 `stock_specific` 时，`stock_specific_analysis` 字段必须是一个完整的对象，即使某些子字段内容为"信息不足"或"不适用"；`macro_analysis` 字段此时应为 `null`。
   - 如果未提供"关联股票"列表，或者快讯内容明显更侧重于宏观经济、政策或广泛的行业趋势：
     设置 `analysis_type` 为 `macroeconomic`。
     填充 `macro_analysis` 对象中的所有字段。`stock_specific_analysis` 设为 `null`。
     注意：当 `analysis_type` 为 `macroeconomic` 时，`macro_analysis` 字段必须是一个完整的对象，`stock_specific_analysis` 字段此时应为 `null`。
   - 如果快讯内容非常简短、高度模糊、缺乏具体的财经数据/事件、纯属猜测/传闻且无明确影响对象，或者本质上不包含可供财经解读的实质信息（例如："某某将出席会议"，"市场情绪整体平稳"，"XX公司CEO发表新年致辞"等此类无法直接转化为投资参考或经济趋势判断的内容）：
     设置 `analysis_type` 为 `general_news_no_analysis`。
     此时，`stock_specific_analysis` 和 `macro_analysis` 字段必须为 `null`。
     即便如此，也请尽可能提供对原始快讯的 `summary` 和 `sentiment`，以及 `category`。
确保所有文本输出都使用中文。"""

    # 使用字符串加法显式拼接，并手动添加换行符
    system_prompt = system_prompt_intro + "\n" + \
                    system_prompt_format_instruction + "\n" + \
                    example_json_string + "\n" + \
                    system_prompt_tasks

    user_prompt_parts = [f"快讯内容：{flash_content}"]
    if target_symbols and len(target_symbols) > 0:
        user_prompt_parts.append("关联股票：")
        for stock in target_symbols:
            user_prompt_parts.append(f"- {stock.get('symbol', '未知代码')} ({stock.get('name', '未知名称')})")
        user_prompt_parts.append("\n请重点分析上述关联股票中最受快讯影响的一只。")
    else:
        user_prompt_parts.append("（无特定关联股票，请侧重宏观、政策或行业层面的分析，如果适用）")
    
    final_user_prompt = "\n".join(user_prompt_parts)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": final_user_prompt},
    ]

    default_error_response = {
        "success": False,
        "summary": None, "sentiment": None, "analysis_type": None, "category": None,
        "stock_specific_analysis": None, "macro_analysis": None,
        "suggested_title": None
    }

    try:
        print(f"DEBUG: 正在向LLM发送请求。System prompt 长度: {len(system_prompt)}, User prompt 长度: {len(final_user_prompt)}")
        
        completion = client.chat.completions.create(
            model=MODEL_ENDPOINT_ID,
            messages=messages,
            temperature=0.5, # 稍微提高一点，允许分析性任务有一定的灵活性
        )
        
        raw_response_content = completion.choices[0].message.content
        print(f"DEBUG: LLM原始响应：{raw_response_content}")

        cleaned_response = raw_response_content.strip()
        if cleaned_response.startswith("```json"):
            if cleaned_response.startswith("```json\n"):
                cleaned_response = cleaned_response[8:]
            else:
                cleaned_response = cleaned_response[7:]
            if cleaned_response.endswith("```"):
                cleaned_response = cleaned_response[:-3]
            cleaned_response = cleaned_response.strip()
        
        if not cleaned_response:
            return {**default_error_response, "error": f"LLM响应在清理Markdown后为空: {raw_response_content}"}

        try:
            analysis_data = json.loads(cleaned_response)
        except json.JSONDecodeError as e:
            return {
                **default_error_response,
                "error": f"LLM响应JSON解析错误: {e}. 清理后尝试解析的内容: {cleaned_response}. 原始响应: {raw_response_content}"
            }

        summary = analysis_data.get("summary")
        sentiment = analysis_data.get("sentiment")
        analysis_type = analysis_data.get("analysis_type")
        category = analysis_data.get("category")
        suggested_title = analysis_data.get("suggested_title")

        if not all([summary, sentiment, analysis_type, category]):
            return {
                **default_error_response, 
                "summary": summary, "sentiment": sentiment, 
                "analysis_type": analysis_type, "category": category,
                "suggested_title": suggested_title,
                "error": f"LLM返回的JSON缺少必要的顶层字段 (summary, sentiment, analysis_type, category)。响应: {cleaned_response}"
            }
        
        valid_sentiments = ["积极", "中性", "消极"]
        if sentiment not in valid_sentiments:
            print(f"警告: LLM返回的情绪标签 '{sentiment}' 不在预设范围 {valid_sentiments}。")

        valid_categories = ["重大先机", "行业趋势", "政策动态", "市场看点", "其他"]
        if category not in valid_categories:
            print(f"警告: LLM返回的分类标签 '{category}' 不在预设范围 {valid_categories}。")

        valid_analysis_types = ["stock_specific", "macroeconomic", "general_news_no_analysis"]
        if analysis_type not in valid_analysis_types:
            return {
                **default_error_response, "summary": summary, "sentiment": sentiment, "analysis_type": analysis_type, "category": category,
                "error": f"LLM返回的 analysis_type ('{analysis_type}') 无效。响应: {cleaned_response}"
            }
            
        stock_analysis_data = analysis_data.get("stock_specific_analysis")
        macro_analysis_data = analysis_data.get("macro_analysis")

        if analysis_type == "stock_specific":
            if not isinstance(stock_analysis_data, dict):
                # 即使是 '不适用' 的情况，也应该是一个包含 'analyzed_symbol': '不适用' 等信息的对象
                # 如果这里为 null，但 analysis_type 是 stock_specific，说明LLM未完全遵循指示
                return {
                    **default_error_response, "summary": summary, "sentiment": sentiment, "analysis_type": analysis_type, "category": category,
                    "error": f"当 analysis_type 为 stock_specific 时，stock_specific_analysis 必须是一个非null的对象。响应: {cleaned_response}"
                }
            valid_attention_levels = ["高度关注价值", "值得进一步观察", "影响有限或不明确", "注意潜在风险", "不适用"]
            # 确保 stock_analysis_data 内部字段也存在，即使是 "不适用" 或 "信息不足"
            if not all(k in stock_analysis_data for k in ["analyzed_symbol", "key_info_points", "potential_impact", "attention_level", "reasoning"]):
                print(f"警告: stock_specific_analysis 对象缺少部分内部字段。响应: {stock_analysis_data}")
                # 可以选择报错或尝试填充默认值
            elif stock_analysis_data.get("attention_level") not in valid_attention_levels:
                 print(f"警告: stock_specific_analysis.attention_level ('{stock_analysis_data.get('attention_level')}') 无效。")

        elif analysis_type == "macroeconomic":
            if not isinstance(macro_analysis_data, dict):
                 return {
                    **default_error_response, "summary": summary, "sentiment": sentiment, "analysis_type": analysis_type, "category": category,
                    "error": f"当 analysis_type 为 macroeconomic 时，macro_analysis 必须是一个非null的对象。响应: {cleaned_response}"
                }
            if not all(k in macro_analysis_data for k in ["key_macro_points", "potential_market_impact", "outlook_tendency", "reasoning"]):
                 print(f"警告: macro_analysis 对象缺少部分内部字段。响应: {macro_analysis_data}")

        return {
            "success": True,
            "error": None,
            "summary": summary,
            "sentiment": sentiment,
            "analysis_type": analysis_type,
            "category": category,
            "stock_specific_analysis": stock_analysis_data if analysis_type == "stock_specific" else None,
            "macro_analysis": macro_analysis_data if analysis_type == "macroeconomic" else None,
            "suggested_title": suggested_title
        }

    except APITimeoutError as e:
        return {**default_error_response, "error": f"LLM API调用超时: {e}"}
    except APIError as e:
        return {**default_error_response, "error": f"LLM API错误: {e.message} (状态码: {e.status_code})"}
    except Exception as e:
        return {**default_error_response, "error": f"调用LLM时发生未知错误: {str(e)}"}

if __name__ == '__main__':
    print("正在测试 LLM 接口 (增强版分析)...")
    if not VOLCANO_ENGINE_API_KEY:
        print("请先设置 VOLCANO_ENGINE_API_KEY 环境变量以进行测试。")
    else:
        print(f"使用 API Key: {VOLCANO_ENGINE_API_KEY[:4]}...{VOLCANO_ENGINE_API_KEY[-4:]}")
        
        test_flash_stock = "【公司动态】A公司(SZ000001)今日宣布获得一项重大技术突破，预计将显著提升其核心产品竞争力。市场分析人士认为，此举有望带动公司业绩大幅增长。"
        test_symbols_stock = [{"symbol": "SZ000001", "name": "A公司"}, {"symbol": "SH600000", "name": "B银行"}]
        
        test_flash_macro = "【宏观政策】国家发改委今日发布关于支持新能源产业发展的若干意见，提出将加大对光伏、风电项目的补贴力度，并简化审批流程。意见还强调要保障新能源消纳，推动储能技术进步。"
        
        test_flash_general = "【市场传闻】据不可靠消息，某知名企业家今日下午将有重要行程。"

        print("\n--- 测试1: 针对特定股票的快讯 ---")
        analysis1 = get_flash_analysis_from_llm(test_flash_stock, target_symbols=test_symbols_stock)
        print(json.dumps(analysis1, ensure_ascii=False, indent=2))
        if analysis1.get("success") and analysis1.get("suggested_title"):
            print(f"生成标题: 《{analysis1['suggested_title']}》")

        print("\n--- 测试2: 宏观政策类快讯 (无特定关联股票传入) ---")
        analysis2 = get_flash_analysis_from_llm(test_flash_macro)
        print(json.dumps(analysis2, ensure_ascii=False, indent=2))
        if analysis2.get("success") and analysis2.get("suggested_title"):
            print(f"生成标题: 《{analysis2['suggested_title']}》")
        
        print("\n--- 测试3: 非常通用的新闻，可能无法深入分析 ---")
        analysis3 = get_flash_analysis_from_llm(test_flash_general)
        print(json.dumps(analysis3, ensure_ascii=False, indent=2))

        print("\n--- 测试4: 快讯有关联股票，但信息可能不足 ---")
        test_flash_stock_less_info = "C公司(SZ000002)股价今日小幅上涨。"
        test_symbols_stock_less_info = [{"symbol": "SZ000002", "name": "C公司"}]
        analysis4 = get_flash_analysis_from_llm(test_flash_stock_less_info, target_symbols=test_symbols_stock_less_info)
        print(json.dumps(analysis4, ensure_ascii=False, indent=2))
        
        print("\n--- 测试5: 宏观快讯，但信息可能不足 ---")
        test_flash_macro_less_info = "今日数据公布。"
        analysis5 = get_flash_analysis_from_llm(test_flash_macro_less_info)
        print(json.dumps(analysis5, ensure_ascii=False, indent=2)) 