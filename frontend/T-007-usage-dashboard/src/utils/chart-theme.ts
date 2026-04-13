/**
 * ECharts 主题配置
 *
 * 与品牌系统 (T-010) 的 CSS 变量集成，支持亮/暗主题切换
 */

import type { EChartsOption } from 'echarts';

// ============================================================
// 色板
// ============================================================

/** 默认数据系列色板（12 色） */
export const CHART_COLOR_PALETTE = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#a855f7', // purple
  '#84cc16', // lime
];

/** 费用相关色板（暖色系） */
export const COST_COLOR_PALETTE = [
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#22c55e',
  '#ec4899',
  '#f97316',
];

/** Token Input / Output 双色 */
export const TOKEN_COLORS = {
  input: '#3b82f6',
  output: '#8b5cf6',
  total: '#6366f1',
};

/** 趋势色 */
export const TREND_COLORS = {
  up: '#ef4444',
  down: '#22c55e',
  flat: '#6b7280',
};

// ============================================================
// 主题配置
// ============================================================

export interface ChartThemeConfig {
  backgroundColor: string;
  textColor: string;
  textColorSecondary: string;
  axisLineColor: string;
  splitLineColor: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipTextColor: string;
}

export const LIGHT_THEME: ChartThemeConfig = {
  backgroundColor: 'transparent',
  textColor: '#111827',
  textColorSecondary: '#6b7280',
  axisLineColor: '#e5e7eb',
  splitLineColor: '#f3f4f6',
  tooltipBg: '#ffffff',
  tooltipBorder: '#e5e7eb',
  tooltipTextColor: '#111827',
};

export const DARK_THEME: ChartThemeConfig = {
  backgroundColor: 'transparent',
  textColor: '#f1f5f9',
  textColorSecondary: '#94a3b8',
  axisLineColor: '#334155',
  splitLineColor: '#1e293b',
  tooltipBg: '#1e293b',
  tooltipBorder: '#334155',
  tooltipTextColor: '#f1f5f9',
};

export function getChartTheme(mode: 'light' | 'dark'): ChartThemeConfig {
  return mode === 'dark' ? DARK_THEME : LIGHT_THEME;
}

// ============================================================
// 基础图表选项生成
// ============================================================

/**
 * 生成通用基础图表配置
 */
export function createBaseOptions(theme: ChartThemeConfig): Partial<EChartsOption> {
  return {
    backgroundColor: theme.backgroundColor,
    textStyle: {
      color: theme.textColor,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 12,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      textStyle: {
        color: theme.tooltipTextColor,
        fontSize: 13,
      },
      extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px;',
    },
    legend: {
      textStyle: {
        color: theme.textColorSecondary,
        fontSize: 12,
      },
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 16,
    },
    grid: {
      top: 48,
      right: 24,
      bottom: 32,
      left: 16,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      axisLine: {
        lineStyle: { color: theme.axisLineColor },
      },
      axisTick: { show: false },
      axisLabel: {
        color: theme.textColorSecondary,
        fontSize: 11,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: theme.textColorSecondary,
        fontSize: 11,
      },
      splitLine: {
        lineStyle: {
          color: theme.splitLineColor,
          type: 'dashed',
        },
      },
    },
  };
}

/**
 * 合并图表配置（浅合并）
 */
export function mergeChartOptions(
  base: Partial<EChartsOption>,
  overrides: Partial<EChartsOption>
): EChartsOption {
  return { ...base, ...overrides } as EChartsOption;
}
