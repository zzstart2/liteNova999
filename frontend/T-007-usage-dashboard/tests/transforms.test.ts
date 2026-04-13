/**
 * quota-transform.ts 单元测试
 *
 * 测试所有转换函数的正确性
 */

import { describe, it, expect } from 'vitest';
import {
  inferProvider,
  inferModelCategory,
  quotaToUsd,
  timestampToDateKey,
  aggregateByTime,
  computeSummary,
  computeCostTrend,
  computeTokenTrend,
  computeModelAnalysis,
  computeTopConsumers,
  filterByModelCategory,
  filterByChannel,
  filterByGroup,
} from '../src/transforms/quota-transform';
import type { RawQuotaData } from '../src/types/usage';

// ============================================================
// Helper: 生成测试用 RawQuotaData
// ============================================================

function createMockRecord(overrides: Partial<RawQuotaData> = {}): RawQuotaData {
  return {
    id: 1,
    user_id: 100,
    username: 'testuser',
    model_name: 'gpt-4o',
    created_at: 1721520000, // 2024-07-21T00:00:00 UTC
    token_used: 15000,
    count: 42,
    quota: 50000,
    prompt_tokens: 8000,
    completion_tokens: 7000,
    model_ratio: 30,
    completion_ratio: 2,
    channel_id: 1,
    group: 'default',
    avg_use_time: 850,
    max_use_time: 2300,
    stream_count: 30,
    error_count: 2,
    total_use_time: 35700,
    ...overrides,
  };
}

// ============================================================
// inferProvider
// ============================================================

describe('inferProvider', () => {
  it('should detect OpenAI models', () => {
    expect(inferProvider('gpt-4o')).toBe('OpenAI');
    expect(inferProvider('gpt-4o-mini')).toBe('OpenAI');
    expect(inferProvider('o1-preview')).toBe('OpenAI');
    expect(inferProvider('dall-e-3')).toBe('OpenAI');
    expect(inferProvider('whisper-1')).toBe('OpenAI');
  });

  it('should detect Anthropic models', () => {
    expect(inferProvider('claude-sonnet-4')).toBe('Anthropic');
    expect(inferProvider('claude-3.5-haiku')).toBe('Anthropic');
  });

  it('should detect Google models', () => {
    expect(inferProvider('gemini-2.5-pro')).toBe('Google');
    expect(inferProvider('gemini-1.5-pro')).toBe('Google');
  });

  it('should detect DeepSeek models', () => {
    expect(inferProvider('deepseek-v3')).toBe('DeepSeek');
    expect(inferProvider('deepseek-coder')).toBe('DeepSeek');
  });

  it('should fallback to Other for unknown', () => {
    expect(inferProvider('unknown-model')).toBe('Other');
  });
});

// ============================================================
// inferModelCategory
// ============================================================

describe('inferModelCategory', () => {
  it('should detect text models', () => {
    expect(inferModelCategory('gpt-4o')).toBe('text');
    expect(inferModelCategory('claude-sonnet-4')).toBe('text');
    expect(inferModelCategory('llama-3')).toBe('text');
  });

  it('should detect image models', () => {
    expect(inferModelCategory('dall-e-3')).toBe('image');
    expect(inferModelCategory('stable-diffusion-xl')).toBe('image');
    expect(inferModelCategory('imagen-3')).toBe('image');
  });

  it('should detect audio models', () => {
    expect(inferModelCategory('whisper-1')).toBe('audio');
    expect(inferModelCategory('tts-1')).toBe('audio');
  });

  it('should detect embedding models', () => {
    expect(inferModelCategory('text-embedding-3-large')).toBe('embedding');
    expect(inferModelCategory('embedding-ada-002')).toBe('embedding');
  });
});

// ============================================================
// quotaToUsd
// ============================================================

describe('quotaToUsd', () => {
  it('should convert quota to USD using default rate', () => {
    // Default rate: 1/500000
    expect(quotaToUsd(500000)).toBeCloseTo(1, 2);
    expect(quotaToUsd(1000000)).toBeCloseTo(2, 2);
    expect(quotaToUsd(250000)).toBeCloseTo(0.5, 2);
  });

  it('should use custom rate when provided', () => {
    const rate = 1 / 1000000; // 1M quota = 1 USD
    expect(quotaToUsd(1000000, rate)).toBeCloseTo(1, 2);
    expect(quotaToUsd(500000, rate)).toBeCloseTo(0.5, 2);
  });

  it('should handle zero quota', () => {
    expect(quotaToUsd(0)).toBe(0);
  });
});

// ============================================================
// timestampToDateKey
// ============================================================

