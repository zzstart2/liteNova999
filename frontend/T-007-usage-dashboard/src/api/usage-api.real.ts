/**
 * 用量 API 真实实现
 *
 * 对接 T-006 后端 /api/data/ 系列端点
 *
 * 后端端点:
 *   GET /api/data/?start_timestamp=&end_timestamp=&username=  (Admin: by model_name + created_at)
 *   GET /api/data/users?start_timestamp=&end_timestamp=       (Admin: by username + created_at)
 *   GET /api/data/self?start_timestamp=&end_timestamp=        (User: own data)
 *
 * 响应格式: { success: boolean, message: string, data: RawQuotaData[] }
 */

import type {
  DashboardQuery,
  DashboardSummary,
  CostTrendData,
  TokenTrendData,
  ModelAnalysisData,
  TopConsumersData,
  DashboardData,
  RawQuotaData,
  BackendApiResponse,
  ConsumerType,
  SortDimension,
  SortOrder,
  TimeGranularity,
} from '../types/usage';
import type { IUsageApi } from './usage-api';
import {
  computeSummary,
  computeCostTrend,
  computeTokenTrend,
  computeModelAnalysis,
  computeTopConsumers,
  filterByModelCategory,
} from '../transforms/quota-transform';

// ============================================================
// HTTP Client
// ============================================================

class HttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message?: string
  ) {
    super(message || `HTTP ${status}: ${statusText}`);
    this.name = 'HttpError';
  }
}

/**
 * 从后端获取原始 QuotaData 数组
 */
async function fetchQuotaData(
  url: string,
  params: Record<string, string | number | undefined>,
  headers: Record<string, string>
): Promise<RawQuotaData[]> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.append(key, String(value));
    }
  }

  const qs = search.toString();
  const fullUrl = qs ? `${url}?${qs}` : url;

  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, response.statusText);
  }

  const result = (await response.json()) as BackendApiResponse<RawQuotaData[]>;

  if (!result.success) {
    throw new Error(`[UsageApi] Backend error: ${result.message}`);
  }

  return result.data || [];
}

// ============================================================
// Date range → Unix timestamps
// ============================================================

/**
 * 将 ISO 8601 日期字符串转换为 Unix 时间戳（秒）
 */
function isoToUnixSeconds(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}

/** 用户角色: admin 可访问全部端点, user 只能访问 /self */
export type UserRole = 'admin' | 'user';

// ============================================================
// Real API Implementation
// ============================================================

export class RealUsageApi implements IUsageApi {
  private baseUrl: string;
  private headers: Record<string, string>;
  private role: UserRole;
  private quotaToUsdRate: number;

  /** 缓存上次获取的原始数据，避免各方法重复请求 */
  private _cachedData: RawQuotaData[] | null = null;
  private _cachedUsersData: RawQuotaData[] | null = null;
  private _cacheTimestamp = 0;
  private _cacheQuery: string = '';

  constructor(
    baseUrl: string,
    options: {
      authToken?: string;
      role?: UserRole;
      quotaToUsdRate?: number;
    } = {}
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.headers = {};
    this.role = options.role || 'admin';
    this.quotaToUsdRate = options.quotaToUsdRate || (1 / 500000);

    if (options.authToken) {
      this.headers['Authorization'] = `Bearer ${options.authToken}`;
    }
  }

  /**
   * 获取模型维度原始数据
   * Admin: GET /api/data/
   * User:  GET /api/data/self
   */
  private async fetchModelData(query: DashboardQuery): Promise<RawQuotaData[]> {
    const cacheKey = `${query.dateRange.start}|${query.dateRange.end}|${this.role}`;
    const now = Date.now();

    // Use cache if < 30s old and same query
    if (this._cachedData && this._cacheQuery === cacheKey && (now - this._cacheTimestamp) < 30000) {
      return this._cachedData;
    }

    const endpoint = this.role === 'admin'
      ? `${this.baseUrl}/api/data/`
      : `${this.baseUrl}/api/data/self`;

    const params: Record<string, string | number | undefined> = {
      start_timestamp: isoToUnixSeconds(query.dateRange.start),
      end_timestamp: isoToUnixSeconds(query.dateRange.end),
    };

    const data = await fetchQuotaData(endpoint, params, this.headers);
    this._cachedData = data;
    this._cacheTimestamp = now;
    this._cacheQuery = cacheKey;

    return data;
  }

