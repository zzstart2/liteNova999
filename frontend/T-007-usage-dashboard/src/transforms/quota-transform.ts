/**
 * quota-transform.ts — 数据转换层
 *
 * 将后端 RawQuotaData[] 聚合、转换为前端仪表盘所需的各类数据结构。
 * 所有函数均为纯函数，无副作用。
 */

import type {
  RawQuotaData,
  TimeGranularity,
  DashboardSummary,
  StatMetric,
  CostTrendData,
  CostDataPoint,
  TokenTrendData,
  TokenDataPoint,
  ModelAnalysisData,
  ModelStats,
  LabeledTimeSeries,
  TopConsumersData,
  ConsumerType,
  ConsumerStats,
  SortDimension,
  SortOrder,
} from '../types/usage';

// ============================================================
// Constants
// ============================================================

/** 默认 quota → USD 换算率 (500000 quota = 1 USD) */
const DEFAULT_QUOTA_TO_USD_RATE = 1 / 500000;

// ============================================================
// Helpers — Provider & Category Inference
// ============================================================

/**
 * 从模型名推断供应商
 *
 * @example inferProvider('gpt-4o')  // 'OpenAI'
 * @example inferProvider('claude-sonnet-4')  // 'Anthropic'
 */
export function inferProvider(modelName: string): string {
  const lower = modelName.toLowerCase();

  if (lower.startsWith('gpt') || lower.includes('o1') || lower.includes('o3') || lower.includes('o4') || lower.startsWith('dall-e') || lower.startsWith('whisper') || lower.startsWith('tts')) {
    return 'OpenAI';
  }
  if (lower.startsWith('claude')) return 'Anthropic';
  if (lower.startsWith('gemini') || lower.startsWith('palm')) return 'Google';
  if (lower.startsWith('deepseek')) return 'DeepSeek';
  if (lower.startsWith('qwen') || lower.startsWith('tongyi')) return 'Alibaba';
  if (lower.startsWith('glm') || lower.startsWith('chatglm')) return 'Zhipu';
  if (lower.startsWith('ernie') || lower.startsWith('wenxin')) return 'Baidu';
  if (lower.startsWith('llama') || lower.startsWith('meta-llama')) return 'Meta';
  if (lower.startsWith('mistral') || lower.startsWith('mixtral')) return 'Mistral';
  if (lower.startsWith('yi-')) return '01.AI';
  if (lower.startsWith('moonshot') || lower.startsWith('kimi')) return 'Moonshot';
  if (lower.startsWith('spark')) return 'iFlytek';
  if (lower.startsWith('hunyuan')) return 'Tencent';
  if (lower.includes('stable-diffusion') || lower.includes('sdxl')) return 'Stability';
  if (lower.startsWith('command') || lower.startsWith('cohere')) return 'Cohere';

  return 'Other';
}

/**
 * 从模型名推断模型类别
 *
 * @example inferModelCategory('gpt-4o')       // 'text'
 * @example inferModelCategory('dall-e-3')     // 'image'
 * @example inferModelCategory('whisper-1')    // 'audio'
 */
export function inferModelCategory(modelName: string): string {
  const lower = modelName.toLowerCase();

  // Image models
  if (
    lower.includes('dall-e') ||
    lower.includes('dalle') ||
    lower.includes('stable-diffusion') ||
    lower.includes('sdxl') ||
    lower.includes('midjourney') ||
    lower.includes('imagen')
  ) {
    return 'image';
  }

  // Audio models
  if (
    lower.includes('whisper') ||
    lower.includes('tts') ||
    lower.includes('audio')
  ) {
    return 'audio';
  }

  // Video models
  if (
    lower.includes('sora') ||
    lower.includes('video') ||
    lower.includes('gen-2') ||
    lower.includes('runway')
  ) {
    return 'video';
  }

  // Embedding models
  if (
    lower.includes('embedding') ||
    lower.includes('embed') ||
    lower.startsWith('text-embedding')
  ) {
    return 'embedding';
  }

  // Default: text
  return 'text';
}

// ============================================================
// Core: Quota → USD conversion
// ============================================================

/**
 * 将内部 quota 转换为 USD 等价金额
 *
 * @param quota   — 内部配额单位
 * @param rate    — 换算率 (默认 1/500000)
 * @returns USD 金额
 */
export function quotaToUsd(quota: number, rate: number = DEFAULT_QUOTA_TO_USD_RATE): number {
  return quota * rate;
}

// ============================================================
// Time bucketing
// ============================================================

