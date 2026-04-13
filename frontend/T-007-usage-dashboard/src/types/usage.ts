/**
 * PRJ-LITE999-T-007 用量仪表盘 — 类型定义
 *
 * 覆盖用量统计、费用分析、模型维度、时间序列等全部数据结构
 * 包含与 T-006 后端 QuotaData 的映射层
 */

// ============================================================
// 基础枚举 & 常量
// ============================================================

/** 时间粒度 */
export type TimeGranularity = 'hourly' | 'daily' | 'weekly' | 'monthly';

/** 预设时间范围 */
export type PresetRange = '24h' | '7d' | '30d' | '90d' | '180d' | '1y' | 'custom';

/** 排序维度 */
export type SortDimension = 'requests' | 'tokens' | 'cost' | 'latency';

/** 排序方向 */
export type SortOrder = 'asc' | 'desc';

/** Token 方向 */
export type TokenDirection = 'input' | 'output' | 'total';

/** 模型类别 (T-006 extension) */
export type ModelCategory = 'all' | 'text' | 'image' | 'audio' | 'video' | 'embedding';

// ============================================================
// 时间范围
// ============================================================

export interface DateRange {
  /** 开始时间 (ISO 8601) */
  start: string;
  /** 结束时间 (ISO 8601) */
  end: string;
}

// ============================================================
// 后端原始数据类型 (T-006 Backend QuotaData)
// ============================================================

/**
 * RawQuotaData — 精确匹配后端 model/usedata.go 的 QuotaData JSON 结构
 *
 * 每条记录代表某用户、某模型在某小时桶(created_at)内的聚合用量数据。
 */
export interface RawQuotaData {
  /** 记录 ID */
  id: number;
  /** 用户 ID */
  user_id: number;
  /** 用户名 */
  username: string;
  /** 模型名称 (如 gpt-4, claude-sonnet-4) */
  model_name: string;
  /** 创建时间 — Unix 时间戳（秒），按小时对齐 */
  created_at: number;
  /** 已使用 Token 总数 (prompt + completion) */
  token_used: number;
  /** 请求计数 */
  count: number;
  /** 内部配额消耗（计费单位，非 USD） */
  quota: number;
  /** Prompt Token 数 */
  prompt_tokens: number;
  /** Completion Token 数 */
  completion_tokens: number;
  /** 模型倍率 (用于 quota→USD 换算) */
  model_ratio: number;
  /** Completion 倍率 */
  completion_ratio: number;
  /** 渠道 ID */
  channel_id: number;
  /** 分组名称 */
  group: string;
  /** 平均响应耗时 (ms) */
  avg_use_time: number;
  /** 最大响应耗时 (ms) */
  max_use_time: number;
  /** 流式请求数 */
  stream_count: number;
  /** 错误请求数 */
  error_count: number;
  /** 总耗时 (ms) */
  total_use_time: number;

  // ---- T-006 设计扩展字段（后端可能尚未实现，均为可选） ----

  /** 上游成本 (USD) */
  upstream_cost?: number;
  /** 利润率 (%) */
  profit_margin?: number;
  /** 货币类型 */
  currency?: string;
  /** 模型类别: text/image/audio/video */
  model_category?: string;
  /** 端点类型: chat/completion/embedding */
  endpoint_type?: string;
  /** 首 Token 延迟 (ms) */
  first_response_ms?: number;
  /** P95 延迟 (ms) */
  p95_latency_ms?: number;
  /** 成功请求数 */
  success_count?: number;
  /** 错误类型详情 (JSON) */
  error_type_detail?: string;
}

/**
 * 后端 API 统一响应结构
 */
export interface BackendApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// ============================================================
// 概览统计
// ============================================================

/** 单个统计指标 */
export interface StatMetric {
  /** 当前值 */
  value: number;
  /** 上期值（用于计算变化率） */
  previousValue?: number;
  /** 变化率 (百分比, 如 12.5 表示 +12.5%) */
  changeRate?: number;
  /** 变化方向 */
  trend?: 'up' | 'down' | 'flat';
  /** 迷你趋势数据（最近 N 个点） */
  sparkline?: number[];
}

/** 仪表盘概览数据 */
export interface DashboardSummary {
  /** 总请求量 */
  totalRequests: StatMetric;
  /** 总 Token 消耗 */
  totalTokens: StatMetric;
  /** 总费用 (USD) */
  totalCost: StatMetric;
  /** 平均延迟 (ms) */
  avgLatency: StatMetric;
  /** 成功率 (%) */
  successRate: StatMetric;
  /** 活跃模型数 */
  activeModels: StatMetric;
  /** 上游成本 (USD) — T-006 扩展，仅在数据包含 upstream_cost 时有值 */
  upstreamCost?: StatMetric;
  /** 利润率 (%) — T-006 扩展 */
  profitMargin?: StatMetric;
}

// ============================================================
// 时间序列
// ============================================================

/** 通用时间序列数据点 */
export interface TimeSeriesPoint {
  /** 时间戳 (ISO 8601) */
  timestamp: string;
  /** 值 */
  value: number;
}

/** 带标签的时间序列（用于多系列图表） */
export interface LabeledTimeSeries {
  /** 系列标签（如模型名、API Key） */
  label: string;
  /** 数据点 */
  data: TimeSeriesPoint[];
  /** 系列颜色（可选） */
  color?: string;
}

// ============================================================
// 费用趋势
// ============================================================

