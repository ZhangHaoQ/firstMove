"use client";

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import FilterDropdown, { INDUSTRY_FILTER_OPTIONS, SENTIMENT_FILTER_OPTIONS, TIME_FILTER_OPTIONS } from '@/components/filters/FilterDropdown';
import NewsCard from '@/components/news/NewsCard';

// 定义新闻接口
interface NewsItem {
  id: string;
  title: string;
  content: string;
  publishTime: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  tags: string[];
  stocks: Array<{
    name: string;
    symbol: string;
    market: string;
    changePercent?: number;
  }>;
  coreInsight?: {
    summary?: string;
    keyPoint?: string;
  };
  category: string;
}

// 根据LLM分析结果推断新闻类别
const inferCategoryFromLLMAnalysis = (llmAnalysis: any, content: string, sentiment: string, tags: string[]): string => {
  // 分类解释:
  // - "重大先机": 可能带来重大投资机会的积极消息、技术突破、高增长预期等
  // - "行业趋势": 描述特定行业的发展动态、市场分析、供需变化等
  // - "风险警示": 针对特定股票的潜在风险、业绩下滑、负面事件等
  // - "政策动态": 关于宏观经济政策、行业法规、政府举措等的快讯
  // - "市场看点": 其他值得关注的积极或中性市场信息
  // - "其他": 不属于以上任何明确分类的快讯
  
  // 1. 考虑股票特定分析
  if (llmAnalysis.analysis_type === 'stock_specific') {
    const stockAnalysis = llmAnalysis.stock_specific_analysis || {};
    
    // 检查是否有高度关注价值标记
    if (stockAnalysis.attention_level?.includes('高度关注') && sentiment === 'positive') {
      return '重大先机';
    }
    
    // 检查潜在影响描述
    const potentialImpact = stockAnalysis.potential_impact || '';
    if (sentiment === 'negative' || 
        potentialImpact.includes('风险') || 
        potentialImpact.includes('下滑') || 
        potentialImpact.includes('亏损')) {
      return '风险警示';
    }
    
    // 积极的股票分析通常是重大先机
    if (sentiment === 'positive') {
      return '重大先机';
    }
    
    return '市场看点';
  }
  
  // 2. 考虑宏观经济分析
  if (llmAnalysis.analysis_type === 'macroeconomic') {
    const macroAnalysis = llmAnalysis.macro_analysis || {};
    const macroPoints = macroAnalysis.key_macro_points || [];
    const macroPointsText = macroPoints.join(' ');
    const outlookTendency = macroAnalysis.outlook_tendency || '';
    
    // 检查是否与政策相关
    const policyKeywords = ['政策', '监管', '法规', '央行', '国务院', '发改委', '证监会', '银保监'];
    if (policyKeywords.some(word => 
      content.includes(word) || 
      macroPointsText.includes(word) || 
      outlookTendency.includes(word))) {
      return '政策动态';
    }
    
    // 检查是否是行业分析
    const industryKeywords = ['行业', '产业', '市场', '趋势', '周期', '供需', '产能'];
    if (industryKeywords.some(word => 
      content.includes(word) || 
      macroPointsText.includes(word) || 
      outlookTendency.includes(word)) ||
      tags.some(tag => tag.includes('行业'))) {
      return '行业趋势';
    }
    
    // 如果是负面宏观分析，可能是风险警示
    if (sentiment === 'negative') {
      return '风险警示';
    }
    
    return '市场看点';
  }
  
  // 3. 通用新闻或无深度分析的情况
  return '其他';
};

