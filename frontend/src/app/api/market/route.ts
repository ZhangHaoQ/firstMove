// Next.js API路由 - 代理市场数据请求以解决CORS问题
export async function GET() {
  try {
    // 构建请求参数
    const params = new URLSearchParams({
      app: 'CailianpressWeb',
      fields: 'secu_name,secu_code,trade_status,change,change_px,last_px',
      os: 'web',
      secu_codes: 'sh000001,sz399001,sh000905,sz399006',
      sv: '8.4.6',
      sign: '7ddfd2eef7564087ff01a1782c724f43'
    });
    
    // 请求第三方API
    const response = await fetch(
      `https://x-quote.cls.cn/v2/quote/a/web/stocks/basic?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 返回数据并设置CORS头
    return Response.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
    
  } catch (error) {
    //console.error('市场数据代理请求失败:', error);
    
    // 返回错误响应
    return Response.json(
      { 
        error: '获取市场数据失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}

// 处理OPTIONS预检请求
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 