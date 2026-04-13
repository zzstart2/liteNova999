/**
 * 用量 API 适配器接口
 *
 * 定义统一的数据获取接口，real / mock 实现此接口
 */

import type {
  DashboardQuery,
  DashboardSummary,
  CostTrendData,
  TokenTrendData,
  ModelAnalysisData,
  TopConsumersData,
  DashboardData,
  ConsumerType,
  SortDimension,
  SortOrder,
} from '../types/usage';

/**
 * 用量 API 接口
 */
export interface IUsageApi {
  /** 获取完整仪表盘数据 */
  getDashboard(query: DashboardQuery): Promise<DashboardData>;

  /** 获取概览统计 */
  getSummary(query: DashboardQuery): Promise<DashboardSummary>;

  /** 获取费用趋势 */
  getCostTrend(query: DashboardQuery): Promise<CostTrendData>;

  /** 获取 Token 用量趋势 */
  getTokenTrend(query: DashboardQuery): Promise<TokenTrendData>;

  /** 获取模型维度分析 */
  getModelAnalysis(query: DashboardQuery): Promise<ModelAnalysisData>;

  /** 获取 Top 消耗排行 */
  getTopConsumers(
    query: DashboardQuery,
    type: ConsumerType,
    sortBy: SortDimension,
    sortOrder: SortOrder,
    limit: number
  ): Promise<TopConsumersData>;
}

/**
 * API 工厂
 */
let _apiInstance: IUsageApi | null = null;

export function setUsageApi(api: IUsageApi): void {
  _apiInstance = api;
}

export function getUsageApi(): IUsageApi {
  if (!_apiInstance) {
    throw new Error(
      '[UsageApi] No API instance set. Call setUsageApi() with a real or mock implementation.'
    );
  }
  return _apiInstance;
}

/**
 * 便捷工厂：根据环境自动创建 API 实例
 *
 * @param options.mode     — 'mock' | 'real' (默认根据环境变量判断)
 * @param options.baseUrl  — 后端 API 基础 URL (real 模式必填)
 * @param options.authToken — 认证 Token
 * @param options.role     — 用户角色: 'admin' | 'user' (影响可访问的端点)
 * @param options.quotaToUsdRate — quota→USD 换算率
 */
export async function createUsageApi(options: {
  mode?: 'mock' | 'real';
  baseUrl?: string;
  authToken?: string;
  role?: 'admin' | 'user';
  quotaToUsdRate?: number;
  mockDelay?: number;
} = {}): Promise<IUsageApi> {
  const mode = options.mode || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production' ? 'real' : 'mock');

  if (mode === 'real') {
    const { createRealUsageApi } = await import('./usage-api.real');
    return createRealUsageApi(options.baseUrl || '/api', {
      authToken: options.authToken,
      role: options.role,
      quotaToUsdRate: options.quotaToUsdRate,
    });
  }

  const { createMockUsageApi } = await import('./usage-api.mock');
  return createMockUsageApi(options.mockDelay ?? 300, {
    quotaToUsdRate: options.quotaToUsdRate,
  });
}
