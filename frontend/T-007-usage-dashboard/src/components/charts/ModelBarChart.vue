<script setup lang="ts">
/**
 * ModelBarChart - 模型费用柱状图
 *
 * 水平柱状图展示各模型费用对比
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import type { ModelAnalysisData } from '../../types/usage';
import { useModelBarOptions } from '../../hooks/use-chart-options';
import ChartContainer from '../layout/ChartContainer.vue';

const props = defineProps<{
  data: ModelAnalysisData | null;
  loading?: boolean;
  themeMode?: 'light' | 'dark';
}>();

const emit = defineEmits<{ (e: 'retry'): void }>();

const chartRef = ref<HTMLDivElement | null>(null);
let chartInstance: echarts.ECharts | null = null;

const dataRef = computed(() => props.data);
const themeRef = computed(() => props.themeMode || 'light');
const chartOptions = useModelBarOptions(dataRef, themeRef);

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
    title="Cost by Model"
    :loading="loading"
    :empty="!data || data.models.length === 0"
    height="320px"
    @retry="emit('retry')"
  >
    <div ref="chartRef" style="width: 100%; height: 100%" />
  </ChartContainer>
</template>
