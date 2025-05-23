import { apiClient } from '../lib/apiClient';
import { config } from '../lib/config';

// NewsItem接口定义
export interface NewsItem {
  id: string;
  title: string;
  content: string;
  publishTime: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  tags: string[];
  stocks: {
    name: string;
    symbol: string;
    market: string;
  }[];
  coreInsight?: {
    summary: string;
    keyPoint: string;
  };
  category: string;
}

// API数据接口
interface ApiFlashData {
  flash_id?: string;
  content?: string;
  publish_timestamp_utc?: string;
  tags?: string[];
  associated_symbols?: Array<{
    name?: string;
    symbol?: string;
    market?: string;
  }>;
  llm_analysis?: {
    suggested_title?: string;
    sentiment?: string;
    summary?: string;
    category?: string;
    stock_specific_analysis?: {
      potential_impact?: string;
    };
    macro_analysis?: {
      potential_market_impact?: string;
    };
  };
}

// LLM分析数据接口
interface LLMAnalysis {
  suggested_title?: string;
  sentiment?: string;
  summary?: string;
  category?: string;
  stock_specific_analysis?: {
    potential_impact?: string;
  };
  macro_analysis?: {
    potential_market_impact?: string;
  };
}

// 从API获取的数据适配到我们的NewsItem接口
const adaptApiDataToNewsItem = (apiData: ApiFlashData): NewsItem => {
  // 检查LLM分析是否存在
  const llmAnalysis = apiData.llm_analysis || {};
  
  // 获取LLM生成的标题，如果不存在则使用内容的前缀
  const title = llmAnalysis.suggested_title || 
                apiData.content?.substring(0, 100) || 
                '无标题';
  
  // 记录标题生成日志 (开发环境)
  if (config.dev.enableLogs) {
    //console.log(`[标题生成] ID: ${apiData.flash_id || 'unknown'}`);
    //console.log(`  - LLM生成: ${llmAnalysis.suggested_title || '(无)'}`);
    //console.log(`  - 最终使用: ${title}`);
  }
  
  // 确定情感类型
  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
  if (llmAnalysis.sentiment) {
    if (llmAnalysis.sentiment.includes('积极') || llmAnalysis.sentiment.includes('利好')) {
      sentiment = 'positive';
    } else if (llmAnalysis.sentiment.includes('消极') || llmAnalysis.sentiment.includes('利空')) {
      sentiment = 'negative';
    }
  }
  
  // 提取标签
  const tags = apiData.tags || [];
  
  // 关联股票
  const stocks = apiData.associated_symbols?.map((symbol) => ({
    name: symbol.name || '未知',
    symbol: symbol.symbol || '',
    market: symbol.market || ''
  })) || [];

  // 核心观点
  let coreInsight;
  if (llmAnalysis.summary) {
    coreInsight = {
      summary: llmAnalysis.summary,
      keyPoint: llmAnalysis.stock_specific_analysis?.potential_impact || 
                llmAnalysis.macro_analysis?.potential_market_impact || 
                '此条快讯核心观点生成中...'
    };
  }

  // 使用LLM直接返回的分类，如果不存在则使用推断函数
  let category = llmAnalysis.category;
  if (!category) {
    category = inferCategoryFromLLMAnalysis(
      llmAnalysis, 
      apiData.content || '', 
      sentiment, 
      tags
    );
  }
  
  return {
    id: apiData.flash_id || `temp-${Date.now()}`,
    title: title,
    content: apiData.content || '无内容',
    publishTime: apiData.publish_timestamp_utc || new Date().toISOString(),
    sentiment,
    tags,
    stocks,
    coreInsight,
    category
  };
};

// 推断分类的辅助函数
const inferCategoryFromLLMAnalysis = (
  llmAnalysis: LLMAnalysis,
  content: string,
  sentiment: string,
  tags: string[]
): string => {
  // 如果已经有LLM分析的分类，直接使用
  if (llmAnalysis.category) {
    return llmAnalysis.category;
  }
  
  // 根据内容和标签推断分类
  const contentLower = content.toLowerCase();
  const allTags = tags.join(' ').toLowerCase();
  
  // 政策相关关键词
  if (contentLower.includes('政策') || contentLower.includes('监管') || 
      contentLower.includes('政府') || allTags.includes('政策')) {
    return '政策动态';
  }
  
  // 市场相关关键词
  if (contentLower.includes('涨停') || contentLower.includes('大涨') || 
      contentLower.includes('暴涨') || sentiment === 'positive') {
    return '市场热点';
  }
  
  // 公司相关关键词
  if (contentLower.includes('公司') || contentLower.includes('企业') || 
      contentLower.includes('业绩') || contentLower.includes('财报')) {
    return '公司动态';
  }
  
  // 行业相关关键词
  if (contentLower.includes('行业') || contentLower.includes('板块') || 
      contentLower.includes('概念')) {
    return '行业趋势';
  }
  
  // 默认分类
  return '综合资讯';
};