/** 单日费用明细 */
export interface CostDataPoint {
  /** 日期 (ISO date) */
  date: string;
  /** 总费用 */
  totalCost: number;
  /** 按模型拆分 */
  byModel: Record<string, number>;
  /** Input Token 费用 */
  inputCost: number;
  /** Output Token 费用 */
  outputCost: number;
  /** 上游成本 (T-006 扩展) */
  upstreamCost?: number;
}

/** 费用趋势数据 */
export interface CostTrendData {
  /** 时间序列 */
  series: CostDataPoint[];
  /** 汇总 */
  total: number;
  /** 日均 */
  dailyAvg: number;
  /** 预估月底费用 */
  projectedMonthly?: number;
  /** 模型列表（用于图例） */
  models: string[];
  /** 上游成本总计 (T-006 扩展) */
  totalUpstreamCost?: number;
}

// ============================================================
// Token 用量
// ============================================================

/** 单日 Token 用量 */
export interface TokenDataPoint {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** 请求数 */
  requests: number;
}

/** Token 用量趋势数据 */
export interface TokenTrendData {
  series: TokenDataPoint[];
  total: {
    input: number;
    output: number;
    total: number;
  };
  dailyAvg: number;
  peakDay: {
    date: string;
    tokens: number;
  };
}

// ============================================================
// 模型维度分析
// ============================================================

/** 单模型统计 */
export interface ModelStats {
  /** 模型 ID */
  modelId: string;
  /** 模型显示名 */
  modelName: string;
  /** 提供商 */
  provider: string;
  /** 请求量 */
  requests: number;
  /** Token 消耗 */
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  /** 费用 */
  cost: number;
  /** 占比 (%) */
  costShare: number;
  /** 平均延迟 (ms) */
  avgLatency: number;
  /** P99 延迟 (ms) */
  p99Latency: number;
  /** 成功率 (%) */
  successRate: number;
  /** 平均每请求 Token */
  avgTokensPerRequest: number;
  /** 模型类别 (T-006 扩展) */
  category?: string;
  /** 渠道 ID 列表 (T-006 扩展) */
  channelIds?: number[];
  /** 分组列表 (T-006 扩展) */
  groups?: string[];
}

/** 模型分析数据 */
export interface ModelAnalysisData {
  /** 各模型统计 */
  models: ModelStats[];
  /** 模型趋势（每个模型的时间序列） */
  trends: LabeledTimeSeries[];
}

// ============================================================
// Top 消耗排行
// ============================================================

/** 消耗者类型 — 扩展 channel / group 维度 */
export type ConsumerType = 'apiKey' | 'user' | 'project' | 'channel' | 'group';

/** 单个消耗者 */
export interface ConsumerStats {
  /** ID */
  id: string;
  /** 显示名 */
  name: string;
  /** 类型 */
  type: ConsumerType;
  /** 请求量 */
  requests: number;
  /** Token 消耗 */
  tokens: number;
  /** 费用 */
  cost: number;
  /** 占总量百分比 */
  share: number;
}

/** Top 消耗排行数据 */
export interface TopConsumersData {
  /** 排行列表 */
  consumers: ConsumerStats[];
  /** 排序维度 */
  sortBy: SortDimension;
  /** 排序方向 */
  sortOrder: SortOrder;
  /** 消耗者类型 */
  consumerType: ConsumerType;
}

// ============================================================
// API 请求 / 响应
// ============================================================

/** 仪表盘查询参数 */
export interface DashboardQuery {
  /** 时间范围 */
  dateRange: DateRange;
  /** 时间粒度 */
  granularity?: TimeGranularity;
  /** 筛选模型 */
  modelIds?: string[];
  /** 筛选 API Key */
  apiKeyIds?: string[];
  /** 项目 ID */
  projectId?: string;
  /** 模型类别筛选 (T-006 扩展) */
  modelCategory?: ModelCategory;
  /** 渠道 ID 筛选 (T-006 扩展) */
  channelId?: number;
  /** 分组筛选 (T-006 扩展) */
  group?: string;
}

/** 完整仪表盘数据 */
export interface DashboardData {
  summary: DashboardSummary;
  costTrend: CostTrendData;
  tokenTrend: TokenTrendData;
  modelAnalysis: ModelAnalysisData;
  topConsumers: TopConsumersData;
  /** 数据时间范围 */
  dateRange: DateRange;
  /** 数据刷新时间 */
  refreshedAt: string;
}

/** API 通用响应包装 (前端内部) */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
}

// ============================================================
// 仪表盘配置
// ============================================================

export interface DashboardConfig {
  /** 自动刷新间隔 (秒, 0 = 关闭) */
  autoRefreshInterval: number;
  /** 默认时间范围 */
  defaultRange: PresetRange;
  /** 默认粒度 */
  defaultGranularity: TimeGranularity;
  /** Top N 排行显示数量 */
  topN: number;
  /** 费用货币单位 */
  currency: string;
  /** 小数精度 */
  costPrecision: number;
  /** 是否显示预估月费 */
  showProjectedCost: boolean;
  /** 迷你图数据点数 */
  sparklinePoints: number;
  /**
   * Quota → USD 换算率
   * 后端 quota 是内部计费单位；quotaToUsdRate = 1 / (500000) 即 500000 quota = 1 USD。
   * 可根据实际项目配置调整。
   */
  quotaToUsdRate: number;
}
