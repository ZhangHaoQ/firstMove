import React from 'react';
import { MarketIndexItem } from './MarketIndexItem';
import { useMarket } from '@/contexts/MarketContext';
import { RefreshCcw } from 'lucide-react';

export const MarketPanel: React.FC = () => {
  const { 
    marketIndices, 
    isLoading, 
    error, 
    refreshMarketData 
  } = useMarket();

  const handleRefresh = async () => {
    await refreshMarketData();
  };

  return (
    <div className="border border-gray-200 rounded-lg shadow-sm overflow-hidden h-full flex flex-col bg-white">
      {/* 标题栏 */}
      <div className="flex justify-between items-center px-4 py-2.5 border-b border-gray-200 bg-white">
        <h3 className="font-medium text-gray-700 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>
          A股指数
        </h3>
        <div className="flex items-center">
          <button 
            onClick={handleRefresh}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="立即刷新行情"
          >
            <RefreshCcw 
              size={14} 
              className={`${isLoading ? 'animate-spin' : ''}`} 
            />
          </button>
        </div>
      </div>

      {/* 指标列表 */}
      <div className="flex-1 overflow-y-auto relative">
        {error && (
          <div className="text-red-500 text-center py-4 text-sm">
            {error}
          </div>
        )}
        
        {!error && marketIndices.length === 0 && !isLoading && (
          <div className="text-gray-400 text-center py-4 text-sm">
            暂无市场数据
          </div>
        )}
        
        {isLoading && marketIndices.length === 0 && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-500"></div>
          </div>
        )}
        
        {/* 加载遮罩 - 用于数据刷新时 */}
        {/* 移除加载指示器，避免频繁更新时出现圆环
        {isLoading && marketIndices.length > 0 && (
          <div className="absolute top-0 right-0 mt-2 mr-2">
            <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-200 border-t-blue-500"></div>
          </div>
        )}
        */}
        
        <div>
          {marketIndices.map((index) => (
            <MarketIndexItem
              key={index.code}
              index={index}
              isSelected={false}
              onClick={() => {}}
            />
          ))}
        </div>
      </div>
    </div>
  );
}; 