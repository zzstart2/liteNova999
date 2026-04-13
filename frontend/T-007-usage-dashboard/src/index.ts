/**
 * 用量仪表盘组件库 — 统一导出
 *
 * @module @lite999/usage-dashboard
 */

// Types
export type {
  TimeGranularity,
  PresetRange,
  SortDimension,
  SortOrder,
  TokenDirection,
  ModelCategory,
  DateRange,
  StatMetric,
  DashboardSummary,
  TimeSeriesPoint,
  LabeledTimeSeries,
  CostDataPoint,
  CostTrendData,
  TokenDataPoint,
  TokenTrendData,
  ModelStats,
  ModelAnalysisData,
  ConsumerType,
  ConsumerStats,
  TopConsumersData,
  DashboardQuery,
  DashboardData,
  DashboardConfig,
  ApiResponse,
  // New: Backend types
  RawQuotaData,
  BackendApiResponse,
} from './types/usage';

// API
export type { IUsageApi } from './api/usage-api';
export { setUsageApi, getUsageApi, createUsageApi } from './api/usage-api';
export { createMockUsageApi, generateMockRawData } from './api/usage-api.mock';
export { createRealUsageApi } from './api/usage-api.real';

// Transform layer
export {
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
} from './transforms/quota-transform';

// Hooks
export { useDashboard } from './hooks/use-dashboard';
export type { UseDashboardReturn } from './hooks/use-dashboard';
export {
  useCostTrendOptions,
  useTokenTrendOptions,
  useModelPieOptions,
  useModelBarOptions,
  useTopConsumersOptions,
} from './hooks/use-chart-options';

// Store
export { useUsageStore } from './stores/usage-store';

// Utils
export {
  compactNumber,
  formatCost,
  formatChangeRate,
  formatTokens,
  formatTokensWithUnit,
  formatLatency,
  formatPercent,
  formatRequests,
  formatDate,
  formatRelativeTime,
  calcChangeRate,
  getTrend,
} from './utils/formatters';

export {
  CHART_COLOR_PALETTE,
  COST_COLOR_PALETTE,
  TOKEN_COLORS,
  TREND_COLORS,
  getChartTheme,
  createBaseOptions,
} from './utils/chart-theme';

// Components — import individually for tree-shaking:
// import DashboardPage from '@lite999/usage-dashboard/components/layout/DashboardPage.vue'
// import CostTrendChart from '@lite999/usage-dashboard/components/charts/CostTrendChart.vue'
// import TokenUsageChart from '@lite999/usage-dashboard/components/charts/TokenUsageChart.vue'
// import ModelPieChart from '@lite999/usage-dashboard/components/charts/ModelPieChart.vue'
// import ModelBarChart from '@lite999/usage-dashboard/components/charts/ModelBarChart.vue'
// import TopConsumersChart from '@lite999/usage-dashboard/components/charts/TopConsumersChart.vue'
// import SummaryCards from '@lite999/usage-dashboard/components/cards/SummaryCards.vue'
// import StatCard from '@lite999/usage-dashboard/components/cards/StatCard.vue'
// import ChartContainer from '@lite999/usage-dashboard/components/layout/ChartContainer.vue'
// import DateRangePicker from '@lite999/usage-dashboard/components/layout/DateRangePicker.vue'
