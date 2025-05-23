"use client";

import { useState, useEffect, useRef } from 'react';
import { useNotification, NotificationSettings } from '@/contexts/NotificationContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, playTestSound, soundError } = useNotification();
  const [localSettings, setLocalSettings] = useState<NotificationSettings>({ ...settings });
  const modalRef = useRef<HTMLDivElement>(null);

  // 当props.isOpen变化时更新本地设置
  useEffect(() => {
    if (isOpen) {
      setLocalSettings({ ...settings });
    }
  }, [isOpen, settings]);

  // 点击模态框外部时关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node) && isOpen) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // ESC键关闭模态框
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  // 处理设置变化
  const handleSettingChange = (key: keyof NotificationSettings, value: boolean | string | number) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 保存设置
  const handleSave = () => {
    updateSettings(localSettings);
    onClose();
  };

  // 测试声音
  const handleTestSound = () => {
    if (localSettings.soundEnabled) {
      playTestSound(localSettings.soundType);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden"
      >
        {/* 模态框标题 */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">通知设置</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 模态框内容 */}
        <div className="px-6 py-4">
          <div className="space-y-4">
            {/* 声音启用开关 */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">启用声音提醒</span>
              <div 
                className={`relative inline-block w-10 h-5 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${localSettings.soundEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}
                onClick={() => handleSettingChange('soundEnabled', !localSettings.soundEnabled)}
              >
                <span 
                  className={`absolute left-0 top-0 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${localSettings.soundEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </div>
            </div>

            {/* 仅重要快讯提醒 */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">仅重要快讯提醒</span>
              <div 
                className={`relative inline-block w-10 h-5 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${localSettings.notifyOnlyImportant ? 'bg-blue-500' : 'bg-gray-300'}`}
                onClick={() => handleSettingChange('notifyOnlyImportant', !localSettings.notifyOnlyImportant)}
              >
                <span 
                  className={`absolute left-0 top-0 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${localSettings.notifyOnlyImportant ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </div>
            </div>

            {/* 声音类型选择 */}
            <div className="space-y-2">
              <label className="block text-sm text-gray-700">提示音类型</label>
              <div className="flex space-x-4">
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="radio" 
                    className="h-4 w-4 text-blue-600"
                    checked={localSettings.soundType === 'normal'} 
                    onChange={() => handleSettingChange('soundType', 'normal')}
                  />
                  <span className="ml-2 text-sm text-gray-700">普通</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="radio" 
                    className="h-4 w-4 text-blue-600"
                    checked={localSettings.soundType === 'important'} 
                    onChange={() => handleSettingChange('soundType', 'important')}
                  />
                  <span className="ml-2 text-sm text-gray-700">重要</span>
                </label>
              </div>
            </div>

            {/* 提醒的情感类型 */}
            <div className="space-y-2">
              <label className="block text-sm text-gray-700">提醒的情感类型</label>
              <select 
                className="block w-full border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={localSettings.notifyOnSentiment}
                onChange={(e) => handleSettingChange('notifyOnSentiment', e.target.value)}
              >
                <option value="all">全部情感</option>
                <option value="positive">仅积极</option>
                <option value="negative">仅消极</option>
                <option value="neutral">仅中性</option>
              </select>
            </div>

            {/* 音量控制 */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="block text-sm text-gray-700">音量</label>
                <span className="text-xs text-gray-500">{Math.round(localSettings.volume * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1"
                value={localSettings.volume}
                onChange={(e) => handleSettingChange('volume', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* 音频错误提示 */}
            {soundError && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-red-600 text-xs">
                <strong>提示音错误:</strong> {soundError}
                <p className="mt-1">请确保您的项目中包含以下文件:</p>
                <ul className="list-disc list-inside text-xs">
                  <li>public/sounds/notification.mp3</li>
                  <li>public/sounds/important.mp3</li>
                </ul>
              </div>
            )}

            {/* 测试声音按钮 */}
            <button
              onClick={handleTestSound}
              disabled={!localSettings.soundEnabled}
              className={`mt-2 w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                localSettings.soundEnabled 
                  ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              测试声音
            </button>

            {/* 声音功能说明 */}
            <div className="text-xs text-gray-500 mt-2">
              <p>声音提醒功能需要两个MP3文件:</p>
              <p>- notification.mp3: 普通提示音</p>
              <p>- important.mp3: 重要提示音</p>
              <p>请将这些文件放置在public/sounds/目录下</p>
            </div>
          </div>
        </div>

        {/* 模态框底部 */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            className="py-2 px-4 bg-blue-600 rounded-md text-sm font-medium text-white hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
} 