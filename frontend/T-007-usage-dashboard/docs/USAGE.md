# 用量仪表盘前端组件 — 使用文档

## 快速开始

### 1. 初始化 API 并渲染仪表盘

```vue
<script setup>
import { onMounted } from 'vue';
import { setUsageApi, createMockUsageApi } from './api/usage-api';
import DashboardPage from './components/layout/DashboardPage.vue';

// 开发阶段使用 Mock
onMounted(() => setUsageApi(createMockUsageApi(300)));

// 生产环境替换为：
// import { createRealUsageApi } from './api/usage-api.real';
// onMounted(() => setUsageApi(createRealUsageApi('https://api.example.com', { role: 'admin' })));
</script>

<template>
  <DashboardPage />
</template>
```

`DashboardPage.vue` 是开箱即用的完整仪表盘页面，包含概览卡片、趋势图、模型分析和 Top 消耗排行。

### 2. 与品牌系统集成 (T-010)

```vue
<template>
  <BrandProvider :config="brandConfig" theme="auto">
    <DashboardPage />
  </BrandProvider>
</template>
```

所有图表和卡片颜色通过 CSS 变量 (`--brand-*`) 与品牌系统联动。

## 核心 Hook: useDashboard

```ts
import { useDashboard } from './hooks/use-dashboard';

const {
  // 状态
  loading,
  error,
  lastRefreshed,

  // 数据
  summary,        // 概览统计（总请求/Token/费用/延迟/成功率）
  costTrend,      // 费用趋势（按日/模型堆叠）
  tokenTrend,     // Token 用量趋势（Input/Output）
  modelAnalysis,  // 模型维度分析（占比/费用/性能）
  topConsumers,   // Top 消耗排行

  // 筛选
  selectedRange,  // 当前预设范围 ('7d', '30d', '90d' 等)
  granularity,    // 时间粒度 (自动计算)
  selectedModels, // 筛选模型
  modelCategory,  // 模型类别筛选 (T-006 扩展): 'all' | 'text' | 'image' | 'audio' | 'video' | 'embedding'

  // Top 消耗排行控制
  consumerType,   // 'apiKey' | 'user' | 'project' | 'channel' | 'group'
  sortBy,         // 'cost' | 'tokens' | 'requests'

  // 操作
  refresh,        // 手动刷新
  setRange,       // 切换预设范围
  setCustomRange, // 自定义日期范围
  setConsumerType,// 切换消耗者维度
  setSortBy,      // 切换排序维度
  setModelCategory, // 切换模型类别 (T-006 扩展)
} = useDashboard({
  autoRefreshInterval: 60,  // 自动刷新间隔(秒)，0=关闭
  defaultRange: '30d',
  topN: 10,
  quotaToUsdRate: 1 / 500000, // quota → USD 换算率
});
```

### 自动行为

- **自动刷新**: 默认每 60 秒刷新一次，组件卸载自动清理
- **自动粒度**: 切换时间范围时自动选择合适粒度（24h→hourly, 7-90d→daily, 180d-1y→weekly）
- **并行加载**: 所有数据并行获取，不阻塞渲染

## 后端集成指南 (T-006)

### API 端点

| 角色 | 端点 | 说明 |
|------|------|------|
| Admin | `GET /api/data/` | 按 model_name + created_at 聚合 |
| Admin | `GET /api/data/users` | 按 username + created_at 聚合 |
| User | `GET /api/data/self` | 当前用户自己的用量数据 |

### 请求参数

```bash
# Admin: 获取模型维度数据
curl "http://localhost:8080/api/data/?start_timestamp=1721520000&end_timestamp=1724121600"

# Admin: 获取用户维度数据
curl "http://localhost:8080/api/data/users?start_timestamp=1721520000&end_timestamp=1724121600"

# User: 获取自己的数据
curl "http://localhost:8080/api/data/self?start_timestamp=1721520000&end_timestamp=1724121600"
```

- `start_timestamp`: Unix 时间戳（秒），开始时间
- `end_timestamp`: Unix 时间戳（秒），结束时间
- `username`: 可选，仅 `/api/data/` 支持，用于筛选特定用户

