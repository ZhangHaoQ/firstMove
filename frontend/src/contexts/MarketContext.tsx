import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MarketIndex } from '@/types/market';
import { fetchMarketIndices } from '@/services/marketService';

interface MarketContextType {
  marketIndices: MarketIndex[];
  isLoading: boolean;
  error: string | null;
  refreshMarketData: () => Promise<void>;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

interface MarketProviderProps {
  children: ReactNode;
  refreshInterval?: number; // 刷新间隔，单位毫秒
}

export const MarketProvider: React.FC<MarketProviderProps> = ({ 
  children, 
  refreshInterval = 60000 // 默认1分钟刷新一次
}) => {
  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 获取市场指标数据
  const fetchMarketData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const indices = await fetchMarketIndices();
      setMarketIndices(indices);
    } catch (err) {
      setError('获取市场数据失败');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 刷新市场数据
  const refreshMarketData = async () => {
    await fetchMarketData();
  };

  // 初始加载和定时刷新
  useEffect(() => {
    refreshMarketData();
    
    // 设置定时刷新
    const intervalId = setInterval(refreshMarketData, refreshInterval);
    
    return () => clearInterval(intervalId);
  }, [refreshInterval]);

  const value = {
    marketIndices,
    isLoading,
    error,
    refreshMarketData
  };

  return (
    <MarketContext.Provider value={value}>
      {children}
    </MarketContext.Provider>
  );
};

// 自定义Hook，用于访问市场上下文
export const useMarket = (): MarketContextType => {
  const context = useContext(MarketContext);
  if (context === undefined) {
    throw new Error('useMarket must be used within a MarketProvider');
  }
  return context;
}; 