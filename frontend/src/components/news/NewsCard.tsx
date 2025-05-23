"use client";

import SentimentBadge from './SentimentBadge';
import TopicTag from './TopicTag';
import StockPriceChange from '../stocks/StockPriceChange';

// 定义关联股票接口
interface AssociatedStock {
  name: string;
  symbol: string;
  market: string;
  changePercent?: number;
}

// 定义分析结果中的核心观点
interface CoreInsight {
  summary?: string;
  keyPoint?: string;
}

// 定义新闻接口
interface NewsItem {
  id: string;
  title: string;
  content: string;
  publishTime: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  tags: string[];
  stocks: AssociatedStock[];
  coreInsight?: CoreInsight;
  category?: string; // 例如：重大先机，行业趋势等
}

interface NewsCardProps {
  news: NewsItem;
}

export default function NewsCard({ news }: NewsCardProps) {
  // 格式化时间为24小时制时间，精确到秒
  const formatExactTime = (dateString: string) => {
    const date = new Date(dateString);
    
    // 格式化为24小时制：小时:分钟:秒
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
  };

  // 获取基于情感的样式
  const getSentimentStyles = () => {
    const category = news.category || '';
    
    // 基于分类设置边框和背景颜色
    switch (category) {
      case '重大先机':
        return {
          borderColor: 'border-orange-500',
          bgColor: 'bg-orange-50'
        };
      case '行业趋势':
        return {
          borderColor: 'border-blue-500',
          bgColor: 'bg-blue-50'
        };
      case '股票预警':
        return {
          borderColor: 'border-red-500',
          bgColor: 'bg-red-50'
        };
      case '市场看点':
        return {
          borderColor: 'border-purple-500',
          bgColor: 'bg-purple-50'
        };
      case '政策动态':
        return {
          borderColor: 'border-amber-500',
          bgColor: 'bg-amber-50'
        };
      case '其他':
        return {
          borderColor: 'border-gray-500',
          bgColor: 'bg-gray-50'
        };
      default:
        // 如果没有分类，则基于情感设置样式
        switch (news.sentiment) {
          case 'positive':
            return {
              borderColor: 'border-green-500',
              bgColor: 'bg-green-50'
            };
          case 'neutral':
            return {
              borderColor: 'border-blue-500',
              bgColor: 'bg-blue-50'
            };
          case 'negative':
            return {
              borderColor: 'border-red-500',
              bgColor: 'bg-red-50'
            };
          default:
            return {
              borderColor: 'border-gray-300',
              bgColor: 'bg-gray-50'
            };
        }
    }
  };

  // 渲染相关股票
  const renderStocks = () => {
    if (!news.stocks || news.stocks.length === 0) return null;
    
    return (
      <div className="w-full">
        {/* 股票标签区域 - 使用两行固定布局 */}
        <div className="flex flex-wrap gap-1.5 max-h-[52px]">
          {news.stocks.map((stock, index) => (
            <StockPriceChange 
              key={index}
              name={stock.name}
              code={stock.symbol}
              changePercent={stock.changePercent}
            />
          ))}
        </div>
      </div>
    );
  };

  const sentimentStyles = getSentimentStyles();

  // 定义生成标题的函数
  const generateTitle = () => {
    // 如果正文较短（少于50个字符），直接使用正文作为标题
    if (news.content && news.content.length < 50) {
      return news.content;
    }
    
    // news.title现在包含了LLM生成的标题或内容的前缀
    return news.title;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden mb-4">
      {/* 卡片头部 */}
      <div className="p-3 pb-2">
        <div className="flex justify-between items-start mb-2.5">
          {/* 左侧：分类标签和情感标签 */}
          <div className="flex space-x-2">
            {/* 分类标签 */}
            <SentimentBadge 
              sentiment={news.sentiment} 
              categoryText={news.category}
              className="category-badge"
            />
            
            {/* 情感标签 */}
            <SentimentBadge 
              sentiment={news.sentiment} 
              isSentimentOnly={true}
            />
          </div>
          
          {/* 右侧：发布时间 */}
          <span className="text-xs text-gray-400">
            {formatExactTime(news.publishTime)}
          </span>
        </div>
        
        {/* 生成的标题 - 使用更大字体和加粗 */}
        <h2 className="text-lg font-semibold text-gray-900 mb-3 leading-tight">
          {generateTitle()}
        </h2>
        
        {/* 核心观点 - 增大字体并调整样式使其更醒目 */}
        {news.coreInsight && news.coreInsight.keyPoint && (
          <div className={`mb-3 border-l-4 ${sentimentStyles.borderColor} px-3 py-2 ${sentimentStyles.bgColor} rounded`}>
            <p className="text-sm text-gray-800 leading-snug">
              <span className="font-semibold">核心观点：</span>
              {news.coreInsight.keyPoint}
            </p>
          </div>
        )}
        
        {/* 快讯原文 - 直接显示完整内容 */}
        <div className="text-xs text-gray-600 mb-3 leading-relaxed">
          <p>{news.content}</p>
        </div>
      </div>
      
      {/* 标签列表 - 由LLM分析生成的标签 */}
      <div className="px-3 pb-2">
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {news.tags.map((tag, index) => (
            <TopicTag key={index} text={tag} />
          ))}
        </div>
      </div>
      
      {/* 底部：股票和操作按钮 */}
      <div className="px-3 py-2 bg-gray-50 flex justify-between items-center">
        {/* 左侧：关联股票 - 两行固定布局 */}
        <div className="flex-1 overflow-hidden">
          {renderStocks()}
        </div>
        
        {/* 右侧：操作按钮 - 暂时隐藏未实现的功能 */}
        {/* <div className="flex gap-1.5 ml-2 flex-shrink-0">
          <button 
            onClick={toggleBookmark}
            className={`p-0.5 rounded-full ${isBookmarked ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-gray-500'}`}
            title={isBookmarked ? "取消收藏" : "收藏"}
          >
            <svg className="w-4 h-4" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isBookmarked ? 0 : 2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
          
          <button 
            onClick={handleShare}
            className="p-0.5 rounded-full text-gray-400 hover:text-gray-500"
            title="分享"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
          
          <button 
            className="p-0.5 rounded-full text-gray-400 hover:text-gray-500"
            title="更多操作"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div> */}
      </div>
    </div>
  );
} 