### 响应格式

```json
{
  "success": true,
  "message": "",
  "data": [
    {
      "id": 1,
      "user_id": 123,
      "username": "alice",
      "model_name": "gpt-4",
      "created_at": 1721520000,
      "token_used": 15000,
      "count": 42,
      "quota": 50000,
      "prompt_tokens": 8000,
      "completion_tokens": 7000,
      "model_ratio": 30.0,
      "completion_ratio": 2.0,
      "channel_id": 5,
      "group": "default",
      "avg_use_time": 852,
      "max_use_time": 2300,
      "stream_count": 30,
      "error_count": 2,
      "total_use_time": 35784
    }
  ]
}
```

### Quota → USD 换算

后端返回的 `quota` 是内部计费单位，需要通过换算率转换为 USD：

```
USD = quota × quotaToUsdRate

# 默认换算率 (500000 quota = 1 USD)
quotaToUsdRate = 1 / 500000 = 0.000002
```

可以在 `DashboardConfig` 中配置 `quotaToUsdRate`：

```ts
const dashboard = useDashboard({
  quotaToUsdRate: 1 / 500000, // 或根据实际业务调整
});
```

### T-006 扩展字段

以下字段可能尚未在后端实现，均为可选：

| 字段 | 类型 | 说明 |
|------|------|------|
| `upstream_cost` | float64 | 上游成本 (USD) |
| `profit_margin` | float64 | 利润率 (%) |
| `currency` | string | 货币类型 |
| `model_category` | string | 模型类别: text/image/audio/video |
| `endpoint_type` | string | 端点类型: chat/completion/embedding |
| `first_response_ms` | int | 首 Token 延迟 |
| `p95_latency_ms` | int | P95 延迟 |
| `success_count` | int | 成功请求数 |
| `error_type_detail` | string | 错误类型详情 (JSON) |

### 前端 Real API 配置

```ts
import { createRealUsageApi } from './api/usage-api.real';

// Admin 模式
const adminApi = createRealUsageApi('http://localhost:8080', {
  role: 'admin',
  authToken: 'your-jwt-token',
  quotaToUsdRate: 1 / 500000,
});

// User 模式
const userApi = createRealUsageApi('http://localhost:8080', {
  role: 'user',
  authToken: 'your-jwt-token',
});
```

## 单独使用图表组件

每个图表组件都可以独立使用：

### 费用趋势

```vue
<script setup>
import CostTrendChart from './components/charts/CostTrendChart.vue';
</script>

<template>
  <CostTrendChart
    :data="costTrendData"
    :loading="isLoading"
    theme-mode="light"
    :stacked="true"
    :show-upstream-cost="true"
    @retry="handleRetry"
  />
</template>
```

### Token 用量

```vue
<TokenUsageChart :data="tokenTrendData" :loading="isLoading" theme-mode="dark" />
```

### 模型分析

```vue
<!-- 饼图：支持 cost/requests/tokens 维度切换 -->
<ModelPieChart :data="modelData" dimension="cost" @update:dimension="onDimChange" />

<!-- 柱状图 -->
<ModelBarChart :data="modelData" theme-mode="light" />
```

### Top 消耗排行

```vue
<TopConsumersChart
  :data="topData"
  @change-type="setConsumerType"
  @change-sort="setSortBy"
/>
```

### 统计卡片

```vue
<StatCard
  title="Total Cost"
  icon="💰"
  formatted-value="$2,841"
  :metric="{ value: 2841, changeRate: 12.5, trend: 'up', sparkline: [...] }"
  :profit-indicator="{ revenue: 2841, cost: 1700 }"
/>
```

## 格式化工具

