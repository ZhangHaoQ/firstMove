"use client";

import Header from './Header';
import DateTimeBar from './DateTimeBar';
import { MarketPanel } from '../market/MarketPanel';
import { MarketProvider } from '@/contexts/MarketContext';

interface MainLayoutProps {
  children: React.ReactNode;
  sentimentFilter: string;
  onSentimentFilterChange: (value: string) => void;
  displayImportantOnly: boolean;
  onDisplayImportantOnlyChange: (value: boolean) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onRefresh?: () => void;
}

export default function MainLayout({ 
  children,
  sentimentFilter,
  onSentimentFilterChange,
  displayImportantOnly,
  onDisplayImportantOnlyChange,
  searchQuery,
  onSearchChange,
  onRefresh
}: MainLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 头部导航 */}
      <Header />
      
      {/* 日期时间栏 */}
      <DateTimeBar 
        sentimentFilter={sentimentFilter}
        onSentimentFilterChange={onSentimentFilterChange}
        displayImportantOnly={displayImportantOnly}
        onDisplayImportantOnlyChange={onDisplayImportantOnlyChange}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onRefresh={onRefresh}
      />
      
      {/* 主内容区域 - 居中两侧留白 */}
      <div className="flex-1 overflow-hidden">
        <div className="container mx-auto flex h-full">
          {/* 左侧新闻区域 */}
          <main className="flex-1 overflow-y-auto px-4 py-4">
            {children}
          </main>
          
          {/* 右侧行情区域 */}
          <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto p-4 hidden lg:block">
            <MarketProvider>
              <MarketPanel />
            </MarketProvider>
          </div>
        </div>
      </div>
    </div>
  );
} 