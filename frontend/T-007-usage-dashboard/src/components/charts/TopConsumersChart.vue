<script setup lang="ts">
/**
 * TopConsumersChart - Top 消耗排行组件
 *
 * 水平柱状图 + 表格联动，支持按维度排序
 * T-006 扩展: 支持 'channel' / 'group' 消耗者类型
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import type { TopConsumersData, ConsumerType, SortDimension } from '../../types/usage';
import { useTopConsumersOptions } from '../../hooks/use-chart-options';
import { formatCost, formatTokens, formatRequests, formatPercent } from '../../utils/formatters';
import ChartContainer from '../layout/ChartContainer.vue';

const props = defineProps<{
  data: TopConsumersData | null;
  loading?: boolean;
  themeMode?: 'light' | 'dark';
}>();

const emit = defineEmits<{
  (e: 'retry'): void;
  (e: 'change-type', type: ConsumerType): void;
  (e: 'change-sort', sortBy: SortDimension): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
let chartInstance: echarts.ECharts | null = null;

const dataRef = computed(() => props.data);
const themeRef = computed(() => props.themeMode || 'light');
const chartOptions = useTopConsumersOptions(dataRef, themeRef);

/** Consumer type options — extended with channel/group */
const consumerTypes: { value: ConsumerType; label: string }[] = [
  { value: 'user', label: 'Users' },
  { value: 'channel', label: 'Channels' },
  { value: 'group', label: 'Groups' },
  { value: 'apiKey', label: 'API Keys' },
  { value: 'project', label: 'Projects' },
];

const sortOptions: { value: SortDimension; label: string }[] = [
  { value: 'cost', label: 'Cost' },
  { value: 'tokens', label: 'Tokens' },
  { value: 'requests', label: 'Requests' },
];

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
    title="Top Consumers"
    :loading="loading"
    :empty="!data || data.consumers.length === 0"
    height="400px"
    @retry="emit('retry')"
  >
    <template #actions>
      <div class="controls">
        <!-- 消耗者类型 -->
        <select
          class="control-select"
          :value="data?.consumerType || 'user'"
          @change="emit('change-type', ($event.target as HTMLSelectElement).value as ConsumerType)"
        >
          <option v-for="ct in consumerTypes" :key="ct.value" :value="ct.value">
            {{ ct.label }}
          </option>
        </select>

        <!-- 排序维度 -->
        <select
          class="control-select"
          :value="data?.sortBy || 'cost'"
          @change="emit('change-sort', ($event.target as HTMLSelectElement).value as SortDimension)"
        >
          <option v-for="so in sortOptions" :key="so.value" :value="so.value">
            By {{ so.label }}
          </option>
        </select>
      </div>
    </template>

    <div class="top-consumers-layout">
      <!-- 图表 -->
      <div ref="chartRef" class="chart-area" />

      <!-- 表格 -->
      <div v-if="data && data.consumers.length > 0" class="table-area">
        <table class="consumers-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Requests</th>
              <th>Tokens</th>
              <th>Cost</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(c, idx) in data.consumers" :key="c.id">
              <td class="rank">{{ idx + 1 }}</td>
              <td class="name" :title="c.name">{{ c.name }}</td>
              <td>{{ formatRequests(c.requests) }}</td>
              <td>{{ formatTokens(c.tokens) }}</td>
              <td>{{ formatCost(c.cost) }}</td>
              <td>{{ formatPercent(c.share, 1) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </ChartContainer>
</template>

<style scoped>
.controls {
  display: flex;
  gap: 6px;
}

.control-select {
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid var(--brand-border, #e5e7eb);
  border-radius: var(--brand-radius-sm, 6px);
  background: var(--brand-bg, #ffffff);
  color: var(--brand-text-primary, #111827);
  cursor: pointer;
}

.top-consumers-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 8px;
}

.chart-area {
  flex: 1;
  min-height: 160px;
}

.table-area {
  max-height: 160px;
  overflow-y: auto;
  border-top: 1px solid var(--brand-divider, #f3f4f6);
}

.consumers-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.consumers-table th {
  text-align: left;
  padding: 6px 8px;
  font-weight: 600;
  color: var(--brand-text-secondary, #6b7280);
  border-bottom: 1px solid var(--brand-border, #e5e7eb);
  position: sticky;
  top: 0;
  background: var(--brand-surface, #f9fafb);
}

.consumers-table td {
  padding: 5px 8px;
  color: var(--brand-text-primary, #111827);
  border-bottom: 1px solid var(--brand-divider, #f3f4f6);
}

.consumers-table .rank {
  color: var(--brand-text-secondary, #6b7280);
  font-weight: 600;
  width: 24px;
}

.consumers-table .name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
