"use client";

import { useState } from 'react';
import Link from 'next/link';

// 定义导航项接口
interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
}

// 侧边栏组件
export default function Sidebar() {
  // 当前激活的导航项
  const [activeNavItem, setActiveNavItem] = useState('discovery');
  
  // 导航项数据
  const navItems: NavItem[] = [
    {
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
      label: '先机发现',
      href: '/',
      active: activeNavItem === 'discovery'
    },
    {
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
      label: '市场情报',
      href: '/market',
      active: activeNavItem === 'market'
    },
    {
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
      label: '我的关注',
      href: '/favorites',
      active: activeNavItem === 'favorites'
    },
    {
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
      label: '投资组合',
      href: '/portfolio',
      active: activeNavItem === 'portfolio'
    },
    {
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
      label: 'AI洞察',
      href: '/insights',
      active: activeNavItem === 'insights'
    },
  ];

  const handleNavClick = (navId: string) => {
    setActiveNavItem(navId);
  };

  return (
    <div className="w-[160px] h-full bg-white border-r border-gray-200 hidden md:block">
      {/* 筛选标签 */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-xs text-gray-500 mb-2">信息筛选</h3>
        <div className="space-y-2">
          <div className="flex items-center">
            <input id="filter-all" type="radio" name="filter" className="w-3 h-3 text-blue-600" defaultChecked />
            <label htmlFor="filter-all" className="ml-2 text-xs text-gray-700">全部快讯</label>
          </div>
          <div className="flex items-center">
            <input id="filter-positive" type="radio" name="filter" className="w-3 h-3 text-blue-600" />
            <label htmlFor="filter-positive" className="ml-2 text-xs text-gray-700">利好消息</label>
          </div>
          <div className="flex items-center">
            <input id="filter-negative" type="radio" name="filter" className="w-3 h-3 text-blue-600" />
            <label htmlFor="filter-negative" className="ml-2 text-xs text-gray-700">利空消息</label>
          </div>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="py-2">
        <ul>
          {navItems.map((item) => (
            <li key={item.label}>
              <Link 
                href={item.href} 
                className={`flex items-center px-4 py-2 text-xs ${
                  item.active 
                    ? 'text-blue-600 bg-blue-50 border-l-2 border-blue-600' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => handleNavClick(item.href.replace('/', '') || 'discovery')}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
} 