"use client";

import { useEffect, useState, useRef } from 'react';
import Image from "next/image";

// Define TypeScript interfaces for our data structures

// Interface for the actual content of stock-specific analysis based on logs
interface StockSpecificAnalysisContent {
  analyzed_symbol: string;
  key_info_points?: string[];
  potential_impact?: string;
  attention_level?: string;
  reasoning?: string;
}

// Interface for the actual content of macro (market/industry) analysis based on logs
interface MacroAnalysisContent {
  key_macro_points?: string[];
  potential_market_impact?: string;
  outlook_tendency?: string;
  reasoning?: string;
}

interface LLMGeneralNewsNoAnalysis {
  reason: string;
}

interface LLMInsufficientInfoAnalysis {
  reason: string;
}

// Updated LLMAnalysis interface to match actual API response based on logs
interface LLMAnalysis {
  llm_model_used: string; // Changed from model_id to match log
  analysis_timestamp_utc: string;
  summary?: string; // Added from log
  sentiment?: string; // Added general sentiment from log
  analysis_type?: string; // Added from log
  success?: boolean; // Added from log
  error?: string | null; // Added from log

  stock_specific_analysis?: StockSpecificAnalysisContent; // Updated to new interface
  macro_analysis?: MacroAnalysisContent; // Changed key from market_and_industry_analysis and updated to new interface
  general_news_no_analysis?: LLMGeneralNewsNoAnalysis;
  insufficient_information_for_analysis?: LLMInsufficientInfoAnalysis;
  error_during_analysis?: { message: string }; // This was from our earlier definition, might be covered by top-level error
}

// Updated Flash interface to match actual API response based on logs
interface Flash {
  flash_id: string; // This is the unique ID from the API, e.g., "sina_live_4199411"
  content: string;
  publish_timestamp_utc: string; // API provides this as an ISO string
  crawl_timestamp_utc: string;
  source_name: string; // API provides source_name, not source
  source_api_url: string;
  tags: string[]; // API provides tags as an array of strings
  associated_symbols: Array<{ name: string; symbol: string; market: string }>; // API provides associated_symbols
  detail_url: string; // API provides detail_url
  raw_api_response_item?: object; // Or a more specific type if known later
  llm_analysis?: LLMAnalysis | null;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
// const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes for periodic refresh
const REFRESH_INTERVAL_MS = 60 * 1000; // Changed to 60 seconds for polling
const INITIAL_LOAD_LIMIT = 20; // Load 20 items initially and for refresh

function isFlashWithinLast24Hours(flashPublishTimestampUTC: string): boolean {
  return new Date(flashPublishTimestampUTC).getTime() >= (Date.now() - TWENTY_FOUR_HOURS_MS);
}

async function getFlashesLast24Hours(skip: number = 0, limit: number = INITIAL_LOAD_LIMIT): Promise<Flash[]> {
  const baseUrl = 'http://localhost:8000'; // FastAPI backend
  try {
    const res = await fetch(`${baseUrl}/flashes/latest/?skip=${skip}&limit=${limit}`); // This endpoint now returns last 24h data
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Failed to fetch flashes (last 24h). Status:", res.status, "Response:", errorText);
      throw new Error(`Failed to fetch flashes (last 24h). Status: ${res.status}. ${errorText}`);
    }
    return await res.json();
  } catch (error) {
    console.error("Error in getFlashesLast24Hours:", error);
    throw error;
  }
}

// Helper function to get sentiment-based styling
function getSentimentClasses(sentiment?: string | null): string {
  if (!sentiment) return ''; // Defaults to bg-white due to existing class on the div
  const lowerSentiment = sentiment.toLowerCase(); // Normalize to lowercase for matching

  if (lowerSentiment.includes('积极') || lowerSentiment.includes('正面') || lowerSentiment.includes('利好') || lowerSentiment.includes('看涨')) {
    return 'bg-green-50'; // Light green background
  }
  if (lowerSentiment.includes('消极') || lowerSentiment.includes('负面') || lowerSentiment.includes('利空') || lowerSentiment.includes('看跌')) {
    return 'bg-red-50';   // Light red background
  }
  if (lowerSentiment.includes('中性') || lowerSentiment.includes('中立')) {
    return 'bg-slate-100'; // Light slate background for neutral
  }
  return ''; // Default to bg-white by not overriding
}

