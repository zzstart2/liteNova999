<script setup lang="ts">
/**
 * TokenUsageChart - Token 用量趋势图
 *
 * Input / Output Token 堆叠柱状图
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import type { TokenTrendData } from '../../types/usage';
import { useTokenTrendOptions } from '../../hooks/use-chart-options';
import { formatTokens, formatDate } from '../../utils/formatters';
import ChartContainer from '../layout/ChartContainer.vue';

const props = defineProps<{
  data: TokenTrendData | null;
  loading?: boolean;
  themeMode?: 'light' | 'dark';
}>();

const emit = defineEmits<{ (e: 'retry'): void }>();

const chartRef = ref<HTMLDivElement | null>(null);
let chartInstance: echarts.ECharts | null = null;

const dataRef = computed(() => props.data);
const themeRef = computed(() => props.themeMode || 'light');
const chartOptions = useTokenTrendOptions(dataRef, themeRef);

const subtitle = computed(() => {
  if (!props.data) return '';
  const { total, peakDay } = props.data;
  return `Total: ${formatTokens(total.total)} · Peak: ${formatTokens(peakDay.tokens)} (${formatDate(peakDay.date)})`;
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
    title="Token Usage"
    :subtitle="subtitle"
    :loading="loading"
    :empty="!data || data.series.length === 0"
    height="380px"
    @retry="emit('retry')"
  >
    <div ref="chartRef" style="width: 100%; height: 100%" />
  </ChartContainer>
</template>
