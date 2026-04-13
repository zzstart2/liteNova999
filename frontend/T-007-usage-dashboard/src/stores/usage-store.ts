/**
 * Pinia 用量数据 Store
 *
 * 可选的全局状态管理层，适用于多组件共享数据场景
 * 如果只在单一仪表盘页面使用，useDashboard() 已足够
 *
 * 新增：rawData 缓存，支持 modelCategory / channel / group 筛选
 */

import { ref, computed } from 'vue';
// NOTE: 如果项目使用 Pinia，请取消注释以下导入
// import { defineStore } from 'pinia';

import type {
  DashboardSummary,
  CostTrendData,
  TokenTrendData,
  ModelAnalysisData,
  TopConsumersData,
  DateRange,
  TimeGranularity,
  DashboardQuery,
  RawQuotaData,
  ModelCategory,
} from '../types/usage';
import { getUsageApi } from '../api/usage-api';

/**
 * 用量数据 Store（Composition API 风格）
 *
 * 如果使用 Pinia：
 * export const useUsageStore = defineStore('usage', () => { ... })
 *
 * 不使用 Pinia 时，导出为普通组合函数（单例模式）
 */

// 单例状态
const _summary = ref<DashboardSummary | null>(null);
const _costTrend = ref<CostTrendData | null>(null);
const _tokenTrend = ref<TokenTrendData | null>(null);
const _modelAnalysis = ref<ModelAnalysisData | null>(null);
const _topConsumers = ref<TopConsumersData | null>(null);
const _loading = ref(false);
const _error = ref<Error | null>(null);
const _lastRefreshed = ref<string | null>(null);
const _dateRange = ref<DateRange>({
  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  end: new Date().toISOString(),
});
const _granularity = ref<TimeGranularity>('daily');
const _modelCategory = ref<ModelCategory>('all');

/** 原始数据缓存 — 供二次计算使用（如切换 category 无需重新请求） */
const _rawDataCache = ref<RawQuotaData[]>([]);

export function useUsageStore() {
  const isStale = computed(() => {
    if (!_lastRefreshed.value) return true;
    const diff = Date.now() - new Date(_lastRefreshed.value).getTime();
    return diff > 5 * 60 * 1000; // 5 分钟过期
  });

  async function fetchAll(forceRefresh = false) {
    if (!forceRefresh && !isStale.value && _summary.value) {
      return; // 使用缓存
    }

    _loading.value = true;
    _error.value = null;

    const query: DashboardQuery = {
      dateRange: _dateRange.value,
      granularity: _granularity.value,
      modelCategory: _modelCategory.value,
    };

    try {
      const api = getUsageApi();
      const [summary, cost, token, model, consumers] = await Promise.all([
        api.getSummary(query),
        api.getCostTrend(query),
        api.getTokenTrend(query),
        api.getModelAnalysis(query),
        api.getTopConsumers(query, 'user', 'cost', 'desc', 10),
      ]);

      _summary.value = summary;
      _costTrend.value = cost;
      _tokenTrend.value = token;
      _modelAnalysis.value = model;
      _topConsumers.value = consumers;
      _lastRefreshed.value = new Date().toISOString();
    } catch (err) {
      _error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      _loading.value = false;
    }
  }

  function setDateRange(range: DateRange) {
    _dateRange.value = range;
  }

  function setGranularity(g: TimeGranularity) {
    _granularity.value = g;
  }

  function setModelCategory(cat: ModelCategory) {
    _modelCategory.value = cat;
  }

  /** 设置原始数据缓存（由 RealUsageApi 调用或测试用） */
  function setRawDataCache(data: RawQuotaData[]) {
    _rawDataCache.value = data;
  }

  function reset() {
    _summary.value = null;
    _costTrend.value = null;
    _tokenTrend.value = null;
    _modelAnalysis.value = null;
    _topConsumers.value = null;
    _lastRefreshed.value = null;
    _error.value = null;
    _rawDataCache.value = [];
  }

  return {
    // 数据
    summary: _summary,
    costTrend: _costTrend,
    tokenTrend: _tokenTrend,
    modelAnalysis: _modelAnalysis,
    topConsumers: _topConsumers,

    // 原始数据缓存
    rawDataCache: _rawDataCache,

    // 状态
    loading: _loading,
    error: _error,
    lastRefreshed: _lastRefreshed,
    isStale,

    // 筛选
    dateRange: _dateRange,
    granularity: _granularity,
    modelCategory: _modelCategory,

    // 操作
    fetchAll,
    setDateRange,
    setGranularity,
    setModelCategory,
    setRawDataCache,
    reset,
  };
}
