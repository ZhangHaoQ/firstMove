"use client";

import { useState, useEffect, useCallback } from 'react';
import FilterDropdown, { SENTIMENT_FILTER_OPTIONS } from '@/components/filters/FilterDropdown';
import SettingsModal from '@/components/settings/SettingsModal';
import { Clock } from 'lucide-react';

interface DateTimeBarProps {
  sentimentFilter: string;
  onSentimentFilterChange: (value: string) => void;
  displayImportantOnly: boolean;
  onDisplayImportantOnlyChange: (value: boolean) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onRefresh?: () => void;
}

export default function DateTimeBar({
  sentimentFilter,
  onSentimentFilterChange,
  displayImportantOnly,
  onDisplayImportantOnlyChange,
  searchQuery,
  onSearchChange,
  onRefresh
}: DateTimeBarProps) {
  const [currentDateTime, setCurrentDateTime] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    // 标记客户端已挂载
    setIsMounted(true);
  }, []);
  
  // 更新日期时间
  const updateDateTime = useCallback(() => {
    if (!isMounted) return; // 再次检查，确保安全
    
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      month: 'numeric', 
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    
    try {
      // 格式化为：09月20日，星期三，23:21:06
      const formatted = now.toLocaleDateString('zh-CN', options)
        .replace(/\//g, '月')
        .replace(/,/g, '日，');
      setCurrentDateTime(formatted);
    } catch (error) {
      console.error("Error formatting date:", error);
      // 作为备用，显示一个更简单的格式或者错误提示
      setCurrentDateTime(now.toLocaleString('zh-CN') + " (格式化错误)");
    }
  }, [isMounted]);
  
  useEffect(() => {
    if (!isMounted) return; // 确保组件已挂载

    // 设置日期时间
    updateDateTime();
    
    // 每秒更新一次
    const timer = setInterval(() => {
      updateDateTime();
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isMounted, updateDateTime]); // 添加updateDateTime依赖
  
  // 切换仅显示勾选状态
  const toggleDisplayOnly = () => {
    onDisplayImportantOnlyChange(!displayImportantOnly);
  };

  // 处理搜索框变化
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  };
  
  // 清除搜索内容
  const clearSearch = () => {
    onSearchChange('');
  };
  
  // 处理刷新点击
  const handleRefresh = () => {
    if (!onRefresh || isRefreshing) return;
    
    setIsRefreshing(true);
    
    // 执行刷新
    onRefresh();
    
    // 刷新动画持续时间
    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  };
  
  // 打开设置模态框
  const openSettings = () => {
    setIsSettingsOpen(true);
  };
  
  // 关闭设置模态框
  const closeSettings = () => {
    setIsSettingsOpen(false);
  };
  
  return (
    <>
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-1.5 flex items-center">
          {/* 左侧：时间和自动刷新 */}
          <div className="flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
            <span className="text-xs text-gray-600">{isMounted ? currentDateTime : "加载中..."}</span>
            <span className="mx-2 text-gray-300">|</span>
            <span className="text-xs text-gray-600">
              {/* 临时注释自动刷新，避免重复请求
              <GlobalUpdateTimer 
                onTimeUp={onRefresh}
                showIcon={false}
                hideLastUpdate={true}
              />
              */}
              手动刷新模式
            </span>
          </div>
          
          {/* 中间：弹性空间 */}
          <div className="flex-1"></div>
          
          {/* 搜索框 */}
          <div className="relative mx-4 w-72">
            <input
              type="text"
              placeholder="搜索快讯..."
              value={searchQuery}
              onChange={handleSearchInputChange}
              className="w-full text-sm py-1.5 pl-8 pr-8 rounded-md border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-500 focus:bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-200 focus:text-gray-900 transition-colors"
            />
            <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button 
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={clearSearch}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          {/* 右侧：筛选和按钮 */}
          <div className="flex items-center space-x-2">
            {/* 情感筛选下拉菜单 */}
            <div className="flex items-center space-x-1">
              <span className="text-xs text-gray-500">情感:</span>
              <FilterDropdown 
                label="全部情绪" 
                options={SENTIMENT_FILTER_OPTIONS} 
                value={sentimentFilter} 
                onChange={onSentimentFilterChange}
                small={true}
              />
            </div>
            
            {/* 重要快讯开关 */}
            <div 
              className={`flex items-center px-2 py-0.5 rounded-md cursor-pointer transition-colors border ${displayImportantOnly ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
              onClick={toggleDisplayOnly}
            >
              {displayImportantOnly ? (
                <svg className="w-3 h-3 mr-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
              <span className="text-xs font-medium">重要快讯</span>
            </div>
            
            {/* 刷新和设置按钮 */}
            <button 
              className={`flex items-center justify-center h-6 w-6 rounded-md transition-colors ${isRefreshing ? 'bg-blue-100 text-blue-600' : 'bg-gray-50 border border-gray-200 text-gray-500 hover:text-blue-500'}`}
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="刷新数据"
            >
              <svg 
                className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            
            <button 
              className="flex items-center justify-center h-6 w-6 rounded-md bg-gray-50 border border-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
              onClick={openSettings}
              title="设置"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* 设置模态框 */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={closeSettings}
      />
    </>
  );
} 