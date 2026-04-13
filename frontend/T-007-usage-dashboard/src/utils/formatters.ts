/**
 * 数字 / 金额 / Token 格式化工具
 *
 * 将原始数值转换为人类可读的显示格式
 */

// ============================================================
// 数字缩写
// ============================================================

/**
 * 将大数字缩写为 K / M / B 格式
 *
 * @example
 * compactNumber(1234)       // '1.2K'
 * compactNumber(1234567)    // '1.2M'
 * compactNumber(45)         // '45'
 */
export function compactNumber(value: number, precision = 1): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(precision)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(precision)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(precision)}K`;
  }
  return `${sign}${abs.toFixed(abs % 1 === 0 ? 0 : precision)}`;
}

// ============================================================
// 金额格式化
// ============================================================

/**
 * 格式化费用金额
 *
 * @example
 * formatCost(1234.5)        // '$1,234.50'
 * formatCost(0.003456, 4)   // '$0.0035'
 * formatCost(1234567)       // '$1.2M'
 */
export function formatCost(
  value: number,
  precision = 2,
  currency = '$',
  compact = true
): string {
  if (compact && Math.abs(value) >= 10_000) {
    return `${currency}${compactNumber(value, precision)}`;
  }
  return `${currency}${value.toLocaleString('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })}`;
}

/**
 * 格式化费用变化率
 *
 * @example
 * formatCostChange(12.5)   // '+12.5%'
 * formatCostChange(-3.2)   // '-3.2%'
 * formatCostChange(0)      // '0%'
 */
export function formatChangeRate(rate: number | undefined, precision = 1): string {
  if (rate === undefined || rate === null) return '--';
  if (rate === 0) return '0%';
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate.toFixed(precision)}%`;
}

// ============================================================
// Token 格式化
// ============================================================

/**
 * 格式化 Token 数量
 *
 * @example
 * formatTokens(123456)   // '123.5K'
 * formatTokens(500)      // '500'
 */
export function formatTokens(value: number): string {
  return compactNumber(value, 1);
}

/**
 * 格式化 Token 含单位
 *
 * @example
 * formatTokensWithUnit(1234567)  // '1.2M tokens'
 */
export function formatTokensWithUnit(value: number): string {
  return `${formatTokens(value)} tokens`;
}

// ============================================================
// 延迟格式化
// ============================================================

/**
 * 格式化延迟 (毫秒)
 *
 * @example
 * formatLatency(1234)  // '1.23s'
 * formatLatency(456)   // '456ms'
 * formatLatency(50)    // '50ms'
 */
export function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)}ms`;
}

// ============================================================
// 百分比格式化
// ============================================================

/**
 * 格式化百分比
 *
 * @example
 * formatPercent(99.95)  // '99.95%'
 * formatPercent(0.5)    // '0.50%'
 */
export function formatPercent(value: number, precision = 2): string {
  return `${value.toFixed(precision)}%`;
}

// ============================================================
// 请求量格式化
// ============================================================

/**
 * 格式化请求量
 *
 * @example
 * formatRequests(12345)  // '12.3K req'
 */
export function formatRequests(value: number): string {
  return `${compactNumber(value)} req`;
}

// ============================================================
// 日期格式化
// ============================================================

/**
 * 格式化日期为短格式
 *
 * @example
 * formatDate('2024-01-15T00:00:00Z')  // 'Jan 15'
 * formatDate('2024-01-15T14:30:00Z', true)  // 'Jan 15 14:30'
 */
export function formatDate(iso: string, showTime = false): string {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const day = d.getDate();

  if (showTime) {
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `${month} ${day} ${hh}:${mm}`;
  }

  return `${month} ${day}`;
}

/**
 * 格式化相对时间
 *
 * @example
 * formatRelativeTime('2024-01-15T10:00:00Z')  // '2 hours ago'
 */
export function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

// ============================================================
// 计算工具
// ============================================================

/**
 * 计算变化率
 */
export function calcChangeRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * 判断趋势方向
 */
export function getTrend(changeRate: number): 'up' | 'down' | 'flat' {
  if (changeRate > 0.5) return 'up';
  if (changeRate < -0.5) return 'down';
  return 'flat';
}
