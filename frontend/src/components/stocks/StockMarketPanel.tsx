"use client";

import { useState, useEffect } from 'react';

interface StockData {
  id: string;
  name: string;
  code: string;
  price: number;
  changePercent: number;
  volume?: string;
  market: string;
}

export default function StockMarketPanel() {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const categories = ['全部', 'A股', '港股', '美股'];

  // 模拟数据
  const mockStocks: StockData[] = [
    { id: '1', name: '美团', code: '03690', price: 100.23, changePercent: -0.13, volume: '1.23亿', market: '港股' },
    { id: '2', name: '腾讯控股', code: '00700', price: 350.60, changePercent: 1.21, volume: '2.5亿', market: '港股' },
    { id: '3', name: '贵州茅台', code: '600519', price: 1651.44, changePercent: 0.2, volume: '534万', market: 'A股' },
    { id: '4', name: '宁德时代', code: '300750', price: 144.60, changePercent: -0.79, volume: '2.1亿', market: 'A股' },
    { id: '5', name: '京东集团', code: 'JD', price: 32.79, changePercent: 1.52, volume: '1800万', market: '美股' },
    { id: '6', name: '阿里巴巴', code: 'BABA', price: 72.15, changePercent: -0.61, volume: '2300万', market: '美股' },
    { id: '7', name: '比亚迪', code: '002594', price: 241.89, changePercent: 2.35, volume: '1.7亿', market: 'A股' },
    { id: '8', name: '小米集团', code: '01810', price: 16.78, changePercent: 0.84, volume: '2.8亿', market: '港股' },
    { id: '9', name: '特斯拉', code: 'TSLA', price: 341.89, changePercent: 3.05, volume: '3200万', market: '美股' },
  ];

  useEffect(() => {
    // 模拟加载数据
    setTimeout(() => {
      setStocks(mockStocks);
      setLoading(false);
    }, 500);
  }, []);

  // 筛选股票
  const filteredStocks = selectedIndex === 0 
    ? stocks 
    : stocks.filter(stock => stock.market === categories[selectedIndex]);

  // 股票价格颜色
  const getPriceColor = (changePercent: number) => {
    if (changePercent > 0) return 'text-red-500';
    if (changePercent < 0) return 'text-green-500';
    return 'text-gray-500';
  };

  // 涨跌幅格式化
  const formatChangePercent = (changePercent: number) => {
    const prefix = changePercent > 0 ? '+' : '';
    return `${prefix}${changePercent.toFixed(2)}%`;
  };

  return (
    <div className="market-panel">
      {/* 分类选项卡 */}
      <div className="flex border-b border-gray-200 mb-3">
        {categories.map((category, index) => (
          <button
            key={index}
            className={`py-2 px-4 text-sm font-medium ${
              selectedIndex === index 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setSelectedIndex(index)}
          >
            {category}
          </button>
        ))}
      </div>

      {/* 股票列表 */}
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStocks.map((stock) => (
            <div key={stock.id} className="flex justify-between items-center py-2 border-b border-gray-100">
              <div>
                <div className="font-medium text-gray-800">{stock.name}</div>
                <div className="text-xs text-gray-500">{stock.code}</div>
              </div>
              <div className="text-right">
                <div className="font-medium">{stock.price}</div>
                <div className={`text-xs ${getPriceColor(stock.changePercent)}`}>
                  {formatChangePercent(stock.changePercent)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* 行情走势图 */}
      <div className="mt-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">大盘指数</h3>
        <div className="bg-gray-100 h-40 rounded flex items-center justify-center">
          <p className="text-sm text-gray-500">大盘走势图</p>
        </div>
      </div>
    </div>
  );
} 