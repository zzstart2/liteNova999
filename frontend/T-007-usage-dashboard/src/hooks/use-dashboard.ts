/**
 * useDashboard - 仪表盘主 Hook
 *
 * 编排数据获取、状态管理、自动刷新、时间范围筛选
 * 支持 T-006 扩展: modelCategory 筛选、channel/group 消耗者维度
 */

import { ref, computed, watch, onMounted, onUnmounted, type Ref } from 'vue';
import type {
  DashboardData,
  DashboardQuery,
  DashboardSummary,
  CostTrendData,
  TokenTrendData,
  ModelAnalysisData,
  TopConsumersData,
  DateRange,
  PresetRange,
  TimeGranularity,
  ConsumerType,
  SortDimension,
  SortOrder,
  DashboardConfig,
  ModelCategory,
} from '../types/usage';
import { getUsageApi } from '../api/usage-api';

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: DashboardConfig = {
  autoRefreshInterval: 60,
  defaultRange: '30d',
  defaultGranularity: 'daily',
  topN: 10,
  currency: '$',
  costPrecision: 2,
  showProjectedCost: true,
  sparklinePoints: 14,
  quotaToUsdRate: 1 / 500000,
};

// ============================================================
// 时间范围工具
// ============================================================

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
// Hook 返回类型
// ============================================================

export interface UseDashboardReturn {
  // 状态
  loading: Ref<boolean>;
  error: Ref<Error | null>;
  lastRefreshed: Ref<string | null>;

  // 数据
  summary: Ref<DashboardSummary | null>;
  costTrend: Ref<CostTrendData | null>;
  tokenTrend: Ref<TokenTrendData | null>;
  modelAnalysis: Ref<ModelAnalysisData | null>;
  topConsumers: Ref<TopConsumersData | null>;

  // 筛选
  selectedRange: Ref<PresetRange>;
  customDateRange: Ref<DateRange | null>;
  effectiveDateRange: Ref<DateRange>;
  granularity: Ref<TimeGranularity>;
  selectedModels: Ref<string[]>;
  modelCategory: Ref<ModelCategory>;

  // Top 消耗排行控制
  consumerType: Ref<ConsumerType>;
  sortBy: Ref<SortDimension>;
  sortOrder: Ref<SortOrder>;

  // 操作
  refresh: () => Promise<void>;
  setRange: (preset: PresetRange) => void;
  setCustomRange: (range: DateRange) => void;
  setConsumerType: (type: ConsumerType) => void;
  setSortBy: (dimension: SortDimension) => void;
  setModelCategory: (category: ModelCategory) => void;

  // 配置
  config: DashboardConfig;
}

// ============================================================
// Hook 实现
// ============================================================

export function useDashboard(
  configOverrides?: Partial<DashboardConfig>
): UseDashboardReturn {
  const config: DashboardConfig = { ...DEFAULT_CONFIG, ...configOverrides };

  // ---- 状态 ----
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const lastRefreshed = ref<string | null>(null);

  // ---- 数据 ----
  const summary = ref<DashboardSummary | null>(null);
  const costTrend = ref<CostTrendData | null>(null);
  const tokenTrend = ref<TokenTrendData | null>(null);
  const modelAnalysis = ref<ModelAnalysisData | null>(null);
  const topConsumers = ref<TopConsumersData | null>(null);

  // ---- 筛选 ----
  const selectedRange = ref<PresetRange>(config.defaultRange);
  const customDateRange = ref<DateRange | null>(null);
  const selectedModels = ref<string[]>([]);
  const granularity = ref<TimeGranularity>(config.defaultGranularity);
  const modelCategory = ref<ModelCategory>('all');

  // Top 消耗
  const consumerType = ref<ConsumerType>('user');
  const sortBy = ref<SortDimension>('cost');
  const sortOrder = ref<SortOrder>('desc');

  // ---- 派生 ----
  const effectiveDateRange = computed<DateRange>(() => {
    if (selectedRange.value === 'custom' && customDateRange.value) {
      return customDateRange.value;
    }
    return presetToDateRange(selectedRange.value);
  });

  // ---- 获取数据 ----
  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  async function refresh() {
    loading.value = true;
    error.value = null;

    const query: DashboardQuery = {
      dateRange: effectiveDateRange.value,
      granularity: granularity.value,
      modelIds: selectedModels.value.length > 0 ? selectedModels.value : undefined,
      modelCategory: modelCategory.value,
    };

    try {
      const api = getUsageApi();

      // 并行获取所有数据
      const [
        summaryData,
        costData,
        tokenData,
        modelData,
        consumersData,
      ] = await Promise.all([
        api.getSummary(query),
        api.getCostTrend(query),
        api.getTokenTrend(query),
        api.getModelAnalysis(query),
        api.getTopConsumers(
          query,
          consumerType.value,
          sortBy.value,
          sortOrder.value,
          config.topN
        ),
      ]);

      summary.value = summaryData;
      costTrend.value = costData;
      tokenTrend.value = tokenData;
      modelAnalysis.value = modelData;
      topConsumers.value = consumersData;
      lastRefreshed.value = new Date().toISOString();
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
      console.error('[useDashboard] Fetch error:', err);
    } finally {
      loading.value = false;
    }
  }

  /** 仅刷新 Top 消耗（切换筛选时） */
  async function refreshTopConsumers() {
    try {
      const api = getUsageApi();
      const query: DashboardQuery = {
        dateRange: effectiveDateRange.value,
        granularity: granularity.value,
        modelCategory: modelCategory.value,
      };
      topConsumers.value = await api.getTopConsumers(
        query,
        consumerType.value,
        sortBy.value,
        sortOrder.value,
        config.topN
      );
    } catch (err) {
      console.error('[useDashboard] TopConsumers refresh error:', err);
    }
  }

  // ---- 操作 ----
  function setRange(preset: PresetRange) {
    selectedRange.value = preset;
    if (preset !== 'custom') {
      customDateRange.value = null;
      granularity.value = autoGranularity(presetToDateRange(preset));
    }
  }

  function setCustomRange(range: DateRange) {
    selectedRange.value = 'custom';
    customDateRange.value = range;
    granularity.value = autoGranularity(range);
  }

  function setConsumerType(type: ConsumerType) {
    consumerType.value = type;
    refreshTopConsumers();
  }

  function setSortBy(dimension: SortDimension) {
    sortBy.value = dimension;
    refreshTopConsumers();
  }

  function setModelCategory(category: ModelCategory) {
    modelCategory.value = category;
    // Trigger full refresh since category affects all charts
    refresh();
  }

  // ---- 自动刷新 ----
  function startAutoRefresh() {
    stopAutoRefresh();
    if (config.autoRefreshInterval > 0) {
      refreshTimer = setInterval(refresh, config.autoRefreshInterval * 1000);
    }
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  // ---- 监听筛选变化 ----
  watch(effectiveDateRange, () => {
    refresh();
  });

  // ---- 生命周期 ----
  onMounted(() => {
    refresh();
    startAutoRefresh();
  });

  onUnmounted(() => {
    stopAutoRefresh();
  });

  return {
    loading,
    error,
    lastRefreshed,
    summary,
    costTrend,
    tokenTrend,
    modelAnalysis,
    topConsumers,
    selectedRange,
    customDateRange,
    effectiveDateRange,
    granularity,
    selectedModels,
    modelCategory,
    consumerType,
    sortBy,
    sortOrder,
    refresh,
    setRange,
    setCustomRange,
    setConsumerType,
    setSortBy,
    setModelCategory,
    config,
  };
}
