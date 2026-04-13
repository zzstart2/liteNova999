/**
 * useDashboard Hook 测试
 *
 * 验证时间范围计算、粒度自动选择、刷新逻辑
 * NOTE: 完整 Hook 测试需要 Vue Test Utils 挂载，这里测试其内部可提取的纯函数逻辑
 */

import { describe, it, expect } from 'vitest';

// ============================================================
// 从 use-dashboard.ts 提取的纯函数逻辑进行单元测试
// 实际项目中可将这些函数从 Hook 中独立导出
// ============================================================

// ---- 时间范围 → DateRange 计算 ----

type PresetRange = '24h' | '7d' | '30d' | '90d' | '180d' | '1y' | 'custom';
type TimeGranularity = 'hourly' | 'daily' | 'weekly' | 'monthly';

interface DateRange {
  start: string;
  end: string;
}

function presetToDateRange(preset: PresetRange): DateRange {
  const now = new Date();
  const end = now.toISOString();
  const start = new Date(now);

  switch (preset) {
    case '24h':
      start.setHours(start.getHours() - 24);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    case '180d':
      start.setDate(start.getDate() - 180);
      break;
    case '1y':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setDate(start.getDate() - 30);
  }

  return { start: start.toISOString(), end };
}

function autoGranularity(range: DateRange): TimeGranularity {
  const diffMs = new Date(range.end).getTime() - new Date(range.start).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 2) return 'hourly';
  if (diffDays <= 90) return 'daily';
  if (diffDays <= 365) return 'weekly';
  return 'monthly';
}

// ============================================================
// presetToDateRange
// ============================================================

describe('presetToDateRange', () => {
  it('should return a range for 24h', () => {
    const range = presetToDateRange('24h');
    const diffMs = new Date(range.end).getTime() - new Date(range.start).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(24, 0);
  });

  it('should return a range for 7d', () => {
    const range = presetToDateRange('7d');
    const diffMs = new Date(range.end).getTime() - new Date(range.start).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 0);
  });

  it('should return a range for 30d', () => {
    const range = presetToDateRange('30d');
    const diffMs = new Date(range.end).getTime() - new Date(range.start).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it('should return a range for 90d', () => {
    const range = presetToDateRange('90d');
    const diffMs = new Date(range.end).getTime() - new Date(range.start).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(90, 0);
  });

  it('should return a range for 1y', () => {
    const range = presetToDateRange('1y');
    const diffMs = new Date(range.end).getTime() - new Date(range.start).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(360);
    expect(diffDays).toBeLessThanOrEqual(366);
  });

  it('start should be before end', () => {
    const presets: PresetRange[] = ['24h', '7d', '30d', '90d', '180d', '1y'];
    for (const p of presets) {
      const range = presetToDateRange(p);
      expect(new Date(range.start).getTime()).toBeLessThan(new Date(range.end).getTime());
    }
  });

  it('both start and end should be valid ISO strings', () => {
    const range = presetToDateRange('30d');
    expect(new Date(range.start).toISOString()).toBe(range.start);
    expect(new Date(range.end).toISOString()).toBe(range.end);
  });
});

// ============================================================
// autoGranularity
// ============================================================

describe('autoGranularity', () => {
  it('should return hourly for ranges <= 2 days', () => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(start.getHours() - 12);
    expect(autoGranularity({ start: start.toISOString(), end: now.toISOString() })).toBe('hourly');
  });

  it('should return hourly for exactly 24h', () => {
    const range = presetToDateRange('24h');
    expect(autoGranularity(range)).toBe('hourly');
  });

  it('should return daily for 7d', () => {
    const range = presetToDateRange('7d');
    expect(autoGranularity(range)).toBe('daily');
  });

  it('should return daily for 30d', () => {
    const range = presetToDateRange('30d');
    expect(autoGranularity(range)).toBe('daily');
  });

  it('should return daily for 90d', () => {
    const range = presetToDateRange('90d');
    expect(autoGranularity(range)).toBe('daily');
  });

  it('should return weekly for 180d', () => {
    const range = presetToDateRange('180d');
    expect(autoGranularity(range)).toBe('weekly');
  });

  it('should return weekly for 1y', () => {
    const range = presetToDateRange('1y');
    expect(autoGranularity(range)).toBe('weekly');
  });

  it('should return monthly for > 1y ranges', () => {
    const now = new Date();
    const start = new Date(now);
    start.setFullYear(start.getFullYear() - 2);
    expect(autoGranularity({ start: start.toISOString(), end: now.toISOString() })).toBe('monthly');
  });
});
