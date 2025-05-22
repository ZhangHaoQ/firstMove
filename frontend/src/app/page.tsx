"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import NewsCard from '@/components/news/NewsCard';
import { SENTIMENT_FILTER_OPTIONS } from '@/components/filters/FilterDropdown';
import { useNotification } from '@/contexts/NotificationContext';

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
      return '市场看点';
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
    
    // 如果是负面宏观分析，分类为市场看点
    if (sentiment === 'negative') {
      return '市场看点';
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
  
  // 获取LLM生成的标题，如果不存在则使用内容的前缀
  const title = llmAnalysis.suggested_title || 
                apiData.content?.substring(0, 100) || 
                '无标题';
  
  // 记录标题生成日志 (开发环境)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[标题生成] ID: ${apiData.flash_id || 'unknown'}`);
    console.log(`  - LLM生成: ${llmAnalysis.suggested_title || '(无)'}`);
    console.log(`  - 最终使用: ${title}`);
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
  const stocks = apiData.associated_symbols?.map((symbol: any) => ({
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

// 从API获取新闻数据
const fetchNewsData = async (sentiment: string) => {
  try {
    // 构建查询参数
    const params = new URLSearchParams({
      skip: '0',
      limit: '20',
    });
    
    // 添加情感筛选
    if (sentiment !== 'all') {
      params.append('sentiment', sentiment);
    }
    
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
      tags: ['新能源汽车', '政策利好', '产业链'],
      stocks: [
        { name: '比亚迪', symbol: 'SZ002594', market: 'SZ' },
        { name: '宁德时代', symbol: 'SZ300750', market: 'SZ' },
        { name: '长城汽车', symbol: 'SH601633', market: 'SH' }
      ],
      coreInsight: {
        summary: '新能源汽车补贴政策延长至2024年底',
        keyPoint: '政策延续将提振行业销量15-20%，重点利好中端纯电动车企'
      },
      category: '政策动态'
    },
    {
      id: 'mock-2',
      title: '半导体行业库存周期触底，市场需求回暖',
      content: '银行业数据显示，半导体行业超预期好转，市场需求正在回暖。AI分析认为这预示着半年多的库存调整接近尾声，预计Q3开始行业将恢复增长。',
      publishTime: new Date(Date.now() - 185 * 60000).toISOString(),
      sentiment: 'neutral',
      tags: ['半导体', '库存周期', '电子元器件'],
      stocks: [
        { name: '中芯国际', symbol: 'SH688981', market: 'SH' },
        { name: '韦尔股份', symbol: 'SH603501', market: 'SH' },
        { name: '北方华创', symbol: 'SZ002371', market: 'SZ' }
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
        { name: '恒瑞医药', symbol: 'SH600276', market: 'SH' },
        { name: '药明康德', symbol: 'SH603259', market: 'SH' },
        { name: '医药ETF', symbol: 'SH512170', market: 'SH' }
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
        { name: '工商银行', symbol: 'SH601398', market: 'SH' },
        { name: '万科A', symbol: 'SZ000002', market: 'SZ' },
        { name: '上证指数', symbol: 'SH000001', market: 'SH' }
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
        { name: '英伟达', symbol: 'NVDA', market: 'NASDAQ' },
        { name: '寒武纪', symbol: 'SH688256', market: 'SH' }
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
        { name: '腾讯控股', symbol: '00700', market: 'HK' },
        { name: '阿里巴巴', symbol: '09988', market: 'HK' }
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
        { name: '小米集团', symbol: '01810', market: 'HK' }
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
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [displayImportantOnly, setDisplayImportantOnly] = useState(false);
  
  // 搜索状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');  // 用于防抖
  
  // 新闻数据状态
  const [allNews, setAllNews] = useState<NewsItem[]>([]);
  const [filteredNews, setFilteredNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  
  // 通知上下文
  const { notifyNewFlash } = useNotification();
  
  // 用于跟踪之前加载的数据ID
  const prevNewsIdsRef = useRef<Set<string>>(new Set());
  // 用于跟踪组件是否已经加载过数据
  const hasInitializedRef = useRef<boolean>(false);
  
  // 用于无限滚动的引用
  const observer = useRef<IntersectionObserver | null>(null);
  const lastNewsElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || isLoadingMore) return;
    
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        console.log('触发加载更多...');
        loadMoreData();
      }
    }, {
      rootMargin: '100px', // 增加触发范围
      threshold: 0.1 // 降低可见度阈值，更早触发加载
    });
    
    if (node) observer.current.observe(node);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isLoadingMore, hasMore]); // 移除循环依赖，添加ESLint禁用注释
  
  // 每页加载的条数
  const ITEMS_PER_PAGE = 20;
  
  // 防抖处理搜索输入
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchInput]);
  
  // 获取所有新闻数据
  useEffect(() => {
    // 防止重复初始化加载
    if (!hasInitializedRef.current) {
      console.log('初始加载数据...');
      loadInitialData();
      hasInitializedRef.current = true;
    } else {
      console.log('组件已初始化，跳过重复加载');
    }
    
    // 定时刷新
    const intervalId = setInterval(() => {
      console.log('定时刷新...');
      loadInitialData();
    }, 60000);
    
    return () => clearInterval(intervalId);
  }, []); // 只在组件挂载时执行一次
  
  // 当筛选条件变化时重新筛选数据
  useEffect(() => {
    console.log('筛选条件变化，重新筛选数据', {
      sentimentFilter,
      displayImportantOnly,
      searchQuery,
      总数据条数: allNews.length
    });
    
    // 应用筛选
    let filtered = [...allNews];
    
    // 情感筛选
    if (sentimentFilter !== 'all') {
      filtered = filtered.filter(item => item.sentiment === sentimentFilter);
      console.log(`情感筛选后剩余${filtered.length}条`);
    }
    
    // 重要快讯筛选
    if (displayImportantOnly) {
      filtered = filtered.filter(item => 
        // 类别为"重大先机"
        item.category === '重大先机' || 
        // 或者标签中包含"焦点"
        (item.tags && item.tags.some(tag => tag.includes('焦点')))
      );
      console.log(`重要快讯筛选后剩余${filtered.length}条`);
    }
    
    // 搜索筛选
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item => 
        // 搜索内容
        item.content.toLowerCase().includes(query) ||
        // 搜索标题
        item.title.toLowerCase().includes(query) ||
        // 搜索标签
        (item.tags && item.tags.some(tag => tag.toLowerCase().includes(query))) ||
        // 搜索股票名称
        (item.stocks && item.stocks.some(stock => stock.name.toLowerCase().includes(query)))
      );
      console.log(`搜索"${query}"后剩余${filtered.length}条`);
    }
    
    setFilteredNews(filtered);
  }, [sentimentFilter, displayImportantOnly, searchQuery, allNews]);

  // 初始加载数据
  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    setPage(1);
    
    try {
      // 构建查询参数
      const params = new URLSearchParams({
        skip: '0',
        limit: ITEMS_PER_PAGE.toString(),
      });
      
      const response = await fetch(`http://localhost:8000/flashes/latest/?${params}`);
      let newsData: NewsItem[] = [];
      
      if (!response.ok) {
        console.log('API请求失败，使用模拟数据');
        newsData = getMockData();
      } else {
        const data = await response.json();
        if (!data || data.length === 0) {
          console.log('API返回空数据，使用模拟数据');
          newsData = getMockData();
        } else {
          newsData = data.map(adaptApiDataToNewsItem);
        }
      }
      
      // 检查新数据
      const currentIds = new Set(newsData.map(item => item.id));
      const prevIds = prevNewsIdsRef.current;
      
      // 如果不是第一次加载，检查是否有新数据并播放声音
      if (prevIds.size > 0) {
        const newItems = newsData.filter(item => !prevIds.has(item.id));
        
        if (newItems.length > 0) {
          console.log(`检测到${newItems.length}条新快讯`);
          
          // 检查是否有重要快讯
          const hasImportant = newItems.some(item => 
            item.category === '重大先机' || 
            (item.tags && item.tags.some(tag => tag.includes('焦点')))
          );
          
          // 获取主要情感 (简单处理：使用第一条新快讯的情感)
          const sentiment = newItems[0].sentiment;
          
          // 播放声音提醒
          notifyNewFlash(newItems.length, hasImportant, sentiment);
        }
      }
      
      // 更新之前的ID集合
      prevNewsIdsRef.current = currentIds;
      
      setAllNews(newsData);
      setHasMore(newsData.length >= ITEMS_PER_PAGE);
    } catch (err) {
      console.error('获取数据失败:', err);
      // 使用模拟数据
      const mockData = getMockData();
      setAllNews(mockData);
      setError('获取数据失败，显示模拟数据');
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 加载更多数据
  const loadMoreData = async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    console.log(`加载更多数据，页码: ${page + 1}`);
    
    try {
      // 构建查询参数
      const params = new URLSearchParams({
        skip: (page * ITEMS_PER_PAGE).toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      
      const response = await fetch(`http://localhost:8000/flashes/latest/?${params}`);
      let newItems: NewsItem[] = [];
      
      if (!response.ok) {
        console.log('加载更多失败，API错误');
        setHasMore(false);
      } else {
        const data = await response.json();
        if (!data || data.length === 0) {
          console.log('没有更多数据');
          setHasMore(false);
        } else {
          newItems = data.map(adaptApiDataToNewsItem);
          
          // 去除已经存在的项目，避免重复ID
          const existingIds = new Set(allNews.map(item => item.id));
          const uniqueNewItems = newItems.filter(item => !existingIds.has(item.id));
          
          console.log(`获取到${newItems.length}条新数据，过滤重复后剩余${uniqueNewItems.length}条`);
          
          if (uniqueNewItems.length === 0) {
            console.log('没有新的唯一数据了');
            setHasMore(false);
          } else {
            setAllNews(prev => [...prev, ...uniqueNewItems]);
            setPage(prev => prev + 1);
            setHasMore(uniqueNewItems.length >= ITEMS_PER_PAGE);
          }
        }
      }
    } catch (err) {
      console.error('加载更多失败:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // 处理筛选器变化
  const handleSentimentFilterChange = (value: string) => {
    console.log('情感筛选条件变为:', value);
    setSentimentFilter(value);
  };

  // 处理只看重要快讯的变化
  const handleDisplayImportantOnlyChange = (value: boolean) => {
    console.log('只看重要快讯变为:', value);
    setDisplayImportantOnly(value);
  };
  
  // 处理搜索变化（带防抖）
  const handleSearchChange = (value: string) => {
    console.log('搜索输入:', value);
    setSearchInput(value);
  };
  
  // 处理手动刷新
  const handleRefresh = () => {
    console.log('手动刷新数据...');
    loadInitialData();
  };

  return (
    <MainLayout 
      sentimentFilter={sentimentFilter}
      onSentimentFilterChange={handleSentimentFilterChange}
      displayImportantOnly={displayImportantOnly}
      onDisplayImportantOnlyChange={handleDisplayImportantOnlyChange}
      searchQuery={searchInput}
      onSearchChange={handleSearchChange}
      onRefresh={handleRefresh}
    >
      {/* 内容区域 */}
      <div className="container mx-auto px-4 py-4">
        {/* 加载状态 */}
        {isLoading && filteredNews.length === 0 && (
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
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded my-4 text-sm">
          <p>{error}</p>
        </div>
      )}

        {/* 无数据提示 */}
        {!isLoading && !error && filteredNews.length === 0 && (
          <div className="text-center py-6">
            <svg className="h-10 w-10 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-gray-600 text-sm">暂无符合条件的数据</p>
        </div>
      )}

        {/* 新闻卡片列表 */}
        <div className="grid grid-cols-1 gap-4">
          {filteredNews.map((item, index) => {
            // 只在最后一个元素上设置ref，用于触发无限滚动
            const isLastElement = index === filteredNews.length - 1;
            
            return (
              <div 
                key={`${item.id}_${index}`} 
                ref={isLastElement ? lastNewsElementRef : null}
                className="animate-fadeIn" // 添加淡入动画效果
              >
                <NewsCard news={item} />
              </div>
            );
          })}
        </div>
              
        {/* 加载更多状态 */}
        {isLoadingMore && (
          <div className="text-center py-4">
            <svg className="animate-spin h-5 w-5 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-500 text-sm mt-1">加载更多...</p>
                    </div>
                  )}

        {/* 全部加载完毕提示 */}
        {!isLoading && !hasMore && filteredNews.length > 0 && (
          <div className="text-center py-4 text-gray-500 text-sm">
            已经到底啦，没有更多快讯了
            </div>
        )}
    </div>
    </MainLayout>
  );
}
