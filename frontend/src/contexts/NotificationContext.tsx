"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// 通知设置类型
export interface NotificationSettings {
  soundEnabled: boolean;           // 是否启用声音
  notifyOnlyImportant: boolean;    // 是否只有重要快讯才提醒
  notifyOnSentiment: 'all' | 'positive' | 'negative' | 'neutral'; // 哪种情感的快讯提醒
  volume: number;                  // 音量 (0-1)
  soundType: 'normal' | 'important'; // 提示音类型
}

// 通知上下文类型
interface NotificationContextType {
  settings: NotificationSettings;
  updateSettings: (newSettings: Partial<NotificationSettings>) => void;
  playTestSound: (type?: 'normal' | 'important') => void;
  notifyNewFlash: (count: number, hasImportant: boolean, sentiment: 'positive' | 'negative' | 'neutral') => void;
  soundError: string | null;
}

// 默认设置
const defaultSettings: NotificationSettings = {
  soundEnabled: true,
  notifyOnlyImportant: false,
  notifyOnSentiment: 'all',
  volume: 0.7,
  soundType: 'normal'
};

// 创建上下文
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// 提供者组件
export function NotificationProvider({ children }: { children: ReactNode }) {
  // 从localStorage加载设置或使用默认设置
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('notificationSettings');
      return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
    }
    return defaultSettings;
  });
  
  // 音频错误状态
  const [soundError, setSoundError] = useState<string | null>(null);

  // 音频元素引用
  const normalSoundRef = React.useRef<HTMLAudioElement | null>(null);
  const importantSoundRef = React.useRef<HTMLAudioElement | null>(null);

  // 音频元素加载状态
  const [soundsLoaded, setSoundsLoaded] = useState({
    normal: false,
    important: false
  });

  // 初始化音频元素
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // 创建音频元素
        normalSoundRef.current = new Audio('/sounds/notification.mp3');
        importantSoundRef.current = new Audio('/sounds/important.mp3');
        
        // 添加加载处理
        normalSoundRef.current.addEventListener('canplaythrough', () => {
          setSoundsLoaded(prev => ({ ...prev, normal: true }));
          setSoundError(null);
        });
        
        importantSoundRef.current.addEventListener('canplaythrough', () => {
          setSoundsLoaded(prev => ({ ...prev, important: true }));
          setSoundError(null);
        });
        
        // 添加错误处理
        normalSoundRef.current.addEventListener('error', () => {
          console.error('无法加载普通提示音');
          setSoundsLoaded(prev => ({ ...prev, normal: false }));
          setSoundError('无法加载提示音文件，请确保音频文件存在');
        });
        
        importantSoundRef.current.addEventListener('error', () => {
          console.error('无法加载重要提示音');
          setSoundsLoaded(prev => ({ ...prev, important: false }));
          setSoundError('无法加载提示音文件，请确保音频文件存在');
        });
        
        // 预加载
        normalSoundRef.current.load();
        importantSoundRef.current.load();
      } catch (err) {
        console.error('初始化音频失败:', err);
        setSoundError('初始化音频失败');
      }
      
      // 清理函数
      return () => {
        if (normalSoundRef.current) {
          normalSoundRef.current.removeEventListener('canplaythrough', () => {});
          normalSoundRef.current.removeEventListener('error', () => {});
        }
        if (importantSoundRef.current) {
          importantSoundRef.current.removeEventListener('canplaythrough', () => {});
          importantSoundRef.current.removeEventListener('error', () => {});
        }
      };
    }
  }, []);

  // 当设置改变时保存到localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('notificationSettings', JSON.stringify(settings));
    }
  }, [settings]);

  // 更新设置
  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      ...newSettings
    }));
  };

  // 播放测试声音
  const playTestSound = (type: 'normal' | 'important' = 'normal') => {
    if (!settings.soundEnabled) return;
    
    // 检查对应的声音是否已加载
    if (!soundsLoaded[type]) {
      setSoundError(`${type === 'normal' ? '普通' : '重要'}提示音尚未加载，请稍后再试`);
      return;
    }
    
    const soundRef = type === 'normal' ? normalSoundRef.current : importantSoundRef.current;
    if (soundRef) {
      soundRef.volume = settings.volume;
      soundRef.currentTime = 0;
      soundRef.play().catch(err => {
        console.error('播放声音失败:', err);
        setSoundError('播放声音失败，可能是浏览器限制或文件问题');
      });
    }
  };

  // 通知新快讯
  const notifyNewFlash = (count: number, hasImportant: boolean, sentiment: 'positive' | 'negative' | 'neutral') => {
    if (count <= 0 || !settings.soundEnabled) return;
    
    // 检查情感设置
    if (settings.notifyOnSentiment !== 'all' && settings.notifyOnSentiment !== sentiment) return;
    
    // 检查重要性设置
    if (settings.notifyOnlyImportant && !hasImportant) return;
    
    // 选择声音类型
    const soundType = (hasImportant && settings.soundType === 'important') ? 'important' : 'normal';
    
    // 检查声音是否已加载
    if (!soundsLoaded[soundType]) {
      console.warn(`${soundType}提示音未加载，无法播放通知声音`);
      return;
    }
    
    playTestSound(soundType);
  };

  return (
    <NotificationContext.Provider 
      value={{ 
        settings, 
        updateSettings, 
        playTestSound,
        notifyNewFlash,
        soundError
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// 使用通知上下文的自定义Hook
export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
} 