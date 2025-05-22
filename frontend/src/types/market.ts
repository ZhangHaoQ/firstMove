// 市场指标数据类型
export interface MarketIndex {
  code: string;         // 产品代码，如"DXY.OTC"
  name: string;         // 产品名称，如"美元指数"
  price: number;        // 最新价格
  change: number;       // 价格变化
  changePercent: number;// 价格变化率(%)
  precision: number;    // 价格精度
  type: string;         // 证券类型
} 