export default function HomePage() {
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false); // New state for refresh
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadAndSetInitialFlashes = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setIsLoadingInitial(true);
    } else {
      setIsRefreshing(true); // Use new state for subsequent refreshes
    }
    try {
      const newFlashes = await getFlashesLast24Hours(0, INITIAL_LOAD_LIMIT);
      setFlashes(newFlashes);
      setError(null);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError('An unknown error occurred while fetching data.');
    } finally {
      if (isInitialLoad) {
        setIsLoadingInitial(false);
      }
      setIsRefreshing(false); // Always set refreshing to false
    }
  };

  // Initial data load
  useEffect(() => {
    loadAndSetInitialFlashes(true); // Pass true for initial load
  }, []);

  // Setup SSE connection
  /* // Commenting out the SSE useEffect block
  useEffect(() => {
    if (typeof window !== "undefined") {
      const sseUrl = 'http://localhost:8000/flashes/stream/';
      console.log(`Connecting to SSE at ${sseUrl}`);
      eventSourceRef.current = new EventSource(sseUrl);

      eventSourceRef.current.onopen = () => {
        console.log("SSE connection opened.");
        setError(null);
      };

      eventSourceRef.current.onmessage = (event) => {
        try {
          const newFlash = JSON.parse(event.data) as Flash;
          console.log("SSE message received:", newFlash.flash_id);
          if (isFlashWithinLast24Hours(newFlash.publish_timestamp_utc)) {
            setFlashes((prevFlashes) => {
              if (!prevFlashes.find(f => f.flash_id === newFlash.flash_id)) {
                // Add new flash to the beginning and re-sort by time (newest first)
                // Keep only flashes within 24h to be safe, though periodic refresh handles major pruning
                const updatedFlashes = [newFlash, ...prevFlashes]
                  .filter(f => isFlashWithinLast24Hours(f.publish_timestamp_utc))
                  .sort((a, b) => new Date(b.publish_timestamp_utc).getTime() - new Date(a.publish_timestamp_utc).getTime());
                return updatedFlashes.slice(0, 50); // Limit client-side list size for performance
              }
              return prevFlashes;
            });
          }
        } catch (parseError) {
          console.error("Error parsing SSE data:", parseError, "Raw data:", event.data);
        }
      };

      eventSourceRef.current.onerror = (err) => {
        console.error("SSE Error:", err);
        setError("Connection error with live updates. Auto-reconnect may occur.");
      };

      return () => {
        console.log("Closing SSE connection.");
        eventSourceRef.current?.close();
      };
    }
  }, []);
  */

  // Periodic refresh to ensure 24-hour window accuracy and prune old items
  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log("Periodic refresh: fetching latest 24h flashes...");
      loadAndSetInitialFlashes(); // Subsequent calls are not initial
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId); // Cleanup interval on unmount
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-12 bg-gray-50">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex mb-8">
        <div className="flex items-center"> {/* Wrapper for title and refresh indicator */}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4 md:mb-0 mr-4">
            AI 股票情报助手 - 最新快讯
          </h1>
          {isRefreshing && (
            <div className="mb-4 md:mb-0"> {/* Spinner or text, ensure vertical alignment */}
              <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* This block is only for the very first load when flashes array is empty essentially */}
      {isLoadingInitial && flashes.length === 0 && (
        <div className="w-full max-w-5xl p-4 text-center text-gray-500">
          <p>正在加载 {INITIAL_LOAD_LIMIT} 条最新快讯 (过去24小时)...</p>
        </div>
      )}

      {error && (
        <div className="w-full max-w-5xl p-4 mb-4 text-red-700 bg-red-100 border border-red-400 rounded">
          <p className="font-bold">发生错误:</p>
          <p>{error}</p>
        </div>
      )}

      {/* This is for when there are truly no flashes after initial load (and no error) */}
      {!isLoadingInitial && !error && flashes.length === 0 && (
        <div className="w-full max-w-5xl p-4 text-center text-gray-500">
          <p>过去24小时暂无最新快讯。</p> {/* Simplified message */}
        </div>
      )}

      {/* The list of flashes */}
      <div className="w-full max-w-5xl grid gap-6">
        {flashes.map((flash) => {
          const displayTitle = flash.content.substring(0, 70) + (flash.content.length > 70 ? '...' : '');
          const analysis = flash.llm_analysis;
          const sentimentClasses = analysis ? getSentimentClasses(analysis.sentiment) : '';

          return (
            <div 
              key={flash.flash_id} 
              className={`bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow ${sentimentClasses}`}
            >
              <div className="mb-3">
                <h2 className="text-xl font-semibold text-gray-900 mb-1">{displayTitle}</h2>
                <p className="text-xs text-gray-500">
                  发布时间: {new Date(flash.publish_timestamp_utc).toLocaleString()}
                </p>
                {flash.associated_symbols && flash.associated_symbols.length > 0 && (
                  <p className="text-xs text-indigo-600 mt-1">
                    相关股票: {flash.associated_symbols.map(s => `${s.name} (${s.symbol})`).join(', ')}
                  </p>
                )}
              </div>
              
              <a href={flash.detail_url || '#'} target="_blank" rel="noopener noreferrer" className="text-gray-700 mb-4 whitespace-pre-line hover:text-blue-600 block">
                {flash.content}
              </a>

              {analysis && (
                <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200">
                  <h3 className="text-md font-semibold text-gray-800 mb-2">AI 分析:</h3>
                  
                  {analysis.summary && (
                    <div className="mb-2 p-2 bg-blue-50 rounded">
                      <p className="font-medium text-blue-700">摘要:</p>
                      <p className="text-sm text-gray-700">{analysis.summary}</p>
                    </div>
                  )}
                  {analysis.sentiment && (
                    <div className="mb-3 p-2 bg-blue-50 rounded">
                      <p className="font-medium text-blue-700">总体倾向性:</p>
                      <p className="text-sm text-gray-700">{analysis.sentiment}</p>
                    </div>
                  )}

                  {analysis.stock_specific_analysis && (
                    <div className="mb-3 p-3 bg-indigo-50 rounded">
                      <p className="font-medium text-indigo-700">
                        个股分析:
                      </p>
                      {analysis.stock_specific_analysis.key_info_points && analysis.stock_specific_analysis.key_info_points.length > 0 && (
                        <div className="mt-1">
                          <p className="text-sm font-semibold text-gray-700">关键信息点:</p>
                          <ul className="list-disc list-inside text-sm text-gray-700">
                            {analysis.stock_specific_analysis.key_info_points.map((point, i) => <li key={`ki-${flash.flash_id}-${i}`}>{point}</li>)}
                          </ul>
                        </div>
                      )}
                      {analysis.stock_specific_analysis.potential_impact && (
                        <p className="text-sm text-gray-700 mt-1"><strong className="font-semibold">潜在影响:</strong> {analysis.stock_specific_analysis.potential_impact}</p>
                      )}
                      {analysis.stock_specific_analysis.attention_level && (
                        <p className="text-sm text-gray-700 mt-1"><strong className="font-semibold">关注级别:</strong> {analysis.stock_specific_analysis.attention_level}</p>
                      )}
                      {analysis.stock_specific_analysis.reasoning && (
                        <p className="text-sm text-gray-700 mt-1"><strong className="font-semibold">分析理由:</strong> {analysis.stock_specific_analysis.reasoning}</p>
                      )}
                    </div>
                  )}

                  {analysis.macro_analysis && (
                    <div className="mb-3 p-3 bg-sky-50 rounded">
                      <p className="font-medium text-sky-700">宏观/行业分析:</p>
                      {analysis.macro_analysis.key_macro_points && analysis.macro_analysis.key_macro_points.length > 0 && (
                        <div className="mt-1">
                          <p className="text-sm font-semibold text-gray-700">关键宏观信息点:</p>
                          <ul className="list-disc list-inside text-sm text-gray-700">
                            {analysis.macro_analysis.key_macro_points.map((point, i) => <li key={`km-${flash.flash_id}-${i}`}>{point}</li>)}
                          </ul>
                        </div>
                      )}
                      {analysis.macro_analysis.potential_market_impact && (
                        <p className="text-sm text-gray-700 mt-1"><strong className="font-semibold">潜在市场影响:</strong> {analysis.macro_analysis.potential_market_impact}</p>
                      )}
                      {analysis.macro_analysis.outlook_tendency && (
                        <p className="text-sm text-gray-700 mt-1"><strong className="font-semibold">展望倾向:</strong> {analysis.macro_analysis.outlook_tendency}</p>
                      )}
                      {analysis.macro_analysis.reasoning && (
                        <p className="text-sm text-gray-700 mt-1"><strong className="font-semibold">分析理由:</strong> {analysis.macro_analysis.reasoning}</p>
                      )}
                    </div>
                  )}

                  {analysis.general_news_no_analysis && (
                    <div className="p-3 bg-yellow-50 rounded mb-3">
                      <p className="font-semibold text-yellow-700">通用新闻（无深度分析）:</p>
                      <p className="text-sm text-gray-700">{analysis.general_news_no_analysis.reason}</p>
                    </div>
                  )}
                  {analysis.insufficient_information_for_analysis && (
                    <div className="p-3 bg-orange-50 rounded mb-3">
                      <p className="font-semibold text-orange-700">信息不足无法分析:</p>
                      <p className="text-sm text-gray-700">{analysis.insufficient_information_for_analysis.reason}</p>
                    </div>
                  )}
                  {(analysis.error || analysis.error_during_analysis) && (
                    <div className="p-3 bg-red-50 rounded">
                      <p className="font-semibold text-red-700">分析时发生错误:</p>
                      <p className="text-sm text-gray-700">
                        {analysis.error || (analysis.error_during_analysis && analysis.error_during_analysis.message) || '未知分析错误'}
                      </p>
                    </div>
                  )}
                  {analysis.analysis_timestamp_utc && (
                     <p className="text-xs text-gray-400 mt-3">分析时间: {new Date(analysis.analysis_timestamp_utc).toLocaleString()}</p>
                  )}
                </div>
              )}
            </div>
          )}
        )}
    </div>
    </main>
  );
}