// 从API获取的数据适配到我们的NewsItem接口
const adaptApiDataToNewsItem = (apiData: any): NewsItem => {
  // 检查LLM分析是否存在
  const llmAnalysis = apiData.llm_analysis || {};
  
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
  const stocks = apiData.associated_symbols?.map((symbol: any) => ({
    name: symbol.name || '未知',
    symbol: symbol.symbol || '',
    market: symbol.market || '',
    // 这里的涨跌幅是模拟的，实际应从API获取
    changePercent: parseFloat((Math.random() * 10 - 5).toFixed(2))
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
    title: apiData.content?.substring(0, 100) || '无标题',
    content: apiData.content || '无内容',
    publishTime: apiData.publish_timestamp_utc || new Date().toISOString(),
    sentiment,
    tags,
    stocks,
    coreInsight,
    category
  };
};

// 从API获取新闻数据
const fetchNewsData = async (industry: string, sentiment: string, timeRange: string) => {
  try {
    // 构建查询参数
    const params = new URLSearchParams({
      skip: '0',
      limit: '20',
    });
    
    const response = await fetch(`http://localhost:8000/flashes/latest/?${params}`);
    if (!response.ok) {
      console.error('API请求失败，使用模拟数据');
      return getMockData();
    }
    
    const data = await response.json();
    if (!data || data.length === 0) {
      console.log('API返回空数据，使用模拟数据');
      return getMockData();
    }
    return data.map(adaptApiDataToNewsItem);
  } catch (error) {
    console.error('获取新闻数据失败:', error);
    return getMockData();
  }
};

// 模拟数据，用于在API未响应时展示
const getMockData = (): NewsItem[] => {
  return [
    {
      id: 'mock-1',
      title: '新能源汽车补贴政策延长，预计将刺激行业销量大幅增长',
      content: '国务院宣布将延长新能源汽车购置补贴和免征车辆购置税政策至2024年底。AI分析显示，此举将显著提振汽车行业销量15-20%，尤其对于中端纯电动车型。汽车产业链上下游企业有望迎来显著利好。',
      publishTime: new Date(Date.now() - 25 * 60000).toISOString(),
      sentiment: 'positive',
      tags: ['新能源', '政策利好', '汽车制造'],
      stocks: [
        { name: '比亚迪', symbol: 'SZ002594', market: 'SZ', changePercent: 3.2 },
        { name: '蔚来', symbol: 'NIO', market: 'NYSE', changePercent: 5.6 },
        { name: '宁德时代', symbol: 'SZ300750', market: 'SZ', changePercent: 2.8 }
      ],
      coreInsight: {
        summary: '新能源汽车补贴政策延长至2024年底',
        keyPoint: '新能源汽车行业将迎来政策红利，龙头企业有望率先受益'
      },
      category: '政策动态'
    },
    {
      id: 'mock-2',
      title: '半导体行业库存调整接近尾声，市场需求开始回暖',
      content: '银行业数据显示，半导体行业超预期好转，市场需求正在回暖。AI分析认为这预示着半年多的库存调整接近尾声，预计Q3开始行业将恢复增长。',
      publishTime: new Date(Date.now() - 185 * 60000).toISOString(),
      sentiment: 'neutral',
      tags: ['半导体', '库存周期', '电子元器件'],
      stocks: [
        { name: '中芯国际', symbol: 'SH688981', market: 'SH', changePercent: 1.2 },
        { name: '韦尔股份', symbol: 'SH603501', market: 'SH', changePercent: 0.8 },
        { name: '北方华创', symbol: 'SZ002371', market: 'SZ', changePercent: -0.3 }
      ],
      coreInsight: {
        summary: '半导体行业库存调整接近尾声',
        keyPoint: '半导体行业库存周期已见底，下半年需求将逐步回暖'
      },
      category: '行业趋势'
    },
    {
      id: 'mock-3',
      title: '某医药龙头企业核心产品临床失败实验，股价承压',
      content: '恒瑞医药今日宣布其重磅抗癌新药在III期临床试验中未达到预设的主要终点。AI分析指出，这将导致该公司研发进度受挫，预计今年来2-3年至多5-8年的负面影响。',
      publishTime: new Date(Date.now() - 65 * 60000).toISOString(),
      sentiment: 'negative',
      tags: ['医药生物', '研发失败', '临床试验'],
      stocks: [
        { name: '恒瑞医药', symbol: 'SH600276', market: 'SH', changePercent: -8.5 },
        { name: '药明康德', symbol: 'SH603259', market: 'SH', changePercent: -2.1 },
        { name: '医药ETF', symbol: 'SH512170', market: 'SH', changePercent: -1.4 }
      ],
      coreInsight: {
        summary: '某医药龙头企业核心产品临床失败',
        keyPoint: '该公司研发管线受挫，短期业绩增长或将放缓'
      },
      category: '风险警示'
    },
    {
      id: 'mock-4',
      title: '央行下调存款准备金率0.5个百分点，释放长期资金约1万亿元',
      content: '中国人民银行今日宣布全面下调金融机构存款准备金率0.5个百分点。AI分析表示，此举将释放长期资金约1万亿元，主要是基于包括但不限于房地产、基建刺激等因素的考量。',
      publishTime: new Date(Date.now() - 225 * 60000).toISOString(),
      sentiment: 'positive',
      tags: ['央行政策', '货币宽松', '银行业'],
      stocks: [
        { name: '工商银行', symbol: 'SH601398', market: 'SH', changePercent: 2.3 },
        { name: '万科A', symbol: 'SZ000002', market: 'SZ', changePercent: 4.7 },
        { name: '上证指数', symbol: 'SH000001', market: 'SH', changePercent: 1.8 }
      ],
      coreInsight: {
        summary: '央行全面降准0.5个百分点',
        keyPoint: '货币政策转向宽松，有利于提振市场信心和经济增长'
      },
      category: '政策动态'
    },
    {
      id: 'mock-5',
      title: '芯片巨头推出新一代AI处理器，性能提升300%',
      content: '英伟达今日发布最新一代GPU架构，与上代相比算力提升300%，能效提升50%。这款芯片主要面向AI训练和推理场景，将于明年一季度量产上市。',
      publishTime: new Date(Date.now() - 120 * 60000).toISOString(),
      sentiment: 'positive',
      tags: ['AI芯片', '技术突破', '高性能计算'],
      stocks: [
        { name: '英伟达', symbol: 'NVDA', market: 'NASDAQ', changePercent: 7.8 },
        { name: '寒武纪', symbol: 'SH688256', market: 'SH', changePercent: 5.2 }
      ],
      coreInsight: {
        summary: '芯片巨头发布AI芯片重大突破',
        keyPoint: '新一代GPU将显著降低AI计算成本，促进产业变革'
      },
      category: '重大先机'
    },
    {
      id: 'mock-6',
      title: '某大型互联网企业季度营收超预期，用户增长强劲',
      content: '某知名互联网企业今日发布的财报显示，该公司第二季度营收同比增长28%，净利润增长35%，均超市场预期。公司用户月活跃数增长至12亿，付费用户占比提升5个百分点。',
      publishTime: new Date(Date.now() - 150 * 60000).toISOString(),
      sentiment: 'positive',
      tags: ['互联网', '财报', '业绩超预期'],
      stocks: [
        { name: '腾讯控股', symbol: '00700', market: 'HK', changePercent: 3.1 },
        { name: '阿里巴巴', symbol: '09988', market: 'HK', changePercent: 2.2 }
      ],
      coreInsight: {
        summary: '互联网巨头财报超预期，用户和营收增长强劲',
        keyPoint: '该公司业绩表现优于大盘，显示互联网龙头抗周期能力较强'
      },
      category: '市场看点'
    },
    {
      id: 'mock-7',
      title: '某公司发布新产品发布会消息，或将于下月召开',
      content: '有消息称，某科技公司将于下个月在北京召开新品发布会，可能推出新一代消费电子产品。目前公司尚未官方确认此消息，但相关供应链已有备货动作。',
      publishTime: new Date(Date.now() - 300 * 60000).toISOString(),
      sentiment: 'neutral',
      tags: ['科技', '新品', '消费电子'],
      stocks: [
        { name: '小米集团', symbol: '01810', market: 'HK', changePercent: 0.5 }
      ],
      coreInsight: {
        summary: '某科技公司可能将举办新品发布会',
        keyPoint: '信息待确认，暂无法判断对公司业绩的实质影响'
      },
      category: '其他'
    }
  ];
};

// 主页组件
export default function Home() {
  // 筛选器状态
  const [industryFilter, setIndustryFilter] = useState('all');
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('latest');
  
  // 新闻数据状态
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取新闻数据
  useEffect(() => {
    const loadNewsData = async () => {
      setIsLoading(true);
        setError(null);
      
      try {
        const newsData = await fetchNewsData(industryFilter, sentimentFilter, timeFilter);
        setNews(newsData);
      } catch (err) {
        setError('获取数据失败，请稍后重试');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadNewsData();
    
    // 设置定时刷新 (每60秒刷新一次)
    const intervalId = setInterval(loadNewsData, 60000);
    
    return () => clearInterval(intervalId);
  }, [industryFilter, sentimentFilter, timeFilter]);

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-4">
          <h1 className="text-xl font-medium mb-3">先机发现</h1>
          
          {/* 筛选器组 */}
          <div className="flex space-x-2 mb-4">
            <FilterDropdown 
              label="全部行业" 
              options={INDUSTRY_FILTER_OPTIONS} 
              value={industryFilter} 
              onChange={setIndustryFilter} 
            />
            <FilterDropdown 
              label="全部情绪" 
              options={SENTIMENT_FILTER_OPTIONS} 
              value={sentimentFilter} 
              onChange={setSentimentFilter} 
            />
            <FilterDropdown 
              label="最新发布" 
              options={TIME_FILTER_OPTIONS} 
              value={timeFilter} 
              onChange={setTimeFilter} 
            />
          </div>
        </div>
        
        {/* 加载状态 */}
        {isLoading && news.length === 0 && (
          <div className="text-center py-6">
            <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            <p className="text-gray-600 text-sm">加载中...</p>
        </div>
      )}

        {/* 错误提示 */}
      {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">
          <p>{error}</p>
        </div>
      )}

        {/* 无数据提示 */}
        {!isLoading && !error && news.length === 0 && (
          <div className="text-center py-6">
            <svg className="h-10 w-10 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-gray-600 text-sm">暂无数据</p>
        </div>
      )}

        {/* 新闻列表 */}
        <div className="space-y-0">
          {news.map((item) => (
            <NewsCard key={item.id} news={item} />
          ))}
              </div>
              
        {/* 加载更多按钮 */}
        {!isLoading && news.length > 0 && (
          <div className="text-center mt-4 mb-6">
            <button className="px-4 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm text-sm text-gray-700 hover:bg-gray-50 focus:outline-none">
              加载更多
            </button>
            </div>
        )}
    </div>
    </MainLayout>
  );
}
