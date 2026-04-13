<script setup lang="ts">
/**
 * StatCard - 单个统计卡片
 *
 * 展示标题 + 数值 + 变化率 + 迷你趋势图
 * 支持 profit indicator (对比 upstream cost vs revenue)
 */

import { computed } from 'vue';
import type { StatMetric } from '../../types/usage';
import { TREND_COLORS } from '../../utils/chart-theme';

const props = defineProps<{
  /** 指标标题 */
  title: string;
  /** 格式化后的主数值 */
  formattedValue: string;
  /** 原始指标数据（含变化率、趋势） */
  metric?: StatMetric;
  /** 图标 */
  icon?: string;
  /** 加载中 */
  loading?: boolean;
  /** 副标题 (如 upstream cost 对比) */
  subtitle?: string;
  /** 副标题颜色 */
  subtitleColor?: string;
  /**
   * 利润指示器: 当提供时显示 revenue vs cost 对比条
   * { revenue: number; cost: number } — 均为 USD
   */
  profitIndicator?: { revenue: number; cost: number };
}>();

const changeText = computed(() => {
  if (!props.metric?.changeRate && props.metric?.changeRate !== 0) return null;
  const rate = props.metric.changeRate;
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate.toFixed(1)}%`;
});

const trendColor = computed(() => {
  if (!props.metric?.trend) return TREND_COLORS.flat;
  return TREND_COLORS[props.metric.trend];
});

/** 利润百分比 */
const profitPercent = computed(() => {
  if (!props.profitIndicator || props.profitIndicator.revenue <= 0) return null;
  const { revenue, cost } = props.profitIndicator;
  return Math.round(((revenue - cost) / revenue) * 1000) / 10;
});

/** 利润条宽度 (cost / revenue %) */
const costBarWidth = computed(() => {
  if (!props.profitIndicator || props.profitIndicator.revenue <= 0) return '0%';
  const ratio = Math.min(props.profitIndicator.cost / props.profitIndicator.revenue, 1);
  return `${Math.round(ratio * 100)}%`;
});

/** 简易 SVG 迷你图 */
const sparklinePath = computed(() => {
  const data = props.metric?.sparkline;
  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 24;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  return `M${points.join(' L')}`;
});
</script>

<template>
  <div class="stat-card" :class="{ 'stat-card--loading': loading }">
    <!-- 骨架屏 -->
    <template v-if="loading">
      <div class="skeleton skeleton-title" />
      <div class="skeleton skeleton-value" />
      <div class="skeleton skeleton-change" />
    </template>

    <template v-else>
      <div class="stat-header">
        <span v-if="icon" class="stat-icon">{{ icon }}</span>
        <span class="stat-title">{{ title }}</span>
      </div>

      <div class="stat-value">{{ formattedValue }}</div>

      <!-- 副标题 (如 "Upstream: $1,234") -->
      <div v-if="subtitle" class="stat-subtitle" :style="subtitleColor ? { color: subtitleColor } : {}">
        {{ subtitle }}
      </div>

      <!-- 利润指示条 -->
      <div v-if="profitIndicator && profitPercent !== null" class="profit-indicator">
        <div class="profit-bar-bg">
          <div class="profit-bar-fill" :style="{ width: costBarWidth }" />
        </div>
        <span class="profit-label" :class="{ 'profit-positive': profitPercent >= 0, 'profit-negative': profitPercent < 0 }">
          {{ profitPercent >= 0 ? '+' : '' }}{{ profitPercent }}% margin
        </span>
      </div>

      <div class="stat-footer">
        <span
          v-if="changeText"
          class="stat-change"
          :style="{ color: trendColor }"
        >
          {{ changeText }}
        </span>

        <!-- 迷你趋势图 -->
        <svg
          v-if="sparklinePath"
          class="stat-sparkline"
          viewBox="0 0 80 24"
          preserveAspectRatio="none"
        >
          <path
            :d="sparklinePath"
            fill="none"
            :stroke="trendColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--brand-bg, #ffffff);
  border: 1px solid var(--brand-border, #e5e7eb);
  border-radius: var(--brand-radius-lg, 12px);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: box-shadow 0.2s;
}

.stat-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stat-icon {
  font-size: 16px;
}

.stat-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--brand-text-secondary, #6b7280);
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--brand-text-primary, #111827);
  line-height: 1.2;
  letter-spacing: -0.025em;
}

.stat-subtitle {
  font-size: 11px;
  color: var(--brand-text-secondary, #6b7280);
}

/* Profit indicator */
.profit-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.profit-bar-bg {
  flex: 1;
  height: 4px;
  background: var(--brand-surface, #f3f4f6);
  border-radius: 2px;
  overflow: hidden;
}

.profit-bar-fill {
  height: 100%;
  background: #f59e0b;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.profit-label {
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

.profit-positive {
  color: #22c55e;
}

.profit-negative {
  color: #ef4444;
}

.stat-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-change {
  font-size: 12px;
  font-weight: 600;
}

.stat-sparkline {
  width: 80px;
  height: 24px;
  flex-shrink: 0;
}

/* 骨架屏 */
.skeleton {
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    var(--brand-border, #e5e7eb) 25%,
    var(--brand-surface, #f9fafb) 50%,
    var(--brand-border, #e5e7eb) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-title {
  width: 60%;
  height: 14px;
}

.skeleton-value {
  width: 45%;
  height: 30px;
}

.skeleton-change {
  width: 70%;
  height: 12px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
