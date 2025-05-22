import React from 'react';
import { MarketIndex } from '@/types/market';
import { cn } from '@/lib/utils';

interface MarketIndexItemProps {
  index: MarketIndex;
  isSelected?: boolean;
  onClick?: () => void;
}

export const MarketIndexItem: React.FC<MarketIndexItemProps> = ({
  index,
  isSelected = false,
  onClick = () => {}
}) => {
  const isPositive = index.change > 0;
  const isNegative = index.change < 0;
  const isZero = index.change === 0;
  
  // 格式化价格，根据精度
  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };
  
  // 格式化变化量
  const formatChange = (change: number) => {
    return (change >= 0 ? '+' : '') + change.toFixed(2);
  };
  
  // 格式化变化率
  const formatChangePercent = (percent: number) => {
    return (percent >= 0 ? '+' : '') + percent.toFixed(2) + '%';
  };
  
    return (
    <div 
      className={cn(
        "flex flex-col py-3 px-4 cursor-default hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0",
        isSelected && "bg-gray-50"
      )}
      onClick={onClick}
    >
      <div className="flex justify-between items-center mb-1.5">
        <span className="font-medium text-gray-800 text-sm">{index.name}</span>
        <span 
          className={cn(
            "text-base font-semibold tabular-nums",
            isPositive && "text-red-600", // 涨为红色
            isNegative && "text-green-600", // 跌为绿色
            isZero && "text-gray-500"
          )}
        >
          {formatPrice(index.price)}
        </span>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400">{index.code}</span>
        <div className="flex items-center gap-3 tabular-nums">
          <span 
            className={cn(
              "text-xs",
              isPositive && "text-red-600", // 涨为红色
              isNegative && "text-green-600", // 跌为绿色
              isZero && "text-gray-500"
            )}
          >
            {formatChange(index.change)}
          </span>
          <span 
            className={cn(
              "text-xs min-w-[55px] text-right",
              isPositive && "text-red-600", // 涨为红色
              isNegative && "text-green-600", // 跌为绿色
              isZero && "text-gray-500"
            )}
          >
            {formatChangePercent(index.changePercent)}
          </span>
        </div>
      </div>
    </div>
  );
}; 