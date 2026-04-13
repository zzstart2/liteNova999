/**
 * useChartOptions - ECharts 配置生成器 Hook
 *
 * 根据数据类型生成标准化的 ECharts 配置，与主题系统联动
 * 支持 T-006 扩展: 上游成本叠加线 (双 Y 轴)
 */

import { computed, type Ref } from 'vue';
import type { EChartsOption } from 'echarts';
import type {
  CostTrendData,
  TokenTrendData,
  ModelAnalysisData,
  TopConsumersData,
} from '../types/usage';
import {
  createBaseOptions,
  getChartTheme,
  CHART_COLOR_PALETTE,
  COST_COLOR_PALETTE,
  TOKEN_COLORS,
} from '../utils/chart-theme';
import { formatCost, formatTokens, formatDate, formatLatency, formatPercent } from '../utils/formatters';

// ============================================================
// 费用趋势图 (支持双 Y 轴: revenue + upstream cost)
// ============================================================

export function useCostTrendOptions(
  data: Ref<CostTrendData | null>,
  themeMode: Ref<'light' | 'dark'>,
  stacked = true,
  showUpstreamCost = false
) {
  return computed<EChartsOption | null>(() => {
    if (!data.value) return null;

    const theme = getChartTheme(themeMode.value);
    const base = createBaseOptions(theme);
    const { series: rawSeries, models } = data.value;

    const dates = rawSeries.map((d) => formatDate(d.date));

    // Build main series (revenue)
    let mainSeries: any[];

    if (stacked && models.length > 0) {
      // 多模型堆叠区域图
      mainSeries = models.map((model, idx) => ({
        name: model,
        type: 'line' as const,
        stack: 'cost',
        areaStyle: { opacity: 0.35 },
        emphasis: { focus: 'series' as const },
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5 },
        data: rawSeries.map((d) => d.byModel[model] || 0),
        itemStyle: { color: COST_COLOR_PALETTE[idx % COST_COLOR_PALETTE.length] },
      }));
    } else {
      // 单线总费用
      mainSeries = [
        {
          name: 'Revenue',
          type: 'line',
          smooth: true,
          symbol: 'none',
          areaStyle: { opacity: 0.2 },
          lineStyle: { width: 2 },
          itemStyle: { color: COST_COLOR_PALETTE[0] },
          data: rawSeries.map((d) => d.totalCost),
        },
      ];
    }

    // If upstream cost data available and requested, add second Y axis
    if (showUpstreamCost && rawSeries.some((d) => d.upstreamCost !== undefined && d.upstreamCost > 0)) {
      const upstreamData = rawSeries.map((d) => d.upstreamCost ?? 0);
      
      return {
        ...base,
        color: COST_COLOR_PALETTE,
        legend: { ...base.legend, data: [...models, 'Upstream Cost'] },
        tooltip: {
          ...base.tooltip,
          trigger: 'axis',
          formatter: (params: any) => {
            if (!Array.isArray(params)) return '';
            const date = params[0]?.axisValue || '';
            let total = 0;
            let upstream = 0;
            let html = `<div style="font-weight:600;margin-bottom:6px">${date}</div>`;
            for (const p of params) {
              if (p.seriesName === 'Upstream Cost') {
                upstream = p.value || 0;
                html += `<div style="display:flex;justify-content:space-between;gap:16px">
                  <span>${p.marker} ${p.seriesName}</span>
                  <span style="font-weight:500">${formatCost(p.value || 0)}</span>
                </div>`;
              } else {
                total += p.value || 0;
                html += `<div style="display:flex;justify-content:space-between;gap:16px">
                  <span>${p.marker} ${p.seriesName}</span>
                  <span style="font-weight:500">${formatCost(p.value || 0)}</span>
                </div>`;
              }
            }
            html += `<div style="border-top:1px solid ${theme.splitLineColor};margin-top:6px;padding-top:6px;display:flex;justify-content:space-between">
              <span style="font-weight:600">Revenue</span>
              <span style="font-weight:700">${formatCost(total)}</span>
            </div>`;
            if (upstream > 0) {
              html += `<div style="display:flex;justify-content:space-between">
                <span style="font-weight:600">Upstream</span>
                <span style="font-weight:700">${formatCost(upstream)}</span>
              </div>`;
            }
            return html;
          },
        },
        xAxis: { ...base.xAxis, data: dates },
        yAxis: [
          {
            ...base.yAxis,
            type: 'value',
            name: 'Revenue',
            nameLocation: 'middle',
            nameGap: 50,
            axisLabel: {
              ...(base.yAxis as any)?.axisLabel,
              formatter: (v: number) => formatCost(v, 0),
            },
          },
          {
            ...base.yAxis,
            type: 'value',
            name: 'Upstream',
            nameLocation: 'middle',
            nameGap: 50,
            axisLabel: {
              ...(base.yAxis as any)?.axisLabel,
              formatter: (v: number) => formatCost(v, 0),
            },
            splitLine: { show: false },
          },
        ],
        series: [
          ...mainSeries,
          {
            name: 'Upstream Cost',
            type: 'line',
            yAxisIndex: 1,
            smooth: true,
            symbol: 'none',
            lineStyle: { width: 2, type: 'dashed' as const },
            itemStyle: { color: '#f59e0b' },
            data: upstreamData,
          },
        ],
      } as EChartsOption;
    }

    // Standard single-axis
    return {
      ...base,
      color: COST_COLOR_PALETTE,
      legend: { ...base.legend, data: models },
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        formatter: (params: any) => {
          if (!Array.isArray(params)) return '';
          const date = params[0]?.axisValue || '';
          let total = 0;
          let html = `<div style="font-weight:600;margin-bottom:6px">${date}</div>`;
          for (const p of params) {
            total += p.value || 0;
            html += `<div style="display:flex;justify-content:space-between;gap:16px">
              <span>${p.marker} ${p.seriesName}</span>
              <span style="font-weight:500">${formatCost(p.value || 0)}</span>
            </div>`;
          }
          html += `<div style="border-top:1px solid ${theme.splitLineColor};margin-top:6px;padding-top:6px;display:flex;justify-content:space-between">
            <span style="font-weight:600">Total</span>
            <span style="font-weight:700">${formatCost(total)}</span>
          </div>`;
          return html;
        },
      },
      xAxis: { ...base.xAxis, data: dates },
      yAxis: {
        ...base.yAxis,
        axisLabel: {
          ...(base.yAxis as any)?.axisLabel,
          formatter: (v: number) => formatCost(v, 0),
        },
      },
      series: mainSeries,
    } as EChartsOption;
  });
}

