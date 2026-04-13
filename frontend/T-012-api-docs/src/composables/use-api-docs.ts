/**
 * useApiDocs - 文档站主 Hook
 *
 * 管理 API 模式切换、端点选择、搜索、分组导航
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import type { ApiMode, ApiEndpoint, ApiGroup, SearchResult, ApiDocsConfig } from '../types/api-docs';
import { PASSTHROUGH_ENDPOINTS, PASSTHROUGH_GROUPS } from '../data/passthrough-endpoints';
import { PLATFORM_ENDPOINTS, PLATFORM_GROUPS } from '../data/platform-endpoints';
import { searchEndpoints } from '../utils/search';

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: ApiDocsConfig = {
  title: 'Lite999 API Reference',
  baseUrl: 'https://api.lite999.com',
  defaultMode: 'passthrough',
  playgroundEnabled: true,
  codeLanguages: ['curl', 'python', 'javascript', 'go'],
  defaultAuthValue: 'sk-lite-your-key-here',
  showRateLimit: true,
  showDeprecated: false,
};

// ============================================================
// Hook
// ============================================================

export interface UseApiDocsReturn {
  /** 文档配置 */
  config: ApiDocsConfig;
  /** 当前 API 模式 */
  mode: Ref<ApiMode>;
  /** 切换模式 */
  setMode: (m: ApiMode) => void;
  /** 当前模式的分组列表 */
  groups: ComputedRef<ApiGroup[]>;
  /** 当前模式的端点列表 */
  endpoints: ComputedRef<ApiEndpoint[]>;
  /** 当前选中的端点 */
  selectedEndpoint: Ref<ApiEndpoint | null>;
  /** 选择端点 */
  selectEndpoint: (id: string) => void;
  /** 按分组获取端点 */
  getEndpointsByGroup: (groupId: string) => ApiEndpoint[];
  /** 搜索查询 */
  searchQuery: Ref<string>;
  /** 搜索结果 */
  searchResults: ComputedRef<SearchResult[]>;
  /** 是否正在搜索 */
  isSearching: ComputedRef<boolean>;
  /** 所有端点（跨模式） */
  allEndpoints: ApiEndpoint[];
  /** 所有分组（跨模式） */
  allGroups: ApiGroup[];
}

export function useApiDocs(
  configOverrides?: Partial<ApiDocsConfig>
): UseApiDocsReturn {
  const config: ApiDocsConfig = { ...DEFAULT_CONFIG, ...configOverrides };

  // ---- 所有数据 ----
  const allEndpoints = [...PASSTHROUGH_ENDPOINTS, ...PLATFORM_ENDPOINTS];
  const allGroups = [...PASSTHROUGH_GROUPS, ...PLATFORM_GROUPS];

  // ---- 模式 ----
  const mode = ref<ApiMode>(config.defaultMode);

  function setMode(m: ApiMode) {
    mode.value = m;
    selectedEndpoint.value = null;
    searchQuery.value = '';
  }

  // ---- 过滤 ----
  const groups = computed(() =>
    allGroups
      .filter((g) => g.mode === mode.value)
      .sort((a, b) => a.order - b.order)
  );

  const endpoints = computed(() =>
    allEndpoints.filter((e) => {
      if (e.mode !== mode.value) return false;
      if (!config.showDeprecated && e.tags?.includes('deprecated')) return false;
      return true;
    })
  );

  // ---- 端点选择 ----
  const selectedEndpoint = ref<ApiEndpoint | null>(null);

  function selectEndpoint(id: string) {
    const found = allEndpoints.find((e) => e.id === id);
    if (found) {
      selectedEndpoint.value = found;
      if (found.mode !== mode.value) {
        mode.value = found.mode;
      }
    }
  }

  function getEndpointsByGroup(groupId: string): ApiEndpoint[] {
    return endpoints.value.filter((e) => e.groupId === groupId);
  }

  // ---- 搜索 ----
  const searchQuery = ref('');

  const searchResults = computed(() => {
    if (!searchQuery.value.trim()) return [];
    return searchEndpoints(
      config.showDeprecated ? allEndpoints : allEndpoints.filter((e) => !e.tags?.includes('deprecated')),
      searchQuery.value
    );
  });

  const isSearching = computed(() => searchQuery.value.trim().length > 0);

  // ---- 默认选中第一个 ----
  watch(
    endpoints,
    (eps) => {
      if (!selectedEndpoint.value && eps.length > 0) {
        selectedEndpoint.value = eps[0];
      }
    },
    { immediate: true }
  );

  return {
    config,
    mode,
    setMode,
    groups,
    endpoints,
    selectedEndpoint,
    selectEndpoint,
    getEndpointsByGroup,
    searchQuery,
    searchResults,
    isSearching,
    allEndpoints,
    allGroups,
  };
}