```ts
import {
  compactNumber,   // 1234567 → '1.2M'
  formatCost,      // 2841.23 → '$2,841.23' 或 '$2.8K'
  formatTokens,    // 45000000 → '45.0M'
  formatLatency,   // 852 → '852ms', 1234 → '1.23s'
  formatPercent,   // 99.95 → '99.95%'
  formatRequests,  // 12345 → '12.3K req'
  formatChangeRate,// 12.5 → '+12.5%'
  formatDate,      // ISO → 'Jan 15'
  formatRelativeTime, // ISO → '2h ago'
} from './utils/formatters';

// 从 quota-transform
import { quotaToUsd } from './transforms/quota-transform';
const usd = quotaToUsd(500000); // → 1 USD
```

## ECharts 主题

```ts
import { getChartTheme, CHART_COLOR_PALETTE, TOKEN_COLORS } from './utils/chart-theme';

const theme = getChartTheme('dark'); // 返回暗色主题配置
// theme.backgroundColor, theme.textColor, theme.axisLineColor, ...
```

### 色板

| 名称 | 用途 | 色数 |
|------|------|------|
| `CHART_COLOR_PALETTE` | 通用数据系列 | 12 色 |
| `COST_COLOR_PALETTE` | 费用相关 | 8 色 |
| `TOKEN_COLORS` | Input/Output Token | 2 色 |
| `TREND_COLORS` | up/down/flat 趋势 | 3 色 |

## API 适配器

### 接口定义

```ts
interface IUsageApi {
  getDashboard(query): Promise<DashboardData>;
  getSummary(query): Promise<DashboardSummary>;
  getCostTrend(query): Promise<CostTrendData>;
  getTokenTrend(query): Promise<TokenTrendData>;
  getModelAnalysis(query): Promise<ModelAnalysisData>;
  getTopConsumers(query, type, sortBy, order, limit): Promise<TopConsumersData>;
}
```

### 切换 Mock / Real

```ts
// 开发
setUsageApi(createMockUsageApi(300));  // 300ms 模拟延迟

// 生产
setUsageApi(createRealUsageApi('https://api.lite999.com', { role: 'admin', authToken: token }));
```

## Pinia Store（可选）

```ts
import { useUsageStore } from './stores/usage-store';

const store = useUsageStore();
await store.fetchAll();          // 首次加载
await store.fetchAll(true);      // 强制刷新
store.setDateRange({ start, end });
store.setModelCategory('text');   // T-006 扩展筛选
```

Store 内置 5 分钟缓存，重复调用不会重发请求。

## 组件清单

| 组件 | 用途 |
|------|------|
| `DashboardPage.vue` | 完整仪表盘页面（含模型类别标签页） |
| `CostTrendChart.vue` | 费用趋势（多模型堆叠/单线/双Y轴） |
| `TokenUsageChart.vue` | Token 用量（Input/Output 堆叠柱状图） |
| `ModelPieChart.vue` | 模型占比环形图（cost/requests/tokens + category 筛选） |
| `ModelBarChart.vue` | 模型费用水平柱状图 |
| `TopConsumersChart.vue` | 排行柱状图 + 表格联动（支持 channel/group） |
| `StatCard.vue` | 统计卡片（数值+变化率+迷你图+利润指示器） |
| `SummaryCards.vue` | 6+2 卡片概览组（含上游成本/利润率） |
| `ChartContainer.vue` | 图表容器（标题/加载/空态/错误） |
| `DateRangePicker.vue` | 日期范围选择器（预设+自定义） |

## 响应式布局

| 断点 | 行为 |
|------|------|
| ≤ 640px | 概览卡片 2 列，图表单列 |
| ≤ 860px | 图表单列全宽 |
| ≥ 860px | 图表双列网格 |
| max-width | 1280px 居中 |

## T-006 扩展功能汇总

| 功能 | 位置 | 说明 |
|------|------|------|
| 模型类别筛选 | DashboardPage | 标签页切换 (All/Text/Image/Audio/Video/Embedding) |
| 上游成本 | CostTrendChart | 双 Y 轴叠加线 |
| 利润率 | StatCard / SummaryCards | 利润条 + 利润率卡片 |
| Channel/Group 维度 | TopConsumersChart | 新增消耗者类型选项 |
| Raw 数据缓存 | usage-store.ts | 供二次计算使用 |
