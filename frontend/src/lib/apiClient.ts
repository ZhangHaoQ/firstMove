import { config } from './config';

// API响应类型
export interface ApiResponse<T = unknown> {
  data: T;
  success: boolean;
  message?: string;
}

// API错误类型
export class ApiError extends Error {
  public status: number;
  public details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

// 请求配置接口
export interface RequestConfig {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 通用的fetch包装器
export class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number;
  private defaultRetries: number;

  constructor(baseUrl: string, timeout: number = 10000, retries: number = 3) {
    this.baseUrl = baseUrl;
    this.defaultTimeout = timeout;
    this.defaultRetries = retries;
  }

  // 记录日志
  private log(level: 'info' | 'error' | 'warn', message: string, data?: unknown) {
    if (config.dev.enableLogs) {
      console[level](`[ApiClient] ${message}`, data || '');
    }
  }

  // 发起请求
  public async request<T = unknown>(
    endpoint: string,
    options: RequestInit & RequestConfig = {}
  ): Promise<T> {
    const {
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      headers = {},
      ...fetchOptions
    } = options;

    const url = new URL(endpoint, this.baseUrl).toString();
    
    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    this.log('info', `发起请求: ${requestOptions.method || 'GET'} ${url}`);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...requestOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.text();
          throw new ApiError(
            `请求失败: ${response.status} ${response.statusText}`,
            response.status,
            errorData
          );
        }

        const data = await response.json();
        this.log('info', `请求成功: ${url}`, { status: response.status });
        return data;

      } catch (error) {
        this.log('error', `请求失败 (尝试 ${attempt + 1}/${retries + 1}): ${url}`, error);

        if (attempt === retries) {
          // 最后一次尝试失败，抛出错误
          if (error instanceof ApiError) {
            throw error;
          }
          throw new ApiError(
            `请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
            0,
            error
          );
        }

        // 等待后重试
        await delay(config.api.retryDelay * (attempt + 1));
      }
    }

    throw new ApiError('请求失败：超出最大重试次数', 0);
  }

  // GET请求
  public async get<T = unknown>(endpoint: string, params?: Record<string, string>, options?: RequestConfig): Promise<T> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += (endpoint.includes('?') ? '&' : '?') + searchParams.toString();
    }

    return this.request<T>(url, { ...options, method: 'GET' });
  }

  // POST请求
  public async post<T = unknown>(endpoint: string, data?: unknown, options?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT请求
  public async put<T = unknown>(endpoint: string, data?: unknown, options?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE请求
  public async delete<T = unknown>(endpoint: string, options?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// 创建默认的API客户端实例
export const apiClient = new ApiClient(
  config.api.baseUrl,
  config.api.timeout,
  config.api.retryAttempts
);

// 创建外部API客户端
export const marketApiClient = new ApiClient(
  config.external.market.baseUrl,
  config.external.market.timeout,
  1 // 外部API重试次数较少
); 