/**
 * 将 Unix 时间戳（秒）格式化为日期 key
 *
 * @param unixSeconds — Unix 时间戳（秒）
 * @param granularity — 聚合粒度
 * @returns 日期 key (如 '2024-07-21', '2024-W29', '2024-07')
 */
export function timestampToDateKey(unixSeconds: number, granularity: TimeGranularity): string {
  const d = new Date(unixSeconds * 1000);

  switch (granularity) {
    case 'hourly': {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const hh = String(d.getUTCHours()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}T${hh}:00`;
    }
    case 'daily': {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    case 'weekly': {
      // ISO week: Monday-based. Find the Monday of this week.
      const day = d.getUTCDay();
      const diff = (day === 0 ? -6 : 1) - day; // days to Monday
      const monday = new Date(d);
      monday.setUTCDate(monday.getUTCDate() + diff);
      const yyyy = monday.getUTCFullYear();
      const mm = String(monday.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(monday.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    case 'monthly': {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      return `${yyyy}-${mm}`;
    }
    default:
      return d.toISOString().split('T')[0];
  }
}

// ============================================================
// aggregateByTime
// ============================================================

/** 一个时间桶内的聚合数据 */
export interface TimeBucket {
  dateKey: string;
  records: RawQuotaData[];
}

/**
 * 将原始小时级数据按粒度分桶
 *
 * @param data        — RawQuotaData 数组（可乱序）
 * @param granularity — 目标粒度
 * @returns 按时间排序的桶数组
 */
export function aggregateByTime(
  data: ReadonlyArray<RawQuotaData>,
  granularity: TimeGranularity
): TimeBucket[] {
  const bucketMap = new Map<string, RawQuotaData[]>();

  for (const record of data) {
    const key = timestampToDateKey(record.created_at, granularity);
    const existing = bucketMap.get(key);
    if (existing) {
      existing.push(record);
    } else {
      bucketMap.set(key, [record]);
    }
  }

  // Sort by date key
  return Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, records]) => ({ dateKey, records }));
}

// ============================================================
// computeSummary
// ============================================================

/**
 * 从原始数据计算 DashboardSummary
 *
 * @param data         — 当前周期的原始数据
 * @param previousData — 上期数据（用于计算变化率），可选
 * @param rate         — quota→USD 换算率
 */
export function computeSummary(
  data: ReadonlyArray<RawQuotaData>,
  previousData: ReadonlyArray<RawQuotaData> = [],
  rate: number = DEFAULT_QUOTA_TO_USD_RATE
): DashboardSummary {
  // ---- Current period aggregation ----
  let totalRequests = 0;
  let totalTokens = 0;
  let totalQuota = 0;
  let totalUseTime = 0;
  let totalCount = 0; // for weighted avg latency
  let errorCount = 0;
  let totalUpstreamCost = 0;
  let hasUpstreamCost = false;
  const modelSet = new Set<string>();

  for (const r of data) {
    totalRequests += r.count;
    totalTokens += r.token_used;
    totalQuota += r.quota;
    totalUseTime += r.total_use_time;
    totalCount += r.count;
    errorCount += r.error_count;
    modelSet.add(r.model_name);
    if (r.upstream_cost !== undefined) {
      totalUpstreamCost += r.upstream_cost;
      hasUpstreamCost = true;
    }
  }

  const totalCostUsd = quotaToUsd(totalQuota, rate);
  const avgLatency = totalCount > 0 ? totalUseTime / totalCount : 0;
  const successRate = totalRequests > 0 ? ((totalRequests - errorCount) / totalRequests) * 100 : 100;

  // ---- Previous period aggregation ----
  let prevRequests = 0;
  let prevTokens = 0;
  let prevQuota = 0;
  let prevUseTime = 0;
  let prevCount = 0;
  let prevErrorCount = 0;
  let prevUpstreamCost = 0;
  const prevModelSet = new Set<string>();

  for (const r of previousData) {
    prevRequests += r.count;
    prevTokens += r.token_used;
    prevQuota += r.quota;
    prevUseTime += r.total_use_time;
    prevCount += r.count;
    prevErrorCount += r.error_count;
    prevModelSet.add(r.model_name);
    if (r.upstream_cost !== undefined) {
      prevUpstreamCost += r.upstream_cost;
    }
  }

  const prevCostUsd = quotaToUsd(prevQuota, rate);
  const prevAvgLatency = prevCount > 0 ? prevUseTime / prevCount : 0;
  const prevSuccessRate = prevRequests > 0 ? ((prevRequests - prevErrorCount) / prevRequests) * 100 : 100;

  function buildMetric(current: number, previous: number): StatMetric {
    const changeRate = previous > 0 ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0);
    return {
      value: current,
      previousValue: previous || undefined,
      changeRate: Math.round(changeRate * 10) / 10,
      trend: changeRate > 0.5 ? 'up' : changeRate < -0.5 ? 'down' : 'flat',
    };
  }

  const summary: DashboardSummary = {
    totalRequests: buildMetric(totalRequests, prevRequests),
    totalTokens: buildMetric(totalTokens, prevTokens),
    totalCost: buildMetric(Math.round(totalCostUsd * 100) / 100, Math.round(prevCostUsd * 100) / 100),
    avgLatency: buildMetric(Math.round(avgLatency), Math.round(prevAvgLatency)),
    successRate: buildMetric(Math.round(successRate * 100) / 100, Math.round(prevSuccessRate * 100) / 100),
    activeModels: buildMetric(modelSet.size, prevModelSet.size),
  };

  if (hasUpstreamCost) {
    summary.upstreamCost = buildMetric(
      Math.round(totalUpstreamCost * 100) / 100,
      Math.round(prevUpstreamCost * 100) / 100
    );
    const profitCurrent = totalCostUsd > 0 ? ((totalCostUsd - totalUpstreamCost) / totalCostUsd) * 100 : 0;
    const profitPrev = prevCostUsd > 0 ? ((prevCostUsd - prevUpstreamCost) / prevCostUsd) * 100 : 0;
    summary.profitMargin = buildMetric(
      Math.round(profitCurrent * 100) / 100,
      Math.round(profitPrev * 100) / 100
    );
  }

  return summary;
}

// ============================================================
// computeCostTrend
// ============================================================

/**
 * 从原始数据计算费用趋势
 *
 * @param data        — 原始数据
 * @param granularity — 时间粒度 (默认 daily)
 * @param rate        — quota→USD 换算率
 */
export function computeCostTrend(
  data: ReadonlyArray<RawQuotaData>,
  granularity: TimeGranularity = 'daily',
  rate: number = DEFAULT_QUOTA_TO_USD_RATE
): CostTrendData {
  const buckets = aggregateByTime(data, granularity);
  const modelSet = new Set<string>();

  // Collect all model names first
  for (const r of data) {
    modelSet.add(r.model_name);
  }
  const models = Array.from(modelSet).sort();

  let totalUpstreamCost = 0;
  let hasUpstreamCost = false;

  const series: CostDataPoint[] = buckets.map(({ dateKey, records }) => {
    const byModel: Record<string, number> = {};
    let totalCost = 0;
    let inputCost = 0;
    let outputCost = 0;
    let dayUpstreamCost = 0;

    for (const r of records) {
      const costUsd = quotaToUsd(r.quota, rate);
      const modelCost = byModel[r.model_name] || 0;
      byModel[r.model_name] = modelCost + costUsd;
      totalCost += costUsd;

      // Approximate input/output cost split based on token ratio
      const totalTokens = r.prompt_tokens + r.completion_tokens;
      if (totalTokens > 0) {
        inputCost += costUsd * (r.prompt_tokens / totalTokens);
        outputCost += costUsd * (r.completion_tokens / totalTokens);
      } else {
        inputCost += costUsd * 0.5;
        outputCost += costUsd * 0.5;
      }

      if (r.upstream_cost !== undefined) {
        dayUpstreamCost += r.upstream_cost;
        hasUpstreamCost = true;
      }
    }

    totalUpstreamCost += dayUpstreamCost;

    // Round values
    for (const model of Object.keys(byModel)) {
      byModel[model] = Math.round(byModel[model] * 100) / 100;
    }

    const point: CostDataPoint = {
      date: dateKey,
      totalCost: Math.round(totalCost * 100) / 100,
      byModel,
      inputCost: Math.round(inputCost * 100) / 100,
      outputCost: Math.round(outputCost * 100) / 100,
    };

    if (hasUpstreamCost) {
      point.upstreamCost = Math.round(dayUpstreamCost * 100) / 100;
    }

    return point;
  });

  const total = series.reduce((sum, d) => sum + d.totalCost, 0);
  const numBuckets = series.length || 1;

  const result: CostTrendData = {
    series,
    total: Math.round(total * 100) / 100,
    dailyAvg: Math.round((total / numBuckets) * 100) / 100,
    projectedMonthly: Math.round(((total / numBuckets) * 30) * 100) / 100,
    models,
  };

  if (hasUpstreamCost) {
    result.totalUpstreamCost = Math.round(totalUpstreamCost * 100) / 100;
  }

  return result;
}

// ============================================================
// computeTokenTrend
// ============================================================

/**
 * 从原始数据计算 Token 用量趋势
 */
export function computeTokenTrend(
  data: ReadonlyArray<RawQuotaData>,
  granularity: TimeGranularity = 'daily'
): TokenTrendData {
  const buckets = aggregateByTime(data, granularity);

  const series: TokenDataPoint[] = buckets.map(({ dateKey, records }) => {
    let inputTokens = 0;
    let outputTokens = 0;
    let requests = 0;

    for (const r of records) {
      inputTokens += r.prompt_tokens;
      outputTokens += r.completion_tokens;
      requests += r.count;
    }

    return {
      date: dateKey,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      requests,
    };
  });

  const totalInput = series.reduce((s, d) => s + d.inputTokens, 0);
  const totalOutput = series.reduce((s, d) => s + d.outputTokens, 0);
  const peakDay = series.length > 0
    ? series.reduce((max, d) => (d.totalTokens > max.totalTokens ? d : max), series[0])
    : { date: '', totalTokens: 0 };

  return {
    series,
    total: { input: totalInput, output: totalOutput, total: totalInput + totalOutput },
    dailyAvg: series.length > 0 ? Math.round((totalInput + totalOutput) / series.length) : 0,
    peakDay: { date: peakDay.date, tokens: peakDay.totalTokens },
  };
}

// ============================================================
// computeModelAnalysis
// ============================================================

/**
 * 从原始数据计算模型维度分析
 */
export function computeModelAnalysis(
  data: ReadonlyArray<RawQuotaData>,
  granularity: TimeGranularity = 'daily',
  rate: number = DEFAULT_QUOTA_TO_USD_RATE
): ModelAnalysisData {
  // Aggregate by model
  const modelMap = new Map<string, {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    quota: number;
    totalUseTime: number;
    maxUseTime: number;
    errorCount: number;
    totalCount: number;
    channelIds: Set<number>;
    groups: Set<string>;
    category: string | undefined;
  }>();

  for (const r of data) {
    const existing = modelMap.get(r.model_name);
    if (existing) {
      existing.requests += r.count;
      existing.inputTokens += r.prompt_tokens;
      existing.outputTokens += r.completion_tokens;
      existing.quota += r.quota;
      existing.totalUseTime += r.total_use_time;
      existing.maxUseTime = Math.max(existing.maxUseTime, r.max_use_time);
      existing.errorCount += r.error_count;
      existing.totalCount += r.count;
      existing.channelIds.add(r.channel_id);
      existing.groups.add(r.group);
      if (r.model_category) existing.category = r.model_category;
    } else {
      modelMap.set(r.model_name, {
        requests: r.count,
        inputTokens: r.prompt_tokens,
        outputTokens: r.completion_tokens,
        quota: r.quota,
        totalUseTime: r.total_use_time,
        maxUseTime: r.max_use_time,
        errorCount: r.error_count,
        totalCount: r.count,
        channelIds: new Set([r.channel_id]),
        groups: new Set([r.group]),
        category: r.model_category,
      });
    }
  }

  // Calculate total cost for share computation
  let totalCost = 0;
  const modelEntries = Array.from(modelMap.entries());
  for (const [, v] of modelEntries) {
    totalCost += quotaToUsd(v.quota, rate);
  }

  const models: ModelStats[] = modelEntries.map(([modelName, v]) => {
    const cost = quotaToUsd(v.quota, rate);
    const avgLatency = v.totalCount > 0 ? v.totalUseTime / v.totalCount : 0;
    const successRate = v.requests > 0 ? ((v.requests - v.errorCount) / v.requests) * 100 : 100;
    const totalTokens = v.inputTokens + v.outputTokens;

    return {
      modelId: modelName,
      modelName,
      provider: inferProvider(modelName),
      requests: v.requests,
      tokens: {
        input: v.inputTokens,
        output: v.outputTokens,
        total: totalTokens,
      },
      cost: Math.round(cost * 100) / 100,
      costShare: totalCost > 0 ? Math.round((cost / totalCost) * 10000) / 100 : 0,
      avgLatency: Math.round(avgLatency),
      p99Latency: v.maxUseTime, // Approximate P99 with max
      successRate: Math.round(successRate * 100) / 100,
      avgTokensPerRequest: v.requests > 0 ? Math.round(totalTokens / v.requests) : 0,
      category: v.category || inferModelCategory(modelName),
      channelIds: Array.from(v.channelIds),
      groups: Array.from(v.groups),
    };
  }).sort((a, b) => b.cost - a.cost);

  // Build per-model time series trends
  const buckets = aggregateByTime(data, granularity);
  const modelNames = models.map((m) => m.modelName);

  const trends: LabeledTimeSeries[] = modelNames.map((modelName) => ({
    label: modelName,
    data: buckets.map(({ dateKey, records }) => {
      let modelCost = 0;
      for (const r of records) {
        if (r.model_name === modelName) {
          modelCost += quotaToUsd(r.quota, rate);
        }
      }
      return {
        timestamp: dateKey,
        value: Math.round(modelCost * 100) / 100,
      };
    }),
  }));

  return { models, trends };
}

// ============================================================
// computeTopConsumers
// ============================================================

/**
 * 从原始数据计算 Top 消耗排行
 *
 * @param data      — 原始数据
 * @param type      — 消耗者维度
 * @param sortBy    — 排序维度
 * @param sortOrder — 排序方向
 * @param limit     — 返回数量
 * @param rate      — quota→USD 换算率
 */
export function computeTopConsumers(
  data: ReadonlyArray<RawQuotaData>,
  type: ConsumerType = 'user',
  sortBy: SortDimension = 'cost',
  sortOrder: SortOrder = 'desc',
  limit = 10,
  rate: number = DEFAULT_QUOTA_TO_USD_RATE
): TopConsumersData {
  // Aggregate by dimension
  const map = new Map<string, { name: string; requests: number; tokens: number; quota: number }>();

  for (const r of data) {
    let key: string;
    let name: string;

    switch (type) {
      case 'user':
        key = r.username || String(r.user_id);
        name = r.username || `User #${r.user_id}`;
        break;
      case 'channel':
        key = String(r.channel_id);
        name = `Channel #${r.channel_id}`;
        break;
      case 'group':
        key = r.group;
        name = r.group || 'default';
        break;
      case 'apiKey':
      case 'project':
      default:
        // API key / project not available in backend data; fall back to user
        key = r.username || String(r.user_id);
        name = r.username || `User #${r.user_id}`;
        break;
    }

    const existing = map.get(key);
    if (existing) {
      existing.requests += r.count;
      existing.tokens += r.token_used;
      existing.quota += r.quota;
    } else {
      map.set(key, {
        name,
        requests: r.count,
        tokens: r.token_used,
        quota: r.quota,
      });
    }
  }

  let totalCost = 0;
  const consumers: ConsumerStats[] = Array.from(map.entries()).map(([id, v]) => {
    const cost = Math.round(quotaToUsd(v.quota, rate) * 100) / 100;
    totalCost += cost;
    return {
      id,
      name: v.name,
      type,
      requests: v.requests,
      tokens: v.tokens,
      cost,
      share: 0,
    };
  });

  // Calculate share
  for (const c of consumers) {
    c.share = totalCost > 0 ? Math.round((c.cost / totalCost) * 10000) / 100 : 0;
  }

  // Sort
  consumers.sort((a, b) => {
    const aVal = sortBy === 'latency' ? a.cost : (a[sortBy] as number);
    const bVal = sortBy === 'latency' ? b.cost : (b[sortBy] as number);
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  return {
    consumers: consumers.slice(0, limit),
    sortBy,
    sortOrder,
    consumerType: type,
  };
}

// ============================================================
// Filter by model category
// ============================================================

/**
 * 按模型类别筛选原始数据
 */
export function filterByModelCategory(
  data: ReadonlyArray<RawQuotaData>,
  category: string
): RawQuotaData[] {
  if (category === 'all') return [...data];
  return data.filter((r) => {
    const cat = r.model_category || inferModelCategory(r.model_name);
    return cat === category;
  });
}

/**
 * 按渠道 ID 筛选原始数据
 */
export function filterByChannel(
  data: ReadonlyArray<RawQuotaData>,
  channelId: number
): RawQuotaData[] {
  return data.filter((r) => r.channel_id === channelId);
}

/**
 * 按分组筛选原始数据
 */
export function filterByGroup(
  data: ReadonlyArray<RawQuotaData>,
  group: string
): RawQuotaData[] {
  return data.filter((r) => r.group === group);
}