describe('timestampToDateKey', () => {
  const ts20240721 = 1721520000; // 2024-07-21 00:00:00 UTC
  const ts2024072115 = 1721589600; // 2024-07-21 15:00:00 UTC

  it('should format as daily key', () => {
    expect(timestampToDateKey(ts20240721, 'daily')).toBe('2024-07-21');
  });

  it('should format as hourly key', () => {
    expect(timestampToDateKey(ts2024072115, 'hourly')).toBe('2024-07-21T15:00');
  });

  it('should format as monthly key', () => {
    expect(timestampToDateKey(ts20240721, 'monthly')).toBe('2024-07');
  });
});

// ============================================================
// aggregateByTime
// ============================================================

describe('aggregateByTime', () => {
  it('should bucket data by day', () => {
    const data = [
      createMockRecord({ created_at: 1721520000, model_name: 'gpt-4o', quota: 10000 }),
      createMockRecord({ created_at: 1721520000, model_name: 'claude', quota: 20000 }),
      createMockRecord({ created_at: 1721606400, model_name: 'gpt-4o', quota: 15000 }), // next day
    ];

    const buckets = aggregateByTime(data, 'daily');

    expect(buckets.length).toBe(2);
    expect(buckets[0].dateKey).toBe('2024-07-21');
    expect(buckets[0].records.length).toBe(2);
    expect(buckets[1].dateKey).toBe('2024-07-22');
    expect(buckets[1].records.length).toBe(1);
  });

  it('should sort buckets by date', () => {
    const data = [
      createMockRecord({ created_at: 1721606400, quota: 10000 }), // July 22
      createMockRecord({ created_at: 1721520000, quota: 10000 }), // July 21
    ];

    const buckets = aggregateByTime(data, 'daily');
    expect(buckets[0].dateKey).toBe('2024-07-21');
    expect(buckets[1].dateKey).toBe('2024-07-22');
  });
});

// ============================================================
// computeSummary
// ============================================================

describe('computeSummary', () => {
  it('should aggregate all metrics', () => {
    const data = [
      createMockRecord({ count: 100, token_used: 10000, quota: 100000, total_use_time: 50000, error_count: 5 }),
      createMockRecord({ count: 50, token_used: 5000, quota: 50000, total_use_time: 25000, error_count: 2 }),
    ];

    const summary = computeSummary(data);

    expect(summary.totalRequests.value).toBe(150);
    expect(summary.totalTokens.value).toBe(15000);
    expect(summary.avgLatency.value).toBe(500); // (50000+25000)/(100+50)
    expect(summary.successRate.value).toBeCloseTo(93.33, 1);
  });

  it('should calculate change rate against previous period', () => {
    const current = [createMockRecord({ count: 100, token_used: 10000, quota: 100000, total_use_time: 50000, error_count: 5 })];
    const previous = [createMockRecord({ count: 50, token_used: 5000, quota: 50000, total_use_time: 25000, error_count: 2 })];

    const summary = computeSummary(current, previous);

    expect(summary.totalRequests.value).toBe(100);
    expect(summary.totalRequests.previousValue).toBe(50);
    expect(summary.totalRequests.changeRate).toBe(100); // +100%
  });

  it('should include upstream cost when available', () => {
    const data = [
      createMockRecord({ quota: 50000, upstream_cost: 30 }),
    ];

    const summary = computeSummary(data);

    expect(summary.upstreamCost).toBeDefined();
    expect(summary.upstreamCost?.value).toBeCloseTo(0.1, 1); // 50000 * 1/500000 = 0.1
    expect(summary.profitMargin).toBeDefined();
  });
});

// ============================================================
// computeCostTrend
// ============================================================

describe('computeCostTrend', () => {
  it('should aggregate cost by day and model', () => {
    const data = [
      createMockRecord({ created_at: 1721520000, model_name: 'gpt-4o', quota: 100000 }),
      createMockRecord({ created_at: 1721520000, model_name: 'claude', quota: 50000 }),
      createMockRecord({ created_at: 1721606400, model_name: 'gpt-4o', quota: 120000 }),
    ];

    const trend = computeCostTrend(data, 'daily');

    expect(trend.series.length).toBe(2);
    expect(trend.models).toContain('gpt-4o');
    expect(trend.models).toContain('claude');

    // First day total: 100000 + 50000 = 150000 quota -> USD
    expect(trend.series[0].totalCost).toBeGreaterThan(0);
  });

  it('should calculate projected monthly', () => {
    const data = [
      createMockRecord({ created_at: 1721520000, quota: 50000 }),
      createMockRecord({ created_at: 1721606400, quota: 50000 }),
    ];

    const trend = computeCostTrend(data, 'daily');

    // 2 days, 50000 quota each = 100000 total / 2 = 50000 daily avg * 30 = 1.5M quota -> USD
    expect(trend.projectedMonthly).toBeGreaterThan(0);
  });
});

// ============================================================
// computeTokenTrend
// ============================================================

