/**
 * 用量 API Mock 实现
 *
 * 生成逼真的 RawQuotaData[] 模拟数据，然后通过 quota-transform 层
 * 转换为仪表盘所需格式。确保 mock 和 real 使用完全相同的数据处理管道。
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
  RawQuotaData,
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
// Helpers
// ============================================================

/** 模拟网络延迟 */
function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms + Math.random() * 200));
}

/** 带波动的随机数 */
function rand(base: number, variance = 0.3): number {
  return base * (1 + (Math.random() - 0.5) * 2 * variance);
}

// ============================================================
// Mock 模型 & 用户配置
// ============================================================

interface MockModelConfig {
  name: string;
  modelRatio: number;
  completionRatio: number;
  avgPromptTokens: number;
  avgCompletionTokens: number;
  avgLatencyMs: number;
  errorRate: number;
  category: string;
}

const MOCK_MODELS: MockModelConfig[] = [
  {
    name: 'gpt-4o',
    modelRatio: 30,
    completionRatio: 2,
    avgPromptTokens: 500,
    avgCompletionTokens: 200,
    avgLatencyMs: 850,
    errorRate: 0.008,
    category: 'text',
  },
  {
    name: 'gpt-4o-mini',
    modelRatio: 0.75,
    completionRatio: 3,
    avgPromptTokens: 400,
    avgCompletionTokens: 180,
    avgLatencyMs: 450,
    errorRate: 0.005,
    category: 'text',
  },
  {
    name: 'claude-sonnet-4',
    modelRatio: 18,
    completionRatio: 5,
    avgPromptTokens: 600,
    avgCompletionTokens: 250,
    avgLatencyMs: 1200,
    errorRate: 0.01,
    category: 'text',
  },
  {
    name: 'claude-3.5-haiku',
    modelRatio: 5,
    completionRatio: 5,
    avgPromptTokens: 350,
    avgCompletionTokens: 150,
    avgLatencyMs: 380,
    errorRate: 0.004,
    category: 'text',
  },
  {
    name: 'deepseek-v3',
    modelRatio: 1.5,
    completionRatio: 4,
    avgPromptTokens: 450,
    avgCompletionTokens: 300,
    avgLatencyMs: 600,
    errorRate: 0.012,
    category: 'text',
  },
  {
    name: 'gemini-2.5-pro',
    modelRatio: 7.5,
    completionRatio: 4,
    avgPromptTokens: 550,
    avgCompletionTokens: 220,
    avgLatencyMs: 700,
    errorRate: 0.006,
    category: 'text',
  },
  {
    name: 'dall-e-3',
    modelRatio: 200,
    completionRatio: 1,
    avgPromptTokens: 80,
    avgCompletionTokens: 0,
    avgLatencyMs: 3500,
    errorRate: 0.02,
    category: 'image',
  },
  {
    name: 'text-embedding-3-large',
    modelRatio: 0.65,
    completionRatio: 0,
    avgPromptTokens: 300,
    avgCompletionTokens: 0,
    avgLatencyMs: 120,
    errorRate: 0.002,
    category: 'embedding',
  },
];

const MOCK_USERS = [
  { id: 101, username: 'alice' },
  { id: 102, username: 'bob' },
  { id: 103, username: 'charlie' },
  { id: 104, username: 'diana' },
  { id: 105, username: 'eve' },
];

const MOCK_CHANNELS = [1, 2, 3, 5, 8];
const MOCK_GROUPS = ['default', 'vip', 'internal'];

// ============================================================
// Raw data generator
// ============================================================

/**
 * 生成指定时间范围内的 RawQuotaData 数组
 *
 * 按小时桶生成，每小时每个模型每个用户产生 0-1 条记录
 */