// 生成分页模拟数据
const generatePaginatedMockData = (page: number, limit: number = 20): NewsItem[] => {
  const allMockTemplates = [
    {
      titleTemplate: '新能源汽车补贴政策延长，预计将刺激行业销量大幅增长',
      contentTemplate: '国务院宣布将延长新能源汽车购置补贴和免征车辆购置税政策至2024年底。AI分析显示，此举将显著提振汽车行业销量15-20%，尤其对于中端纯电动车型。',
      sentiment: 'positive' as const,
      tags: ['新能源汽车', '政策利好', '产业链'],
      stocks: [
        { name: '比亚迪', symbol: 'SZ002594', market: 'SZ' },
        { name: '宁德时代', symbol: 'SZ300750', market: 'SZ' }
      ],
      category: '政策动态'
    },
    {
      titleTemplate: '半导体行业库存周期触底，市场需求回暖',
      contentTemplate: '银行业数据显示，半导体行业超预期好转，市场需求正在回暖。AI分析认为这预示着半年多的库存调整接近尾声。',
      sentiment: 'neutral' as const,
      tags: ['半导体', '库存周期', '电子元器件'],
      stocks: [
        { name: '中芯国际', symbol: 'SH688981', market: 'SH' },
        { name: '韦尔股份', symbol: 'SH603501', market: 'SH' }
      ],
      category: '行业趋势'
    },
    {
      titleTemplate: '央行下调存款准备金率，释放长期资金',
      contentTemplate: '中国人民银行宣布全面下调金融机构存款准备金率。AI分析表示，此举将释放长期资金，有利于提振市场信心。',
      sentiment: 'positive' as const,
      tags: ['央行政策', '货币宽松', '银行业'],
      stocks: [
        { name: '工商银行', symbol: 'SH601398', market: 'SH' },
        { name: '万科A', symbol: 'SZ000002', market: 'SZ' }
      ],
      category: '政策动态'
    },
    {
      titleTemplate: '医药龙头企业研发进展，临床试验结果出炉',
      contentTemplate: '恒瑞医药发布重磅药物临床试验结果。AI分析指出，这将对该公司研发管线产生重要影响。',
      sentiment: 'negative' as const,
      tags: ['医药生物', '临床试验', '研发'],
      stocks: [
        { name: '恒瑞医药', symbol: 'SH600276', market: 'SH' },
        { name: '药明康德', symbol: 'SH603259', market: 'SH' }
      ],
      category: '公司动态'
    },
    {
      titleTemplate: '芯片巨头推出新一代AI处理器，性能大幅提升',
      contentTemplate: '英伟达发布最新一代GPU架构，与上代相比算力大幅提升。这款芯片主要面向AI训练和推理场景。',
      sentiment: 'positive' as const,
      tags: ['AI芯片', '技术突破', '高性能计算'],
      stocks: [
        { name: '英伟达', symbol: 'NVDA', market: 'NASDAQ' },
        { name: '寒武纪', symbol: 'SH688256', market: 'SH' }
      ],
      category: '重大先机'
    }
  ];

  const result: NewsItem[] = [];
  const startIndex = page * limit;
  
  for (let i = 0; i < limit; i++) {
    const templateIndex = (startIndex + i) % allMockTemplates.length;
    const template = allMockTemplates[templateIndex];
    const itemIndex = startIndex + i;
    
    // 如果超过一定数量，停止生成（模拟数据有限）
    if (itemIndex >= 100) break;
    
    result.push({
      id: `mock-${itemIndex + 1}`,
      title: `${template.titleTemplate} (第${itemIndex + 1}条)`,
      content: `${template.contentTemplate} 这是第${itemIndex + 1}条模拟快讯数据。`,
      publishTime: new Date(Date.now() - (itemIndex + 1) * 15 * 60000).toISOString(), // 每条间隔15分钟
      sentiment: template.sentiment,
      tags: template.tags,
      stocks: template.stocks,
      coreInsight: {
        summary: `模拟分析摘要 ${itemIndex + 1}`,
        keyPoint: `这是第${itemIndex + 1}条快讯的核心观点分析`
      },
      category: template.category
    });
  }
  
  return result;
};

// 获取新闻数据的服务接口
export interface FetchNewsParams {
  skip?: string;
  limit?: string;
  sentiment?: string;
}

// 从API获取新闻数据
export const fetchNewsData = async (params: FetchNewsParams = {}): Promise<NewsItem[]> => {
  try {
    const queryParams = {
      skip: params.skip || '0',
      limit: params.limit || '20',
      ...(params.sentiment && params.sentiment !== 'all' ? { sentiment: params.sentiment } : {})
    };
    
    const data = await apiClient.get(config.endpoints.flashes.latest, queryParams);
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      //console.log('API返回空数据，使用模拟数据');
      // 计算分页参数
      const skip = parseInt(params.skip || '0');
      const limit = parseInt(params.limit || '20');
      const page = Math.floor(skip / limit);
      
      // 使用分页模拟数据
      return generatePaginatedMockData(page, limit);
    }
    
    return data.map(adaptApiDataToNewsItem);
  } catch (error) {
    console.error('获取新闻数据失败:', error);
    //console.log('API请求失败，使用模拟数据');
    // 计算分页参数
    const skip = parseInt(params.skip || '0');
    const limit = parseInt(params.limit || '20');
    const page = Math.floor(skip / limit);
    
    // 使用分页模拟数据
    return generatePaginatedMockData(page, limit);
  }
};

// 获取最新新闻数据
export const fetchLatestNews = async (itemsPerPage: number = 20): Promise<NewsItem[]> => {
  return fetchNewsData({
    skip: '0',
    limit: itemsPerPage.toString()
  });
};

// 加载更多新闻数据
export const fetchMoreNews = async (page: number, itemsPerPage: number = 20): Promise<NewsItem[]> => {
  return fetchNewsData({
    skip: (page * itemsPerPage).toString(),
    limit: itemsPerPage.toString()
  });
}; 