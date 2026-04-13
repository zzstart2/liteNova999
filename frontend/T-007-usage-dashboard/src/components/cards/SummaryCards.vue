<script setup lang="ts">
/**
 * SummaryCards - 概览统计卡片组
 *
 * 横向排列核心指标卡片。当 T-006 扩展数据可用时，
 * 额外显示 "Upstream Cost" 和 "Profit Margin" 卡片。
 */

import { computed } from 'vue';
import type { DashboardSummary } from '../../types/usage';
import { formatCost, formatTokens, formatRequests, formatLatency, formatPercent } from '../../utils/formatters';
import StatCard from './StatCard.vue';

const props = defineProps<{
  data: DashboardSummary | null;
  loading?: boolean;
}>();

const cards = computed(() => {
  if (!props.data) return [];

  const list = [
    {
      title: 'Total Requests',
      icon: '📡',
      formattedValue: formatRequests(props.data.totalRequests.value),
      metric: props.data.totalRequests,
    },
    {
      title: 'Total Tokens',
      icon: '🔤',
      formattedValue: formatTokens(props.data.totalTokens.value),
      metric: props.data.totalTokens,
    },
    {
      title: 'Total Cost',
      icon: '💰',
      formattedValue: formatCost(props.data.totalCost.value),
      metric: props.data.totalCost,
      // Show upstream cost as subtitle when available
      subtitle: props.data.upstreamCost
        ? `Upstream: ${formatCost(props.data.upstreamCost.value)}`
        : undefined,
      // Profit indicator when both cost and upstream cost are available
      profitIndicator: props.data.upstreamCost
        ? {
            revenue: props.data.totalCost.value,
            cost: props.data.upstreamCost.value,
          }
        : undefined,
    },
    {
      title: 'Avg Latency',
      icon: '⚡',
      formattedValue: formatLatency(props.data.avgLatency.value),
      metric: props.data.avgLatency,
    },
    {
      title: 'Success Rate',
      icon: '✅',
      formattedValue: formatPercent(props.data.successRate.value),
      metric: props.data.successRate,
    },
    {
      title: 'Active Models',
      icon: '🤖',
      formattedValue: String(props.data.activeModels.value),
      metric: props.data.activeModels,
    },
  ];

  // T-006 extended cards: Upstream Cost (standalone card)
  if (props.data.upstreamCost) {
    list.push({
      title: 'Upstream Cost',
      icon: '🏭',
      formattedValue: formatCost(props.data.upstreamCost.value),
      metric: props.data.upstreamCost,
      subtitle: undefined,
      profitIndicator: undefined,
    });
  }

  // T-006 extended cards: Profit Margin
  if (props.data.profitMargin) {
    list.push({
      title: 'Profit Margin',
      icon: '📈',
      formattedValue: formatPercent(props.data.profitMargin.value),
      metric: props.data.profitMargin,
      subtitle: undefined,
      profitIndicator: undefined,
    });
  }

  return list;
});
</script>

<template>
  <div class="summary-cards">
    <template v-if="loading">
      <StatCard
        v-for="i in 6"
        :key="i"
        title=""
        formatted-value=""
        :loading="true"
      />
    </template>

    <StatCard
      v-for="card in cards"
      v-else
      :key="card.title"
      :title="card.title"
      :icon="card.icon"
      :formatted-value="card.formattedValue"
      :metric="card.metric"
      :subtitle="card.subtitle"
      :profit-indicator="card.profitIndicator"
    />
  </div>
</template>

<style scoped>
.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

@media (max-width: 640px) {
  .summary-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
