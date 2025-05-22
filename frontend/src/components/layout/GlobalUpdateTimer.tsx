"use client";

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface GlobalUpdateTimerProps {
  interval?: number; // 更新间隔，单位秒，默认60秒
  onTimeUp?: () => void; // 倒计时结束时的回调
  showIcon?: boolean; // 是否显示图标，默认为 true
  hideLastUpdate?: boolean; // 是否隐藏上次更新时间，默认为 false
}

const GlobalUpdateTimer: React.FC<GlobalUpdateTimerProps> = ({
  interval = 60,
  onTimeUp,
  showIcon = true, // 默认显示图标
  hideLastUpdate = false, // 默认显示上次更新时间
}) => {
  const [nextUpdateIn, setNextUpdateIn] = useState<number>(interval);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  // 客户端挂载检测
  useEffect(() => {
    setIsMounted(true);
    setLastUpdated(new Date());
  }, []);

  // 重置计时器
  const resetTimer = () => {
    setLastUpdated(new Date());
    setNextUpdateIn(interval);
  };

  // 倒计时逻辑
  useEffect(() => {
    if (!isMounted || !lastUpdated) return;
    
    const timer = setInterval(() => {
      const secondsElapsed = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
      const secondsRemaining = interval - secondsElapsed;
      
      if (secondsRemaining <= 0) {
        // 触发回调
        if (onTimeUp) onTimeUp();
        
        // 重置计时器
        resetTimer();
      } else {
        setNextUpdateIn(secondsRemaining);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [interval, lastUpdated, onTimeUp, isMounted]);

  // 格式化最后更新时间
  const formatLastUpdated = () => {
    if (!lastUpdated || !isMounted) return "加载中...";
    
    return lastUpdated.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className={`flex items-center ${!hideLastUpdate ? 'bg-gray-50 px-3 py-1.5 rounded-md border border-gray-100' : ''}`}>
      {showIcon && <Clock className="w-3.5 h-3.5 text-gray-500 mr-2" />}
      <div className="flex flex-col">
        <span className="text-xs font-medium text-gray-700">{isMounted ? `${nextUpdateIn}秒后自动更新` : "加载中..."}</span>
        {!hideLastUpdate && (
          <span className="text-[10px] text-gray-500">上次更新: {formatLastUpdated()}</span>
        )}
      </div>
    </div>
  );
};

export default GlobalUpdateTimer; 