  /**
   * 获取用户维度原始数据 (Admin only)
   * GET /api/data/users
   */
  private async fetchUsersData(query: DashboardQuery): Promise<RawQuotaData[]> {
    if (this.role !== 'admin') return [];

    const endpoint = `${this.baseUrl}/api/data/users`;
    const params: Record<string, string | number | undefined> = {
      start_timestamp: isoToUnixSeconds(query.dateRange.start),
      end_timestamp: isoToUnixSeconds(query.dateRange.end),
    };

    const data = await fetchQuotaData(endpoint, params, this.headers);
    this._cachedUsersData = data;
    return data;
  }

  /**
   * 可选地按 modelCategory 过滤数据
   */
  private applyFilters(data: RawQuotaData[], query: DashboardQuery): RawQuotaData[] {
    let filtered = data;
    if (query.modelCategory && query.modelCategory !== 'all') {
      filtered = filterByModelCategory(filtered, query.modelCategory);
    }
    if (query.modelIds && query.modelIds.length > 0) {
      const modelSet = new Set(query.modelIds);
      filtered = filtered.filter((r) => modelSet.has(r.model_name));
    }
    return filtered;
  }

  private getGranularity(query: DashboardQuery): TimeGranularity {
    return query.granularity || 'daily';
  }

  async getDashboard(query: DashboardQuery): Promise<DashboardData> {
    // Fetch both endpoints in parallel
    const [modelData, usersData] = await Promise.all([
      this.fetchModelData(query),
      this.fetchUsersData(query),
    ]);

    const filtered = this.applyFilters(modelData, query);
    const gran = this.getGranularity(query);

    const summary = computeSummary(filtered, [], this.quotaToUsdRate);
    const costTrend = computeCostTrend(filtered, gran, this.quotaToUsdRate);
    const tokenTrend = computeTokenTrend(filtered, gran);
    const modelAnalysis = computeModelAnalysis(filtered, gran, this.quotaToUsdRate);

    // Top consumers: prefer users data for user dimension
    const consumersSource = usersData.length > 0 ? usersData : filtered;
    const topConsumers = computeTopConsumers(consumersSource, 'user', 'cost', 'desc', 10, this.quotaToUsdRate);

    return {
      summary,
      costTrend,
      tokenTrend,
      modelAnalysis,
      topConsumers,
      dateRange: query.dateRange,
      refreshedAt: new Date().toISOString(),
    };
  }

  async getSummary(query: DashboardQuery): Promise<DashboardSummary> {
    const data = await this.fetchModelData(query);
    const filtered = this.applyFilters(data, query);
    return computeSummary(filtered, [], this.quotaToUsdRate);
  }

  async getCostTrend(query: DashboardQuery): Promise<CostTrendData> {
    const data = await this.fetchModelData(query);
    const filtered = this.applyFilters(data, query);
    return computeCostTrend(filtered, this.getGranularity(query), this.quotaToUsdRate);
  }

  async getTokenTrend(query: DashboardQuery): Promise<TokenTrendData> {
    const data = await this.fetchModelData(query);
    const filtered = this.applyFilters(data, query);
    return computeTokenTrend(filtered, this.getGranularity(query));
  }

  async getModelAnalysis(query: DashboardQuery): Promise<ModelAnalysisData> {
    const data = await this.fetchModelData(query);
    const filtered = this.applyFilters(data, query);
    return computeModelAnalysis(filtered, this.getGranularity(query), this.quotaToUsdRate);
  }

  async getTopConsumers(
    query: DashboardQuery,
    type: ConsumerType,
    sortBy: SortDimension,
    sortOrder: SortOrder,
    limit: number
  ): Promise<TopConsumersData> {
    // For user-dimension, use /api/data/users; otherwise use model data
    let data: RawQuotaData[];
    if (type === 'user' && this.role === 'admin') {
      data = await this.fetchUsersData(query);
    } else {
      data = await this.fetchModelData(query);
    }
    const filtered = this.applyFilters(data, query);
    return computeTopConsumers(filtered, type, sortBy, sortOrder, limit, this.quotaToUsdRate);
  }
}

/**
 * 创建真实 API 实例
 *
 * @param baseUrl   — API 基础 URL (如 'https://api.example.com')
 * @param options   — 配置选项
 */
export function createRealUsageApi(
  baseUrl: string,
  options: {
    authToken?: string;
    role?: UserRole;
    quotaToUsdRate?: number;
  } = {}
): IUsageApi {
  return new RealUsageApi(baseUrl, options);
}
