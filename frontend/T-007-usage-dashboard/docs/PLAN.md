# PRJ-LITE999-T-007 用量仪表盘前端组件开发 — 工作计划

## 任务概述

开发用量仪表盘的前端可视化组件体系，包含成本分析、趋势图、模型维度分析等，
为运营与用户提供清晰的 Token 消耗、费用趋势、模型对比等数据洞察能力。

## 依赖分析

| 依赖 | 假设 |
|------|------|
| **T-006** (用量统计后端 API) | REST API，返回标准化的用量/费用/模型维度聚合数据 |
| **T-003** (项目基础架构) | Vue 3 + TypeScript + Vite；已集成 ECharts 或 Apache ECharts |

本任务独立定义 API 接口类型 + Mock 数据层，后端就绪后只需替换 adapter。

## 功能分解

### 1. 概览卡片 (Summary Cards)
- 总请求量 / 总 Token 数 / 总费用 / 平均延迟
- 同比/环比变化率 + 趋势迷你图
- 响应式网格布局
- **T-006 扩展**: 上游成本 (Upstream Cost) 和利润率 (Profit Margin) 卡片

### 2. 费用趋势图 (Cost Trend Chart)
- 按日/周/月粒度展示费用趋势折线图
- 支持多模型堆叠区域图
- 时间范围选择器（7d / 30d / 90d / 自定义）
- tooltip 费用明细
- **T-006 扩展**: 双 Y 轴显示上游成本叠加线

### 3. Token 用量趋势 (Token Usage Chart)
- Input / Output Token 分区域堆叠
- 日均量 + 峰值标注
- 时间对比（本期 vs 上期）

### 4. 模型维度分析 (Model Analysis)
- 模型调用占比 — 环形图 / 饼图
- 模型费用对比 — 水平柱状图
- 模型性能指标 — 表格（平均延迟、成功率、P99）
- 模型趋势 — 多折线对比
- **T-006 扩展**: 按 model_category 筛选 (text/image/audio/video/embedding)

### 5. Top 消耗排行 (Top Consumers)
- 按 API Key / 用户 / 项目 / 渠道 / 分组维度
- 柱状图 + 表格联动
- 排序切换（按请求量 / Token / 费用）

### 6. 仪表盘布局页 (Dashboard Page)
- 响应式网格布局
- 时间范围全局筛选
- 模型类别筛选标签页 (All/Text/Image/Audio/Video/Embedding)
- 自动刷新 / 手动刷新
- 加载骨架屏

## 架构设计

```
┌───────────────────────────────────────────────────┐
│               DashboardPage.vue                    │
│  全局筛选（日期范围、模型类别、刷新）               │
├───────────┬───────────┬───────────┬───────────────┤
│ Summary   │ CostTrend │ TokenUsage│ ModelAnalysis │
│ Cards     │ Chart     │ Chart     │ Charts/Table  │
├───────────┴───────────┴───────────┴───────────────┤
│               TopConsumers                         │
└───────────────────────────────────────────────────┘
        ↕ useDashboard() ← useUsageApi()
        ↕ Pinia Store (缓存 + 响应式状态)
        ↕ API Adapter (Real / Mock)
        ↕ quota-transform.ts (数据转换层)
```

## 技术选型

- **Vue 3** Composition API + `<script setup>`
- **TypeScript** 严格类型
- **ECharts 5** (通过 vue-echarts 或原生 init)
- **Pinia** 状态管理（可选，提供 store 层）
- **VueUse** 工具函数（useIntervalFn 等）
- **date-fns / dayjs** 日期处理
- **Vitest** 单元测试

## 后端集成 (T-006)

### API 端点

| 角色 | 端点 | 说明 |
|------|------|------|
| Admin | `GET /api/data/` | 按 model_name + created_at 聚合 |
| Admin | `GET /api/data/users` | 按 username + created_at 聚合 |
| User | `GET /api/data/self` | 当前用户自己的用量数据 |

### 请求参数

```
GET /api/data/?start_timestamp=<unix>&end_timestamp=<unix>&username=<opt>
GET /api/data/users?start_timestamp=<unix>&end_timestamp=<unix>
GET /api/data/self?start_timestamp=<unix>&end_timestamp=<unix>
```

- `start_timestamp`: Unix 时间戳（秒）
- `end_timestamp`: Unix 时间戳（秒）
- `username`: 可选，仅 Admin 访问 `/api/data/` 时可指定用户

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

### T-006 扩展字段（可能尚未实现）

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

## 产出文件清单

### 类型 & API
- `src/types/usage.ts` — 用量数据类型定义 (含 RawQuotaData)
- `src/api/usage-api.ts` — API 适配器接口
- `src/api/usage-api.mock.ts` — Mock 数据实现
- `src/api/usage-api.real.ts` — 真实 API 实现

### 转换层
- `src/transforms/quota-transform.ts` — RawQuotaData → Dashboard 数据转换

### Hooks & Store
- `src/hooks/use-dashboard.ts` — 仪表盘主 Hook
- `src/hooks/use-chart-options.ts` — ECharts 配置生成器
- `src/stores/usage-store.ts` — Pinia Store (含 rawData 缓存)

### 图表组件
- `src/components/charts/CostTrendChart.vue` — 费用趋势
- `src/components/charts/TokenUsageChart.vue` — Token 用量
- `src/components/charts/ModelPieChart.vue` — 模型占比饼图
- `src/components/charts/ModelBarChart.vue` — 模型费用柱状图
- `src/components/charts/TopConsumersChart.vue` — 排行图

### 卡片组件
- `src/components/cards/StatCard.vue` — 统计卡片 (支持利润指示器)
- `src/components/cards/SummaryCards.vue` — 概览卡片组

### 布局组件
- `src/components/layout/DashboardPage.vue` — 仪表盘页面
- `src/components/layout/DateRangePicker.vue` — 日期范围选择
- `src/components/layout/ChartContainer.vue` — 图表容器

### 工具
- `src/utils/formatters.ts` — 数字/金额/Token 格式化
- `src/utils/chart-theme.ts` — ECharts 主题配置

### 配置 & 测试
- `config/dashboard.default.json` — 默认仪表盘配置 (含 quotaToUsdRate)
- `tests/formatters.test.ts` — 格式化工具测试 (含 quotaToUsd)
- `tests/transforms.test.ts` — 转换层单元测试
- `tests/use-dashboard.test.ts` — Hook 测试
- `tests/mock-api.test.ts` — Mock API 测试

### 文档
- `docs/USAGE.md` — 使用文档 (含后端集成指南)
- `docs/PLAN.md` — 本文档
