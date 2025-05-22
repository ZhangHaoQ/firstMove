"use client";
import Image from 'next/image';

interface SentimentBadgeProps {
  sentiment: 'positive' | 'neutral' | 'negative';
  className?: string;
  categoryText?: string; // 如 "重大先机"
  isSentimentOnly?: boolean; // 是否只显示情感标签（积极、中性、消极）
}

export default function SentimentBadge({ sentiment, className = '', categoryText, isSentimentOnly = false }: SentimentBadgeProps) {
  // 根据情感类型确定样式和文本
  const getBadgeConfig = () => {
    // 如果只显示情感标签
    if (isSentimentOnly) {
      switch (sentiment) {
        case 'positive':
          return {
            text: '积极',
            bgClass: 'bg-red-100',
            textClass: 'text-red-600',
            icon: '📈 ',
            arrowIcon: (
              <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            )
          };
        case 'neutral':
          return {
            text: '中性',
            bgClass: 'bg-gray-100',
            textClass: 'text-gray-600',
            icon: '⚖️ ',
            arrowIcon: (
              <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
              </svg>
            )
          };
        case 'negative':
          return {
            text: '消极',
            bgClass: 'bg-green-100',
            textClass: 'text-green-600',
            icon: '📉 ',
            arrowIcon: (
              <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )
          };
        default:
          return {
            text: '未知',
            bgClass: 'bg-gray-100',
            textClass: 'text-gray-600',
            icon: '',
            arrowIcon: null
          };
      }
    }
    
    // 1. 分类标签配置
    if (categoryText) {
      switch (categoryText) {
        case '重大先机':
          return {
            text: categoryText,
            bgClass: 'bg-orange-500',
            textClass: 'text-white',
            icon: <Image src="/zdxj.svg" alt="重大先机" width={14} height={14} className="mr-0.5" />,
            arrowIcon: null
          };
        case '行业趋势':
          return {
            text: categoryText,
            bgClass: 'bg-blue-500',
            textClass: 'text-white',
            icon: <Image src="/hydt.svg" alt="行业趋势" width={14} height={14} className="mr-0.5" />,
            arrowIcon: null
          };
        // 已移除风险警示相关的分类
        case '市场看点':
          return {
            text: categoryText,
            bgClass: 'bg-purple-500',
            textClass: 'text-white',
            icon: <Image src="/sckd.svg" alt="市场看点" width={14} height={14} className="mr-0.5" />,
            arrowIcon: null
          };
        case '政策动态':
          return {
            text: categoryText,
            bgClass: 'bg-amber-500',
            textClass: 'text-white',
            icon: <Image src="/zc.svg" alt="政策动态" width={14} height={14} className="mr-0.5" />,
            arrowIcon: null
          };
        case '其他':
          return {
            text: categoryText,
            bgClass: 'bg-gray-500',
            textClass: 'text-white',
            icon: <Image src="/qt.svg" alt="其他" width={14} height={14} className="mr-0.5" />,
            arrowIcon: null
          };
        default:
          return {
            text: categoryText,
            bgClass: 'bg-gray-500',
            textClass: 'text-white',
            icon: 'ℹ️ ',
            arrowIcon: null
          };
      }
    }
    
    // 2. 情感标签配置（当没有分类文本时）
    switch (sentiment) {
      case 'positive':
        return {
          text: '积极',
          bgClass: 'bg-green-500',
          textClass: 'text-white',
          icon: '📈 ',
          arrowIcon: null
        };
      case 'neutral':
        return {
          text: '中性',
          bgClass: 'bg-blue-500',
          textClass: 'text-white',
          icon: '⚖️ ',
          arrowIcon: null
        };
      case 'negative':
        return {
          text: '消极',
          bgClass: 'bg-red-500',
          textClass: 'text-white',
          icon: '📉 ',
          arrowIcon: null
        };
      default:
        return {
          text: '未知',
          bgClass: 'bg-gray-100',
          textClass: 'text-gray-600',
          icon: '',
          arrowIcon: null
        };
    }
  };

  const { text, bgClass, textClass, icon, arrowIcon } = getBadgeConfig();

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${bgClass} ${textClass} ${className}`}>
      {isSentimentOnly && arrowIcon ? arrowIcon : (icon && icon)}
      {text}
    </span>
  );
} 