describe('computeTokenTrend', () => {
  it('should aggregate tokens by day', () => {
    const data = [
      createMockRecord({ created_at: 1721520000, prompt_tokens: 1000, completion_tokens: 500, count: 10 }),
      createMockRecord({ created_at: 1721606400, prompt_tokens: 2000, completion_tokens: 1000, count: 20 }),
    ];

    const trend = computeTokenTrend(data, 'daily');

    expect(trend.series.length).toBe(2);
    expect(trend.total.input).toBe(3000);
    expect(trend.total.output).toBe(1500);
    expect(trend.total.total).toBe(4500);
  });

  it('should identify peak day', () => {
    const data = [
      createMockRecord({ created_at: 1721520000, prompt_tokens: 1000, completion_tokens: 500 }),
      createMockRecord({ created_at: 1721606400, prompt_tokens: 5000, completion_tokens: 2500 }),
    ];

    const trend = computeTokenTrend(data, 'daily');

    expect(trend.peakDay.date).toBe('2024-07-22');
    expect(trend.peakDay.tokens).toBe(7500);
  });
});

// ============================================================
// computeModelAnalysis
// ============================================================

describe('computeModelAnalysis', () => {
  it('should aggregate by model', () => {
    const data = [
      createMockRecord({ model_name: 'gpt-4o', count: 100, prompt_tokens: 10000, completion_tokens: 5000, quota: 100000 }),
      createMockRecord({ model_name: 'claude', count: 50, prompt_tokens: 5000, completion_tokens: 2500, quota: 50000 }),
    ];

    const analysis = computeModelAnalysis(data);

    expect(analysis.models.length).toBe(2);
    expect(analysis.models[0].costShare).toBeGreaterThan(analysis.models[1].costShare);
  });

  it('should infer provider and category', () => {
    const data = [createMockRecord({ model_name: 'gpt-4o' })];

    const analysis = computeModelAnalysis(data);

    expect(analysis.models[0].provider).toBe('OpenAI');
    expect(analysis.models[0].category).toBe('text');
  });
});

// ============================================================
// computeTopConsumers
// ============================================================

describe('computeTopConsumers', () => {
  it('should aggregate by user', () => {
    const data = [
      createMockRecord({ username: 'alice', count: 100, token_used: 10000, quota: 100000 }),
      createMockRecord({ username: 'bob', count: 50, token_used: 5000, quota: 50000 }),
    ];

    const top = computeTopConsumers(data, 'user', 'cost', 'desc', 10);

    expect(top.consumers.length).toBe(2);
    expect(top.consumers[0].name).toBe('alice');
    expect(top.consumers[0].share).toBeGreaterThan(top.consumers[1].share);
  });

  it('should aggregate by channel', () => {
    const data = [
      createMockRecord({ channel_id: 1, count: 100, token_used: 10000, quota: 100000 }),
      createMockRecord({ channel_id: 2, count: 50, token_used: 5000, quota: 50000 }),
    ];

    const top = computeTopConsumers(data, 'channel', 'cost', 'desc', 10);

    expect(top.consumers.length).toBe(2);
    expect(top.consumers[0].type).toBe('channel');
  });

  it('should respect limit', () => {
    const data = Array.from({ length: 20 }, (_, i) =>
      createMockRecord({ username: `user${i}`, count: 100 - i, quota: (100 - i) * 1000 })
    );

    const top = computeTopConsumers(data, 'user', 'cost', 'desc', 5);

    expect(top.consumers.length).toBe(5);
  });
});

// ============================================================
// filterByModelCategory
// ============================================================

describe('filterByModelCategory', () => {
  it('should return all when category is all', () => {
    const data = [
      createMockRecord({ model_name: 'gpt-4o' }),
      createMockRecord({ model_name: 'dall-e-3' }),
    ];

    expect(filterByModelCategory(data, 'all').length).toBe(2);
  });

  it('should filter by category', () => {
    const data = [
      createMockRecord({ model_name: 'gpt-4o' }),
      createMockRecord({ model_name: 'dall-e-3' }),
    ];

    const filtered = filterByModelCategory(data, 'image');
    expect(filtered.length).toBe(1);
    expect(filtered[0].model_name).toBe('dall-e-3');
  });

  it('should use model_category field when available', () => {
    const data = [
      createMockRecord({ model_name: 'custom-model', model_category: 'image' }),
    ];

    const filtered = filterByModelCategory(data, 'image');
    expect(filtered.length).toBe(1);
  });
});

// ============================================================
// filterByChannel / filterByGroup
// ============================================================

describe('filterByChannel', () => {
  it('should filter by channel_id', () => {
    const data = [
      createMockRecord({ channel_id: 1 }),
      createMockRecord({ channel_id: 2 }),
    ];

    expect(filterByChannel(data, 1).length).toBe(1);
  });
});

describe('filterByGroup', () => {
  it('should filter by group', () => {
    const data = [
      createMockRecord({ group: 'vip' }),
      createMockRecord({ group: 'default' }),
    ];

    expect(filterByGroup(data, 'vip').length).toBe(1);
  });
});
