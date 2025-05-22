"use client";

import { useState, useRef, useEffect } from 'react';

interface FilterOption {
  id: string;
  label: string;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  small?: boolean;
}

export default function FilterDropdown({ label, options, value, onChange, small = false }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 关闭下拉菜单的点击外部处理器
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 获取当前选中的标签文本
  const selectedLabel = options.find(option => option.id === value)?.label || label;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className={`inline-flex justify-between items-center ${small ? 'w-24 px-2 py-0.5' : 'w-32 px-3 py-1'} text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50 focus:outline-none`}
      >
        {selectedLabel}
        <svg
          className={`${small ? 'w-3 h-3' : 'w-3.5 h-3.5'} ml-1 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-36 rounded shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
          <div className="py-1">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  onChange(option.id);
                  setIsOpen(false);
                }}
                className={`${
                  option.id === value ? 'bg-gray-100 text-blue-600' : 'text-gray-700'
                } block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 预定义的筛选器配置，可导出以供全局使用
export const SENTIMENT_FILTER_OPTIONS: FilterOption[] = [
  { id: 'all', label: '全部情绪' },
  { id: 'positive', label: '积极' },
  { id: 'neutral', label: '中性' },
  { id: 'negative', label: '消极' }
]; 