// ============================================================
// Token 用量趋势图
// ============================================================

export function useTokenTrendOptions(
  data: Ref<TokenTrendData | null>,
  themeMode: Ref<'light' | 'dark'>
) {
  return computed<EChartsOption | null>(() => {
    if (!data.value) return null;

    const theme = getChartTheme(themeMode.value);
    const base = createBaseOptions(theme);
    const { series: rawSeries } = data.value;

    const dates = rawSeries.map((d) => formatDate(d.date));

    return {
      ...base,
      legend: { ...base.legend, data: ['Input Tokens', 'Output Tokens'] },
      xAxis: { ...base.xAxis, data: dates },
      yAxis: {
        ...base.yAxis,
        axisLabel: {
          ...(base.yAxis as any)?.axisLabel,
          formatter: (v: number) => formatTokens(v),
        },
      },
      series: [
        {
          name: 'Input Tokens',
          type: 'bar',
          stack: 'tokens',
          barMaxWidth: 24,
          itemStyle: { color: TOKEN_COLORS.input, borderRadius: [0, 0, 0, 0] },
          data: rawSeries.map((d) => d.inputTokens),
        },
        {
          name: 'Output Tokens',
          type: 'bar',
          stack: 'tokens',
          barMaxWidth: 24,
          itemStyle: { color: TOKEN_COLORS.output, borderRadius: [4, 4, 0, 0] },
          data: rawSeries.map((d) => d.outputTokens),
        },
      ],
    } as EChartsOption;
  });
}

// ============================================================
// 模型占比饼图
// ============================================================

