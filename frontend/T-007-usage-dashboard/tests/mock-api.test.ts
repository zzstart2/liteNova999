/**
 * Mock API 测试
 *
 * 验证 mock 数据的结构完整性和合理性
 * 测试基于 quota-transform 的 mock 数据生成
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MockUsageApi, generateMockRawData } from '../src/api/usage-api.mock';
import type { DashboardQuery, RawQuotaData } from '../src/types/usage';

const query: DashboardQuery = {
  dateRange: {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
  },
  granularity: 'daily',
};

let api: MockUsageApi;

beforeAll(() => {
  api = new MockUsageApi(0); // 无延迟
});

// ============================================================
// Raw data generator
// ============================================================

describe('generateMockRawData', () => {
  it('should generate data for given date range', () => {
    const start = '2024-07-01T00:00:00Z';
    const end = '2024-07-03T00:00:00Z'; // 2 days
    const data = generateMockRawData(start, end);

    expect(data.length).toBeGreaterThan(0);
  });

  it('should include extended fields by default', () => {
    const data = generateMockRawData('2024-07-01T00:00:00Z', '2024-07-02T00:00:00Z');
    const first = data[0];

    expect(first.upstream_cost).toBeDefined();
    expect(first.profit_margin).toBeDefined();
    expect(first.model_category).toBeDefined();
  });

  it('should omit extended fields when disabled', () => {
    const data = generateMockRawData('2024-07-01T00:00:00Z', '2024-07-02T00:00:00Z', { includeExtendedFields: false });
    const first = data[0];

    expect(first.upstream_cost).toBeUndefined();
    expect(first.profit_margin).toBeUndefined();
  });
});

// ============================================================
// getSummary
// ============================================================

describe('MockUsageApi.getSummary', () => {
  it('should return all required metrics', async () => {
    const summary = await api.getSummary(query);

    expect(summary.totalRequests).toBeDefined();
    expect(summary.totalRequests.value).toBeGreaterThan(0);
    expect(summary.totalTokens.value).toBeGreaterThan(0);
    expect(summary.totalCost.value).toBeGreaterThan(0);
    expect(summary.avgLatency.value).toBeGreaterThan(0);
    expect(summary.successRate.value).toBeGreaterThan(90);
    expect(summary.activeModels.value).toBeGreaterThan(0);
  });

  it('should include upstream cost when data has it', async () => {
    const summary = await api.getSummary(query);

    // Default mock includes extended fields
    expect(summary.upstreamCost).toBeDefined();
    expect(summary.upstreamCost?.value).toBeGreaterThan(0);
    expect(summary.profitMargin).toBeDefined();
  });

  it('should include change rate', async () => {
    const summary = await api.getSummary(query);

    expect(typeof summary.totalRequests.changeRate).toBe('number');
    expect(summary.totalRequests.trend).toBeDefined();
    expect(['up', 'down', 'flat']).toContain(summary.totalRequests.trend);
  });
});

// ============================================================
// getCostTrend
// ============================================================

describe('MockUsageApi.getCostTrend', () => {
  it('should return daily data points', async () => {
    const data = await api.getCostTrend(query);

    expect(data.series.length).toBeGreaterThan(0);
    expect(data.total).toBeGreaterThan(0);
    expect(data.dailyAvg).toBeGreaterThan(0);
    expect(data.models.length).toBeGreaterThan(0);
  });

  it('should have by-model breakdown', async () => {
    const data = await api.getCostTrend(query);
    const firstDay = data.series[0];

    expect(firstDay.date).toBeDefined();
    expect(firstDay.totalCost).toBeGreaterThan(0);
    expect(Object.keys(firstDay.byModel).length).toBeGreaterThan(0);
  });

  it('should have upstream cost when available', async () => {
    const data = await api.getCostTrend(query);

    expect(data.totalUpstreamCost).toBeDefined();
    expect(data.totalUpstreamCost).toBeGreaterThan(0);
  });

  it('should have projected monthly cost', async () => {
    const data = await api.getCostTrend(query);
    expect(data.projectedMonthly).toBeGreaterThan(0);
  });
});

// ============================================================
// getTokenTrend
// ============================================================

describe('MockUsageApi.getTokenTrend', () => {
  it('should return input/output breakdown', async () => {
    const data = await api.getTokenTrend(query);

    expect(data.series.length).toBeGreaterThan(0);
    expect(data.total.input).toBeGreaterThan(0);
    expect(data.total.output).toBeGreaterThan(0);
    expect(data.total.total).toBe(data.total.input + data.total.output);
  });

  it('should identify peak day', async () => {
    const data = await api.getTokenTrend(query);

    expect(data.peakDay.date).toBeDefined();
    expect(data.peakDay.tokens).toBeGreaterThan(0);
  });

  it('each day should have positive tokens', async () => {
    const data = await api.getTokenTrend(query);

    for (const point of data.series) {
      expect(point.inputTokens).toBeGreaterThan(0);
      expect(point.outputTokens).toBeGreaterThan(0);
      expect(point.totalTokens).toBe(point.inputTokens + point.outputTokens);
      expect(point.requests).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// getModelAnalysis
// ============================================================

describe('MockUsageApi.getModelAnalysis', () => {
  it('should return model stats', async () => {
    const data = await api.getModelAnalysis(query);

    expect(data.models.length).toBeGreaterThan(0);

    for (const model of data.models) {
      expect(model.modelId).toBeTruthy();
      expect(model.modelName).toBeTruthy();
      expect(model.provider).toBeTruthy();
      expect(model.requests).toBeGreaterThan(0);
      expect(model.cost).toBeGreaterThan(0);
      expect(model.costShare).toBeGreaterThan(0);
      expect(model.avgLatency).toBeGreaterThan(0);
      expect(model.successRate).toBeGreaterThan(90);
    }
  });

  it('should have category field', async () => {
    const data = await api.getModelAnalysis(query);

    for (const model of data.models) {
      expect(model.category).toBeDefined();
    }
  });

  it('cost shares should roughly sum to 100', async () => {
    const data = await api.getModelAnalysis(query);
    const totalShare = data.models.reduce((sum, m) => sum + m.costShare, 0);
    expect(totalShare).toBeCloseTo(100, 0);
  });

  it('should include trends', async () => {
    const data = await api.getModelAnalysis(query);

    expect(data.trends.length).toBe(data.models.length);
    for (const trend of data.trends) {
      expect(trend.label).toBeTruthy();
      expect(trend.data.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// getTopConsumers
// ============================================================

describe('MockUsageApi.getTopConsumers', () => {
  it('should return user consumers', async () => {
    const data = await api.getTopConsumers(query, 'user', 'cost', 'desc', 10);

    expect(data.consumers.length).toBeGreaterThan(0);
    expect(data.consumerType).toBe('user');
    expect(data.sortBy).toBe('cost');
    expect(data.sortOrder).toBe('desc');

    for (const c of data.consumers) {
      expect(c.type).toBe('user');
      expect(c.cost).toBeGreaterThan(0);
    }
  });

  it('should return channel consumers', async () => {
    const data = await api.getTopConsumers(query, 'channel', 'cost', 'desc', 10);

    expect(data.consumerType).toBe('channel');
    for (const c of data.consumers) {
      expect(c.type).toBe('channel');
    }
  });

  it('should return group consumers', async () => {
    const data = await api.getTopConsumers(query, 'group', 'cost', 'desc', 10);

    expect(data.consumerType).toBe('group');
    for (const c of data.consumers) {
      expect(c.type).toBe('group');
    }
  });

  it('should sort descending by cost', async () => {
    const data = await api.getTopConsumers(query, 'user', 'cost', 'desc', 10);
    for (let i = 1; i < data.consumers.length; i++) {
      expect(data.consumers[i - 1].cost).toBeGreaterThanOrEqual(data.consumers[i].cost);
    }
  });

  it('should respect limit', async () => {
    const data = await api.getTopConsumers(query, 'user', 'cost', 'desc', 2);
    expect(data.consumers.length).toBeLessThanOrEqual(2);
  });
});

// ============================================================
// getDashboard (综合)
// ============================================================

describe('MockUsageApi.getDashboard', () => {
  it('should return full dashboard data', async () => {
    const data = await api.getDashboard(query);

    expect(data.summary).toBeDefined();
    expect(data.costTrend).toBeDefined();
    expect(data.tokenTrend).toBeDefined();
    expect(data.modelAnalysis).toBeDefined();
    expect(data.topConsumers).toBeDefined();
    expect(data.dateRange).toEqual(query.dateRange);
    expect(data.refreshedAt).toBeTruthy();
  });
});
