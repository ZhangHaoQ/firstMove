"use client";

interface StockPriceChangeProps {
  name: string;
  code?: string;
  changePercent?: number;
  onClick?: () => void;
}

export default function StockPriceChange({ name, code, changePercent, onClick }: StockPriceChangeProps) {
  // 股票代码显示（如有）
  const displayCode = code ? `${code}` : '';
  
  // 根据涨跌幅判断颜色
  const getChangeClass = () => {
    if (!changePercent) return '';
    if (changePercent > 0) return 'bg-red-100 text-red-600 border-red-200'; 
    if (changePercent < 0) return 'bg-green-100 text-green-600 border-green-200';
    return '';
  };
  
  // 格式化涨跌幅
  const formatChange = () => {
    if (changePercent === undefined) return null;
    const sign = changePercent > 0 ? '+' : '';
    return `${sign}${changePercent.toFixed(2)}%`;
  };
  
  const changeClass = getChangeClass();
  
  return (
    <button 
      onClick={onClick}
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${changeClass || 'border-gray-200 hover:bg-gray-100'} transition-colors`}
      title={`${name} ${code || ''} ${formatChange() || ''}`} 
    >
      <span className={`mr-1 ${changeClass ? '' : 'text-gray-700'} whitespace-nowrap`}>{name}</span>
      {displayCode && <span className={`text-[10px] flex-shrink-0 ${changeClass ? '' : 'text-gray-400'}`}>{displayCode}</span>}
      {changePercent !== undefined && <span className="ml-1 font-medium">{formatChange()}</span>}
    </button>
  );
} 