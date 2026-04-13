<script setup lang="ts">
/**
 * DashboardPage - 用量仪表盘主页面
 *
 * 编排所有组件，提供全局筛选和布局
 * T-006 扩展: 模型类别筛选标签页 (All/Text/Image/Audio/Video/Embedding)
 */

import { ref, onMounted } from 'vue';
import type { ConsumerType, SortDimension, ModelCategory } from '../../types/usage';
import { setUsageApi } from '../../api/usage-api';
import { createMockUsageApi } from '../../api/usage-api.mock';
import { useDashboard } from '../../hooks/use-dashboard';
import { formatRelativeTime } from '../../utils/formatters';

import DateRangePicker from './DateRangePicker.vue';
import SummaryCards from '../cards/SummaryCards.vue';
import CostTrendChart from '../charts/CostTrendChart.vue';
import TokenUsageChart from '../charts/TokenUsageChart.vue';
import ModelPieChart from '../charts/ModelPieChart.vue';
import ModelBarChart from '../charts/ModelBarChart.vue';
import TopConsumersChart from '../charts/TopConsumersChart.vue';

// ---- 初始化 API（开发模式使用 Mock） ----
// 正式环境替换为:
// import { createRealUsageApi } from '../../api/usage-api.real';
// setUsageApi(createRealUsageApi('https://api.example.com', { authToken, role: 'admin' }));
onMounted(() => {
  try {
    // 仅在未设置时使用 mock
    setUsageApi(createMockUsageApi(400));
  } catch {
    // 已设置，忽略
  }
});

const {
  loading,
  error,
  lastRefreshed,
  summary,
  costTrend,
  tokenTrend,
  modelAnalysis,
  topConsumers,
  selectedRange,
  modelCategory,
  setRange,
  setCustomRange,
  setConsumerType,
  setSortBy,
  setModelCategory,
  refresh,
} = useDashboard();

const pieDimension = ref<'cost' | 'requests' | 'tokens'>('cost');
const themeMode = ref<'light' | 'dark'>('light');

/** 模型类别标签页 */
const categoryTabs: { value: ModelCategory; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '🌐' },
  { value: 'text', label: 'Text', icon: '💬' },
  { value: 'image', label: 'Image', icon: '🎨' },
  { value: 'audio', label: 'Audio', icon: '🎵' },
  { value: 'video', label: 'Video', icon: '🎬' },
  { value: 'embedding', label: 'Embedding', icon: '🔗' },
];

function handleRetry() {
  refresh();
}
</script>

<template>
  <div class="dashboard-page">
    <!-- 头部：标题 + 筛选 + 操作 -->
    <header class="dashboard-header">
      <div class="header-left">
        <h1 class="dashboard-title">Usage Dashboard</h1>
        <span v-if="lastRefreshed" class="last-refresh">
          Updated {{ formatRelativeTime(lastRefreshed) }}
        </span>
      </div>

      <div class="header-right">
        <DateRangePicker
          :model-value="selectedRange"
          @update:model-value="setRange"
          @custom-range="setCustomRange"
        />

        <button class="refresh-btn" :disabled="loading" @click="refresh">
          <span :class="{ spinning: loading }">🔄</span>
          Refresh
        </button>
      </div>
    </header>

    <!-- 模型类别筛选标签页 (T-006 扩展) -->
    <nav class="category-tabs">
      <button
        v-for="tab in categoryTabs"
        :key="tab.value"
        :class="['cat-tab', { active: modelCategory === tab.value }]"
        @click="setModelCategory(tab.value)"
      >
        <span class="cat-icon">{{ tab.icon }}</span>
        <span class="cat-label">{{ tab.label }}</span>
      </button>
    </nav>

    <!-- 错误提示 -->
    <div v-if="error" class="error-banner">
      ⚠️ {{ error.message }}
      <button @click="refresh">Retry</button>
    </div>

    <!-- 概览卡片 -->
    <section class="section">
      <SummaryCards :data="summary" :loading="loading && !summary" />
    </section>

    <!-- 趋势图 -->
    <section class="section charts-row">
      <CostTrendChart
        :data="costTrend"
        :loading="loading && !costTrend"
        :theme-mode="themeMode"
        @retry="handleRetry"
      />
      <TokenUsageChart
        :data="tokenTrend"
        :loading="loading && !tokenTrend"
        :theme-mode="themeMode"
        @retry="handleRetry"
      />
    </section>

    <!-- 模型分析 -->
    <section class="section charts-row">
      <ModelPieChart
        :data="modelAnalysis"
        :loading="loading && !modelAnalysis"
        :theme-mode="themeMode"
        :dimension="pieDimension"
        :model-category="modelCategory"
        @update:dimension="pieDimension = $event"
        @retry="handleRetry"
      />
      <ModelBarChart
        :data="modelAnalysis"
        :loading="loading && !modelAnalysis"
        :theme-mode="themeMode"
        @retry="handleRetry"
      />
    </section>

    <!-- Top 消耗排行 -->
    <section class="section">
      <TopConsumersChart
        :data="topConsumers"
        :loading="loading && !topConsumers"
        :theme-mode="themeMode"
        @change-type="setConsumerType"
        @change-sort="setSortBy"
        @retry="handleRetry"
      />
    </section>
  </div>
</template>

<style scoped>
.dashboard-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dashboard-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dashboard-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--brand-text-primary, #111827);
}

.last-refresh {
  font-size: 12px;
  color: var(--brand-text-secondary, #6b7280);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--brand-text-primary, #111827);
  background: var(--brand-bg, #ffffff);
  border: 1px solid var(--brand-border, #e5e7eb);
  border-radius: var(--brand-radius, 8px);
  cursor: pointer;
  transition: all 0.15s;
}

.refresh-btn:hover {
  border-color: var(--brand-primary, #3b82f6);
  color: var(--brand-primary, #3b82f6);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  display: inline-block;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Category Tabs */
.category-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.cat-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--brand-text-secondary, #6b7280);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--brand-radius, 8px);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.cat-tab:hover {
  color: var(--brand-text-primary, #111827);
  background: var(--brand-surface, #f9fafb);
}

.cat-tab.active {
  color: var(--brand-primary, #3b82f6);
  background: var(--brand-primary-bg, #eff6ff);
  border-color: var(--brand-primary, #3b82f6);
}

.cat-icon {
  font-size: 15px;
}

.cat-label {
  font-size: 12px;
}

.error-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  padding: 10px 16px;
  border-radius: var(--brand-radius, 8px);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.error-banner button {
  padding: 3px 12px;
  font-size: 12px;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  background: white;
  color: #991b1b;
  cursor: pointer;
}

.section {
  display: flex;
  flex-direction: column;
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 16px;
}

@media (max-width: 860px) {
  .charts-row {
    grid-template-columns: 1fr;
  }

  .dashboard-header {
    flex-direction: column;
  }
}
</style>
