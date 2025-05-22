import { MarketIndex } from '@/types/market';

// 获取市场指标数据
export const fetchMarketIndices = async (): Promise<MarketIndex[]> => {
  try {
    console.log('获取A股市场数据');
    // 使用财联社API
    const response = await fetch('https://x-quote.cls.cn/v2/quote/a/web/stocks/basic?app=CailianpressWeb&fields=secu_name,secu_code,trade_status,change,change_px,last_px&os=web&secu_codes=sh000001,sz399001,sh000905,sz399006&sv=8.4.6&sign=7ddfd2eef7564087ff01a1782c724f43');
    const data = await response.json();
    
    if (data.code !== 200) {
      throw new Error(data.msg || '获取市场数据失败');
    }
    
    // 解析数据
    const indices: MarketIndex[] = [];
    const stockData = data.data;
    
    Object.keys(stockData).forEach(code => {
      const stock = stockData[code];
      indices.push({
        code: stock.secu_code,
        name: decodeUnicode(stock.secu_name), // 解码Unicode编码的中文
        price: stock.last_px,
        change: stock.change_px,
        changePercent: stock.change * 100, // 转换为百分比
        precision: 2, // 默认精度
        type: 'A股'   // 默认类型
      });
    });
    
    console.log(`获取到 ${indices.length} 个A股市场指标`);
    return indices;
  } catch (error) {
    console.error('获取市场指标数据失败:', error);
    throw error;
  }
};

// 解码Unicode编码的中文
function decodeUnicode(str: string) {
  return str.replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => {
    return String.fromCharCode(parseInt(grp, 16));
  });
} 