export function useModelPieOptions(
  data: Ref<ModelAnalysisData | null>,
  themeMode: Ref<'light' | 'dark'>,
  dimension: 'cost' | 'requests' | 'tokens' = 'cost'
) {
  return computed<EChartsOption | null>(() => {
    if (!data.value) return null;

    const theme = getChartTheme(themeMode.value);

    const pieData = data.value.models.map((m, idx) => ({
      name: m.modelName,
      value:
        dimension === 'cost'
          ? m.cost
          : dimension === 'requests'
            ? m.requests
            : m.tokens.total,
      itemStyle: { color: CHART_COLOR_PALETTE[idx % CHART_COLOR_PALETTE.length] },
    }));

    return {
      backgroundColor: theme.backgroundColor,
      textStyle: { color: theme.textColor },
      tooltip: {
        trigger: 'item',
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.tooltipTextColor },
        formatter: (params: any) => {
          const formatter =
            dimension === 'cost'
              ? formatCost
              : dimension === 'tokens'
                ? formatTokens
                : (v: number) => v.toLocaleString();
          return `${params.marker} ${params.name}<br/>
            ${formatter(params.value)} (${params.percent}%)`;
        },
      },
      legend: {
        orient: 'vertical' as const,
        right: 16,
        top: 'center',
        textStyle: { color: theme.textColorSecondary, fontSize: 12 },
        icon: 'circle',
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [
        {
          type: 'pie',
          radius: ['45%', '72%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: true,
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: 'bold' },
            itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.15)' },
          },
          labelLine: { show: false },
          data: pieData,
        },
      ],
    } as EChartsOption;
  });
}

// ============================================================
// 模型费用柱状图
// ============================================================

export function useModelBarOptions(
  data: Ref<ModelAnalysisData | null>,
  themeMode: Ref<'light' | 'dark'>
) {
  return computed<EChartsOption | null>(() => {
    if (!data.value) return null;

    const theme = getChartTheme(themeMode.value);
    const base = createBaseOptions(theme);

    const sorted = [...data.value.models].sort((a, b) => b.cost - a.cost);

    return {
      ...base,
      grid: { ...base.grid, left: 24 },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: theme.textColorSecondary,
          formatter: (v: number) => formatCost(v, 0),
        },
        splitLine: {
          lineStyle: { color: theme.splitLineColor, type: 'dashed' },
        },
      },
      yAxis: {
        type: 'category',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: theme.textColor,
          fontSize: 12,
          width: 120,
          overflow: 'truncate',
        },
        data: sorted.map((m) => m.modelName),
        inverse: true,
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 20,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: (params: any) =>
              CHART_COLOR_PALETTE[params.dataIndex % CHART_COLOR_PALETTE.length],
          },
          label: {
            show: true,
            position: 'right',
            formatter: (params: any) => formatCost(params.value),
            color: theme.textColorSecondary,
            fontSize: 11,
          },
          data: sorted.map((m) => m.cost),
        },
      ],
    } as EChartsOption;
  });
}

// ============================================================
// Top 消耗排行柱状图
// ============================================================

export function useTopConsumersOptions(
  data: Ref<TopConsumersData | null>,
  themeMode: Ref<'light' | 'dark'>
) {
  return computed<EChartsOption | null>(() => {
    if (!data.value) return null;

    const theme = getChartTheme(themeMode.value);
    const base = createBaseOptions(theme);
    const { consumers, sortBy } = data.value;

    const valueKey = sortBy === 'latency' ? 'cost' : sortBy;
    const formatter =
      sortBy === 'cost'
        ? formatCost
        : sortBy === 'tokens'
          ? formatTokens
          : (v: number) => v.toLocaleString();

    return {
      ...base,
      grid: { ...base.grid, left: 24 },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: theme.splitLineColor, type: 'dashed' } },
        axisLabel: {
          color: theme.textColorSecondary,
          formatter: (v: number) => formatter(v),
        },
      },
      yAxis: {
        type: 'category',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: theme.textColor, fontSize: 12 },
        data: consumers.map((c) => c.name),
        inverse: true,
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 18,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: (params: any) =>
              CHART_COLOR_PALETTE[params.dataIndex % CHART_COLOR_PALETTE.length],
          },
          label: {
            show: true,
            position: 'right',
            formatter: (params: any) => `${formatter(params.value)} (${consumers[params.dataIndex]?.share}%)`,
            color: theme.textColorSecondary,
            fontSize: 11,
          },
          data: consumers.map((c) => (c as any)[valueKey] || 0),
        },
      ],
    } as EChartsOption;
  });
}