export function generateMockRawData(
  startIso: string,
  endIso: string,
  options?: { includeExtendedFields?: boolean }
): RawQuotaData[] {
  const startTs = Math.floor(new Date(startIso).getTime() / 1000);
  const endTs = Math.floor(new Date(endIso).getTime() / 1000);
  const hourSeconds = 3600;
  const includeExtended = options?.includeExtendedFields ?? true;

  const records: RawQuotaData[] = [];
  let idCounter = 1;

  // Iterate hour by hour (skip some hours to keep data realistic)
  for (let ts = startTs; ts < endTs; ts += hourSeconds) {
    // For each model, probabilistically generate records
    for (const model of MOCK_MODELS) {
      // Not every model has data every hour
      if (Math.random() < 0.2) continue;

      // Pick 1-3 users for this model in this hour
      const numUsers = Math.ceil(Math.random() * 3);
      const shuffled = [...MOCK_USERS].sort(() => Math.random() - 0.5);
      const activeUsers = shuffled.slice(0, numUsers);

      for (const user of activeUsers) {
        const count = Math.round(rand(15, 0.6));
        if (count <= 0) continue;

        const promptTokens = Math.round(rand(model.avgPromptTokens * count, 0.3));
        const completionTokens = Math.round(rand(model.avgCompletionTokens * count, 0.3));
        const tokenUsed = promptTokens + completionTokens;

        // Quota calculation: quota = (promptTokens * modelRatio + completionTokens * modelRatio * completionRatio) / 1000
        const quota = Math.round(
          (promptTokens * model.modelRatio + completionTokens * model.modelRatio * model.completionRatio) / 1000
        );

        const errorCount = Math.random() < model.errorRate * count ? Math.ceil(Math.random() * 2) : 0;
        const avgUseTime = Math.round(rand(model.avgLatencyMs, 0.3));
        const maxUseTime = Math.round(avgUseTime * (1.5 + Math.random() * 1.5));
        const streamCount = Math.round(count * (0.6 + Math.random() * 0.3));
        const totalUseTime = avgUseTime * count;

        const channelId = MOCK_CHANNELS[Math.floor(Math.random() * MOCK_CHANNELS.length)];
        const group = MOCK_GROUPS[Math.floor(Math.random() * MOCK_GROUPS.length)];

        const record: RawQuotaData = {
          id: idCounter++,
          user_id: user.id,
          username: user.username,
          model_name: model.name,
          created_at: ts,
          token_used: tokenUsed,
          count,
          quota,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          model_ratio: model.modelRatio,
          completion_ratio: model.completionRatio,
          channel_id: channelId,
          group,
          avg_use_time: avgUseTime,
          max_use_time: maxUseTime,
          stream_count: streamCount,
          error_count: errorCount,
          total_use_time: totalUseTime,
        };

        // T-006 extended fields
        if (includeExtended) {
          // Simulated upstream cost: roughly 60-80% of quota-derived cost
          const quotaToUsdRate = 1 / 500000;
          const revenue = quota * quotaToUsdRate;
          const upstreamCostRatio = 0.5 + Math.random() * 0.3; // 50-80%
          record.upstream_cost = Math.round(revenue * upstreamCostRatio * 10000) / 10000;
          record.profit_margin = Math.round((1 - upstreamCostRatio) * 10000) / 100;
          record.currency = 'USD';
          record.model_category = model.category;
          record.endpoint_type = model.category === 'embedding' ? 'embedding' : 'chat';
          record.first_response_ms = Math.round(rand(avgUseTime * 0.3, 0.4));
          record.p95_latency_ms = Math.round(avgUseTime * (1.3 + Math.random() * 0.5));
          record.success_count = count - errorCount;
        }

        records.push(record);
      }
    }
  }

  return records;
}

// ============================================================
// Mock API Implementation
// ============================================================

export class MockUsageApi implements IUsageApi {
  private _delay: number;
  private _quotaToUsdRate: number;
  private _includeExtendedFields: boolean;

  constructor(delayMs = 300, options?: { quotaToUsdRate?: number; includeExtendedFields?: boolean }) {
    this._delay = delayMs;
    this._quotaToUsdRate = options?.quotaToUsdRate ?? (1 / 500000);
    this._includeExtendedFields = options?.includeExtendedFields ?? true;
  }

  /** 为给定查询生成原始数据 */
  private generateData(query: DashboardQuery): RawQuotaData[] {
    let data = generateMockRawData(
      query.dateRange.start,
      query.dateRange.end,
      { includeExtendedFields: this._includeExtendedFields }
    );

    // Apply model category filter
    if (query.modelCategory && query.modelCategory !== 'all') {
      data = filterByModelCategory(data, query.modelCategory);
    }

    // Apply model IDs filter
    if (query.modelIds && query.modelIds.length > 0) {
      const modelSet = new Set(query.modelIds);
      data = data.filter((r) => modelSet.has(r.model_name));
    }

    return data;
  }

  private getGranularity(query: DashboardQuery): TimeGranularity {
    return query.granularity || 'daily';
  }

  async getDashboard(query: DashboardQuery): Promise<DashboardData> {
    await delay(this._delay);

    const data = this.generateData(query);
    const gran = this.getGranularity(query);

    return {
      summary: computeSummary(data, [], this._quotaToUsdRate),
      costTrend: computeCostTrend(data, gran, this._quotaToUsdRate),
      tokenTrend: computeTokenTrend(data, gran),
      modelAnalysis: computeModelAnalysis(data, gran, this._quotaToUsdRate),
      topConsumers: computeTopConsumers(data, 'user', 'cost', 'desc', 10, this._quotaToUsdRate),
      dateRange: query.dateRange,
      refreshedAt: new Date().toISOString(),
    };
  }

  async getSummary(query: DashboardQuery): Promise<DashboardSummary> {
    await delay(this._delay);
    const data = this.generateData(query);
    return computeSummary(data, [], this._quotaToUsdRate);
  }

  async getCostTrend(query: DashboardQuery): Promise<CostTrendData> {
    await delay(this._delay);
    const data = this.generateData(query);
    return computeCostTrend(data, this.getGranularity(query), this._quotaToUsdRate);
  }

  async getTokenTrend(query: DashboardQuery): Promise<TokenTrendData> {
    await delay(this._delay);
    const data = this.generateData(query);
    return computeTokenTrend(data, this.getGranularity(query));
  }

  async getModelAnalysis(query: DashboardQuery): Promise<ModelAnalysisData> {
    await delay(this._delay);
    const data = this.generateData(query);
    return computeModelAnalysis(data, this.getGranularity(query), this._quotaToUsdRate);
  }

  async getTopConsumers(
    query: DashboardQuery,
    type: ConsumerType,
    sortBy: SortDimension,
    sortOrder: SortOrder,
    limit: number
  ): Promise<TopConsumersData> {
    await delay(this._delay);
    const data = this.generateData(query);
    return computeTopConsumers(data, type, sortBy, sortOrder, limit, this._quotaToUsdRate);
  }
}

/**
 * 创建 Mock API 实例
 */
export function createMockUsageApi(
  delayMs = 300,
  options?: { quotaToUsdRate?: number; includeExtendedFields?: boolean }
): IUsageApi {
  return new MockUsageApi(delayMs, options);
}
