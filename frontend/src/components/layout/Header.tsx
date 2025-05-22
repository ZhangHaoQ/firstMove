"use client";

// 没有需要导入的内容

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200">
      {/* 主导航栏 */}
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        {/* 左侧: Logo */}
        <div className="flex items-center">
          {/* 品牌标识 - 更大更醒目 */}
          <div className="flex items-center">
            {/* 添加简单图标 */}
            <div className="mr-2 bg-blue-600 text-white p-2 rounded-lg shadow-md">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            
            {/* 改进的Logo文字 */}
            <div className="flex flex-col">
              <h1 className="text-blue-600 font-bold text-2xl tracking-tight">先机</h1>
              <span className="text-xs text-gray-500 -mt-1">XIANJI - 把握先机，洞见未来</span>
            </div>
          </div>
        </div>
        
        {/* 右侧区域 - 留空备用 */}
        <div className="flex items-center">
          {/* 未来可以添加其他功能按钮 */}
        </div>
      </div>
    </header>
  );
} 