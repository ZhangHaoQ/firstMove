// 配置管理 - API配置
export const config = {
  // API基础配置
  api: {
    baseUrl: 'http://localhost:8000',
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  
  // 外部API配置
  external: {
    market: {
      baseUrl: 'https://x-quote.cls.cn',
      timeout: 5000,
    }
  },
  
  // API端点配置
  endpoints: {
    // 内部API端点
    flashes: {
      latest: '/flashes/latest/',
    },
    
    // 外部API端点
    market: {
      stockBasic: '/v2/quote/a/web/stocks/basic',
    }
  },
  
  // 开发模式配置
  dev: {
    enableLogs: true,
    enableMockData: true,
  }
};

// 获取完整的API URL
export const getApiUrl = (endpoint: string, params?: Record<string, string>) => {
  const url = new URL(endpoint, config.api.baseUrl);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  
  return url.toString();
};

// 获取外部API URL
export const getExternalApiUrl = (type: 'market', endpoint: string, params?: Record<string, string>) => {
  const baseUrl = config.external[type]?.baseUrl;
  if (!baseUrl) {
    throw new Error(`未配置的外部API类型: ${type}`);
  }
  
  const url = new URL(endpoint, baseUrl);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  
  return url.toString();
}; 