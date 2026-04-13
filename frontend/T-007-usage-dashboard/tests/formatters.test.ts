/**
 * 格式化工具单元测试
 *
 * 包含 quotaToUsd 测试
 */

import { describe, it, expect } from 'vitest';
import {
  compactNumber,
  formatCost,
  formatChangeRate,
  formatTokens,
  formatTokensWithUnit,
  formatLatency,
  formatPercent,
  formatRequests,
  formatDate,
  calcChangeRate,
  getTrend,
} from '../src/utils/formatters';
import { quotaToUsd } from '../src/transforms/quota-transform';

// ============================================================
// compactNumber
// ============================================================

describe('compactNumber', () => {
  it('should return raw value for small numbers', () => {
    expect(compactNumber(42)).toBe('42');
    expect(compactNumber(999)).toBe('999');
  });

  it('should format thousands as K', () => {
    expect(compactNumber(1234)).toBe('1.2K');
    expect(compactNumber(5678)).toBe('5.7K');
    expect(compactNumber(1000)).toBe('1.0K');
  });

  it('should format millions as M', () => {
    expect(compactNumber(1234567)).toBe('1.2M');
    expect(compactNumber(45000000)).toBe('45.0M');
  });

  it('should format billions as B', () => {
    expect(compactNumber(1234567890)).toBe('1.2B');
  });

  it('should handle negative numbers', () => {
    expect(compactNumber(-1234)).toBe('-1.2K');
    expect(compactNumber(-42)).toBe('-42');
  });

  it('should respect precision', () => {
    expect(compactNumber(1234, 2)).toBe('1.23K');
    expect(compactNumber(1234, 0)).toBe('1K');
  });

  it('should handle zero', () => {
    expect(compactNumber(0)).toBe('0');
  });

  it('should handle decimals', () => {
    expect(compactNumber(3.14)).toBe('3.1');
  });
});

// ============================================================
// formatCost
// ============================================================

describe('formatCost', () => {
  it('should format with dollar sign', () => {
    expect(formatCost(123.45)).toBe('$123.45');
  });

  it('should use compact for large values', () => {
    expect(formatCost(12345)).toBe('$12.3K');
    expect(formatCost(1234567)).toBe('$1.2M');
  });

  it('should respect precision', () => {
    expect(formatCost(0.003456, 4)).toBe('$0.0035');
  });

  it('should handle zero', () => {
    expect(formatCost(0)).toBe('$0.00');
  });

  it('should use custom currency', () => {
    expect(formatCost(99.99, 2, '¥')).toBe('¥99.99');
  });

  it('should not compact when disabled', () => {
    expect(formatCost(50000, 2, '$', false)).toBe('$50,000.00');
  });
});

// ============================================================
// formatChangeRate
// ============================================================

describe('formatChangeRate', () => {
  it('should format positive rate with +', () => {
    expect(formatChangeRate(12.5)).toBe('+12.5%');
  });

  it('should format negative rate', () => {
    expect(formatChangeRate(-3.2)).toBe('-3.2%');
  });

  it('should format zero', () => {
    expect(formatChangeRate(0)).toBe('0%');
  });

  it('should handle undefined', () => {
    expect(formatChangeRate(undefined)).toBe('--');
  });
});

// ============================================================
// formatTokens / formatTokensWithUnit
// ============================================================

describe('formatTokens', () => {
  it('should format tokens with compact notation', () => {
    expect(formatTokens(500)).toBe('500');
    expect(formatTokens(123456)).toBe('123.5K');
    expect(formatTokens(45000000)).toBe('45.0M');
  });
});

describe('formatTokensWithUnit', () => {
  it('should append "tokens" suffix', () => {
    expect(formatTokensWithUnit(1234567)).toBe('1.2M tokens');
  });
});

// ============================================================
// formatLatency
// ============================================================

describe('formatLatency', () => {
  it('should format milliseconds', () => {
    expect(formatLatency(50)).toBe('50ms');
    expect(formatLatency(456)).toBe('456ms');
  });

  it('should format seconds', () => {
    expect(formatLatency(1234)).toBe('1.23s');
    expect(formatLatency(2500)).toBe('2.50s');
  });
});

// ============================================================
// formatPercent
// ============================================================

describe('formatPercent', () => {
  it('should format with default precision', () => {
    expect(formatPercent(99.95)).toBe('99.95%');
    expect(formatPercent(0.5)).toBe('0.50%');
  });

  it('should respect precision', () => {
    expect(formatPercent(99.956, 1)).toBe('100.0%');
  });
});

// ============================================================
// formatRequests
// ============================================================

describe('formatRequests', () => {
  it('should format with suffix', () => {
    expect(formatRequests(12345)).toBe('12.3K req');
    expect(formatRequests(50)).toBe('50 req');
  });
});

// ============================================================
// formatDate
// ============================================================

describe('formatDate', () => {
  it('should format as month + day', () => {
    const result = formatDate('2024-01-15T00:00:00Z');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });

  it('should include time when requested', () => {
    const result = formatDate('2024-06-20T14:30:00Z', true);
    expect(result).toContain('Jun');
    expect(result).toContain('20');
    // Time depends on timezone, just check format
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

// ============================================================
// calcChangeRate / getTrend
// ============================================================

describe('calcChangeRate', () => {
  it('should calculate positive change', () => {
    expect(calcChangeRate(120, 100)).toBeCloseTo(20);
  });

  it('should calculate negative change', () => {
    expect(calcChangeRate(80, 100)).toBeCloseTo(-20);
  });

  it('should handle zero previous', () => {
    expect(calcChangeRate(50, 0)).toBe(100);
    expect(calcChangeRate(0, 0)).toBe(0);
  });
});

describe('getTrend', () => {
  it('should detect up trend', () => {
    expect(getTrend(5)).toBe('up');
  });

  it('should detect down trend', () => {
    expect(getTrend(-5)).toBe('down');
  });

  it('should detect flat trend', () => {
    expect(getTrend(0)).toBe('flat');
    expect(getTrend(0.3)).toBe('flat');
    expect(getTrend(-0.2)).toBe('flat');
  });
});

// ============================================================
// quotaToUsd (from quota-transform)
// ============================================================

describe('quotaToUsd', () => {
  it('should convert quota to USD using default rate', () => {
    // Default rate: 1/500000
    expect(quotaToUsd(500000)).toBeCloseTo(1, 2);
    expect(quotaToUsd(1000000)).toBeCloseTo(2, 2);
    expect(quotaToUsd(250000)).toBeCloseTo(0.5, 2);
  });

  it('should use custom rate when provided', () => {
    const rate = 1 / 1000000;
    expect(quotaToUsd(1000000, rate)).toBeCloseTo(1, 2);
    expect(quotaToUsd(500000, rate)).toBeCloseTo(0.5, 2);
  });

  it('should handle zero quota', () => {
    expect(quotaToUsd(0)).toBe(0);
  });

  it('should handle negative quota', () => {
    expect(quotaToUsd(-500000)).toBeCloseTo(-1, 2);
  });
});
