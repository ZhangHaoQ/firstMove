"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import NewsCard from '@/components/news/NewsCard';
import { useNotification } from '@/contexts/NotificationContext';
import { fetchLatestNews, fetchMoreNews, NewsItem } from '@/services/newsService';

// 股票接口
interface Stock {
  name: string;
  symbol: string;
  market: string;
}

// 主页组件
export default function Home() {
  // 状态管理
  const [allNews, setAllNews] = useState<NewsItem[]>([]);
  const [filteredNews, setFilteredNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  
  // 筛选状态
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [displayImportantOnly, setDisplayImportantOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  
  // 引用和常量
  const lastNewsElementRef = useRef<HTMLDivElement>(null);
  const prevNewsIdsRef = useRef<Set<string>>(new Set());
  const ITEMS_PER_PAGE = 20;
  
  // 通知功能
  const { notifyNewFlash } = useNotification();

  // 初始加载数据
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setPage(1);
    
    try {
      const newsData = await fetchLatestNews(ITEMS_PER_PAGE);
      
      // 检查新数据
      const currentIds = new Set(newsData.map((item: NewsItem) => item.id));
      const prevIds = prevNewsIdsRef.current;
      
      // 如果不是第一次加载，检查是否有新数据并播放声音
      if (prevIds.size > 0) {
        const newItems = newsData.filter(item => !prevIds.has(item.id));
        
        if (newItems.length > 0) {
          // console.log(`检测到${newItems.length}条新快讯`);
          
          // 检查是否有重要快讯
          const hasImportant = newItems.some(item => 
            item.category === '重大先机' || 
            (item.tags && item.tags.some((tag: string) => tag.includes('焦点')))
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
      setError('获取数据失败，显示模拟数据');
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [notifyNewFlash, ITEMS_PER_PAGE]);

  // 加载更多数据
  const loadMoreData = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    //console.log(`加载更多数据，页码: ${page + 1}`);
    
    try {
      const newItems = await fetchMoreNews(page, ITEMS_PER_PAGE);
      
      if (!newItems || newItems.length === 0) {
        //console.log('没有更多数据');
        setHasMore(false);
      } else {
        // 去除已经存在的项目，避免重复ID
        const existingIds = new Set(allNews.map((item: NewsItem) => item.id));
        const uniqueNewItems = newItems.filter(item => !existingIds.has(item.id));
        
        //console.log(`获取到${newItems.length}条新数据，过滤重复后剩余${uniqueNewItems.length}条`);
        
        if (uniqueNewItems.length === 0) {
          //console.log('没有新的唯一数据了');
          setHasMore(false);
        } else {
          setAllNews((prev: NewsItem[]) => [...prev, ...uniqueNewItems]);
          setPage((prev: number) => prev + 1);
          setHasMore(uniqueNewItems.length >= ITEMS_PER_PAGE);
        }
      }
    } catch (err) {
      //console.error('加载更多失败:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, page, allNews, ITEMS_PER_PAGE]);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 初始加载
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 无限滚动
  useEffect(() => {
    const currentRef = lastNewsElementRef.current; // 复制ref到变量
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMoreData();
        }
      },
      { threshold: 1.0 }
    );

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, isLoadingMore, loadMoreData]);

  // 筛选逻辑
  useEffect(() => {
    let filtered = [...allNews];
    
    // 情感筛选
    if (sentimentFilter !== 'all') {
      filtered = filtered.filter(item => item.sentiment === sentimentFilter);
      //console.log(`情感筛选"${sentimentFilter}"后剩余${filtered.length}条`);
    }
    
    // 重要快讯筛选
    if (displayImportantOnly) {
      filtered = filtered.filter(item => 
        item.category === '重大先机' || 
        (item.tags && item.tags.some((tag: string) => tag.includes('焦点')))
      );
      //console.log(`重要快讯筛选后剩余${filtered.length}条`);
    }
    
    // 搜索筛选
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item => 
        // 搜索标题
        item.title.toLowerCase().includes(query) ||
        // 搜索内容
        item.content.toLowerCase().includes(query) ||
        // 搜索标签
        (item.tags && item.tags.some((tag: string) => tag.toLowerCase().includes(query))) ||
        // 搜索股票名称
        (item.stocks && item.stocks.some((stock: Stock) => stock.name.toLowerCase().includes(query)))
      );
      //console.log(`搜索"${query}"后剩余${filtered.length}条`);
    }
    
    setFilteredNews(filtered);
  }, [sentimentFilter, displayImportantOnly, searchQuery, allNews]);

  // 处理筛选器变化
  const handleSentimentFilterChange = (value: string) => {
    //console.log('情感筛选条件变为:', value);
    setSentimentFilter(value);
  };

  // 处理只看重要快讯的变化
  const handleDisplayImportantOnlyChange = (value: boolean) => {
    //console.log('只看重要快讯变为:', value);
    setDisplayImportantOnly(value);
  };
  
  // 处理搜索变化（带防抖）
  const handleSearchChange = (value: string) => {
    //console.log('搜索输入:', value);
    setSearchInput(value);
  };
  
  // 处理手动刷新
  const handleRefresh = () => {
    //console.log('手动刷新数据...');
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
          {filteredNews.map((item: NewsItem, index: number) => {
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