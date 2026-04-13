<script setup lang="ts">
/**
 * ModelPieChart - 模型占比饼图
 *
 * 环形图展示各模型费用/请求/Token 占比
 * T-006 扩展: model_category 维度筛选
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import type { ModelAnalysisData, ModelCategory } from '../../types/usage';
import { useModelPieOptions } from '../../hooks/use-chart-options';
import ChartContainer from '../layout/ChartContainer.vue';

const props = withDefaults(
  defineProps<{
    data: ModelAnalysisData | null;
    loading?: boolean;
    themeMode?: 'light' | 'dark';
    dimension?: 'cost' | 'requests' | 'tokens';
    /** 当前模型类别筛选 (从 DashboardPage 传入) */
    modelCategory?: ModelCategory;
  }>(),
  { dimension: 'cost', modelCategory: 'all' }
);

const emit = defineEmits<{
  (e: 'retry'): void;
  (e: 'update:dimension', val: 'cost' | 'requests' | 'tokens'): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
let chartInstance: echarts.ECharts | null = null;

/** 按 category 过滤模型数据 */
const filteredData = computed<ModelAnalysisData | null>(() => {
  if (!props.data) return null;
  if (!props.modelCategory || props.modelCategory === 'all') return props.data;

  const filtered = props.data.models.filter(
    (m) => m.category === props.modelCategory
  );
  const filteredNames = new Set(filtered.map((m) => m.modelName));
  const filteredTrends = props.data.trends.filter((t) => filteredNames.has(t.label));

  return { models: filtered, trends: filteredTrends };
});

const dataRef = computed(() => filteredData.value);
const themeRef = computed(() => props.themeMode || 'light');
const chartOptions = useModelPieOptions(dataRef, themeRef, props.dimension);

const dimensionLabel = computed(() => {
  const labels = { cost: 'Cost', requests: 'Requests', tokens: 'Tokens' };
  return labels[props.dimension] || 'Cost';
});

function initChart() {
  if (!chartRef.value) return;
  chartInstance = echarts.init(chartRef.value);
  if (chartOptions.value) {
    chartInstance.setOption(chartOptions.value);
  }
}

function resizeChart() {
  chartInstance?.resize();
}

watch(chartOptions, (options) => {
  if (options && chartInstance) {
    chartInstance.setOption(options, true);
  }
});

onMounted(() => {
  initChart();
  window.addEventListener('resize', resizeChart);
});

onUnmounted(() => {
  chartInstance?.dispose();
  window.removeEventListener('resize', resizeChart);
});
</script>

<template>
  <ChartContainer
    :title="`Model Distribution — ${dimensionLabel}`"
    :loading="loading"
    :empty="!filteredData || filteredData.models.length === 0"
    height="320px"
    @retry="emit('retry')"
  >
    <template #actions>
      <div class="dimension-tabs">
        <button
          v-for="dim in (['cost', 'requests', 'tokens'] as const)"
          :key="dim"
          :class="['dim-btn', { active: dimension === dim }]"
          @click="emit('update:dimension', dim)"
        >
          {{ dim === 'cost' ? '💰' : dim === 'requests' ? '📡' : '🔤' }}
        </button>
      </div>
    </template>

    <div ref="chartRef" style="width: 100%; height: 100%" />
  </ChartContainer>
</template>

<style scoped>
.dimension-tabs {
  display: flex;
  gap: 2px;
}

.dim-btn {
  padding: 3px 8px;
  font-size: 14px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0.5;
  transition: all 0.15s;
}

.dim-btn:hover {
  opacity: 0.8;
}

.dim-btn.active {
  opacity: 1;
  background: var(--brand-surface, #f9fafb);
  border-color: var(--brand-border, #e5e7eb);
}
</style>
