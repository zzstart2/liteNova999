<script setup lang="ts">
/**
 * CostTrendChart - 费用趋势图
 *
 * 多模型堆叠区域图，展示费用走势、日均、预估月费
 * T-006 扩展: 上游成本叠加线 (双 Y 轴: revenue vs cost)
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import type { CostTrendData } from '../../types/usage';
import { useCostTrendOptions } from '../../hooks/use-chart-options';
import { formatCost } from '../../utils/formatters';
import ChartContainer from '../layout/ChartContainer.vue';

const props = defineProps<{
  data: CostTrendData | null;
  loading?: boolean;
  themeMode?: 'light' | 'dark';
  stacked?: boolean;
  /** 是否显示上游成本叠加线 (T-006 扩展) */
  showUpstreamCost?: boolean;
}>();

const emit = defineEmits<{ (e: 'retry'): void }>();

const chartRef = ref<HTMLDivElement | null>(null);
let chartInstance: echarts.ECharts | null = null;

const dataRef = computed(() => props.data);
const themeRef = computed(() => props.themeMode || 'light');
const showUpstream = computed(() => {
  // Auto-detect: show if data has upstream cost values
  if (props.showUpstreamCost !== undefined) return props.showUpstreamCost;
  return props.data?.series.some((d) => d.upstreamCost !== undefined) ?? false;
});
const chartOptions = useCostTrendOptions(dataRef, themeRef, props.stacked !== false, showUpstream);

const subtitle = computed(() => {
  if (!props.data) return '';
  let text = `Total: ${formatCost(props.data.total)} · Daily avg: ${formatCost(props.data.dailyAvg)}`;
  if (props.data.projectedMonthly) {
    text += ` · Projected: ${formatCost(props.data.projectedMonthly)}/mo`;
  }
  if (props.data.totalUpstreamCost !== undefined) {
    text += ` · Upstream: ${formatCost(props.data.totalUpstreamCost)}`;
  }
  return text;
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
    title="Cost Trend"
    :subtitle="subtitle"
    :loading="loading"
    :empty="!data || data.series.length === 0"
    height="380px"
    @retry="emit('retry')"
  >
    <div ref="chartRef" style="width: 100%; height: 100%" />
  </ChartContainer>
</template>
