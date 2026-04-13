# 部署清单 — PRJ-LITE999-T-007 用量仪表盘前端组件开发

> **任务:** PRJ-LITE999-T-007 — 用量仪表盘前端组件开发
> **日期:** 2026-04-10
> **状态:** 已验证

---

## 一、功能概述

用量仪表盘是 New-API 控制台的核心数据可视化模块——整合配额消耗、模型调用、用户排行、服务可用性等多维度数据，通过 VChart 图表引擎呈现。

```
Dashboard 架构
│
├── 页面入口: src/pages/Dashboard/index.jsx (29L)
│   └── 组件容器: src/components/dashboard/index.jsx (286L)
│
├── 组件层 (1,050L + 103L modals)
│   ├── DashboardHeader — 问候语 + 搜索 + 刷新
│   ├── StatsCards — 统计卡片 (4 列网格 + 迷你趋势图)
│   ├── ChartsPanel — 图表面板 (6 个 Tab: 分布/趋势/排行)
│   ├── ApiInfoPanel — API 信息卡片
│   ├── AnnouncementsPanel — 系统公告
│   ├── FaqPanel — 常见问答
│   ├── UptimePanel — 服务可用性 (Uptime Kuma)
│   └── modals/SearchModal — 高级搜索
│
├── Hooks 层 (1,071L)
│   ├── useDashboardData — 数据管理 (346L)
│   │   └── API: /api/data/, /api/data/self/, /api/data/users, /api/uptime/status
│   ├── useDashboardCharts — 图表配置 (572L)
│   │   └── 6 种图表规格: pie/line/model_line/rank_bar/user_rank/user_trend
│   └── useDashboardStats — 统计计算 (153L)
│
├── Helpers (444L)
│   └── src/helpers/dashboard.jsx
│       └── 数据处理/聚合/图表生成/Uptime 状态映射
│
├── Constants
│   └── src/constants/dashboard.constants.js
│       └── 图表配置/时间选项/UI 常量
│
└── 用量日志 (独立页面)
    ├── src/pages/Log/index.jsx (29L)
    └── src/hooks/usage-logs/useUsageLogsData.jsx (895L)
        └── API: /api/log/, /api/log/stat, /api/log/self/stat
```

---

## 二、组件清单

### 2.1 Dashboard 组件

| 组件 | 文件 | 行数 | 功能 |
|------|------|------|------|
| Dashboard (主) | `components/dashboard/index.jsx` | 286 | 组装所有面板 + 数据流编排 |
| DashboardHeader | `components/dashboard/DashboardHeader.jsx` | 61 | 时段问候语 + 搜索按钮 + 刷新 |
| StatsCards | `components/dashboard/StatsCards.jsx` | 116 | 4 列统计卡片 + VChart 迷你趋势 |
| ChartsPanel | `components/dashboard/ChartsPanel.jsx` | 95 | 6 Tab 图表: 消耗分布/调用趋势/次数分布/排行/用户排行/用户趋势 |
| ApiInfoPanel | `components/dashboard/ApiInfoPanel.jsx` | 126 | API 地址 + 复制 + 速度测试 |
| AnnouncementsPanel | `components/dashboard/AnnouncementsPanel.jsx` | 126 | 公告列表 + 时间轴 |
| FaqPanel | `components/dashboard/FaqPanel.jsx` | 88 | FAQ 折叠面板 |
| UptimePanel | `components/dashboard/UptimePanel.jsx` | 152 | Uptime Kuma 集成 + 状态指示器 |
| SearchModal | `components/dashboard/modals/SearchModal.jsx` | 103 | 高级筛选: 用户/模型/时间/渠道 |

### 2.2 Hooks

| Hook | 行数 | 职责 |
|------|------|------|
| `useDashboardData` | 346 | 状态管理 + API 调用 + 数据加载 |
| `useDashboardCharts` | 572 | 6 种 VChart 图表规格生成 + Semi 主题适配 |
| `useDashboardStats` | 153 | 统计卡片数据计算 + 趋势分析 |
| `useUsageLogsData` | 895 | 用量日志表格: 分页/筛选/导出 |

### 2.3 图表类型

| 图表 | Tab | 类型 | 数据源 |
|------|-----|------|--------|
| 消耗分布 | 1 | Pie (饼图) | `/api/data/` 按模型聚合 |
| 调用趋势 | 2 | Line (折线图) | `/api/data/` 按时间聚合 |
| 调用次数分布 | 3 | Line (模型折线) | `/api/data/` 按模型×时间 |
| 调用次数排行 | 4 | Bar (横向柱图) | `/api/data/` 排序 |
| 用户排行 | 5 (Admin) | Bar (横向柱图) | `/api/data/users` |
| 用户趋势 | 6 (Admin) | Line (折线图) | `/api/data/users` 时间序列 |

---

## 三、后端 API 依赖

| API | 权限 | Dashboard 用途 |
|-----|------|----------------|
| `GET /api/data/` | Admin | 全量 QuotaData (管理员看板) |
| `GET /api/data/self/` | User | 个人 QuotaData (用户看板) |
| `GET /api/data/users` | Admin | 按用户聚合数据 (用户排行) |
| `GET /api/uptime/status` | 公开 | Uptime Kuma 服务状态 |
| `GET /api/log/stat` | Admin | 日志统计 (全局) |
| `GET /api/log/self/stat` | User | 日志统计 (个人) |
| `GET /api/log/` | Admin | 日志列表 (分页) |
| `GET /api/log/self/` | User | 个人日志列表 |
| `GET /api/status` | 公开 | 面板开关/公告/FAQ/API Info |

**依赖的后端任务:**
- T-006 (增强用量统计数据模型) — `/api/data/` 和 `/api/log/` 数据
- T-008 (多服务商健康检查) — `/api/uptime/status` 数据
- T-010 (品牌定制化) — 面板开关配置

---

## 四、技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| VChart | ~1.8.8 | 图表引擎 |
| @visactor/react-vchart | ~1.8.8 | React 集成 |
| @visactor/vchart-semi-theme | ~1.8.8 | Semi Design 主题适配 |
| Semi UI | ^2.69 | 组件: Card/Tabs/Avatar/Skeleton/Tag |
| Lucide React | ^0.511 | 图表图标 |
| dayjs | ^1.11 | 时间处理 |

---

## 五、部署特点

T-007 是**纯前端组件**，通过 `go:embed web/dist` 嵌入 Go 二进制——与后端一体化交付，无需独立部署。

### 配置项 (通过 T-010 系统选项控制)

| 选项 | 影响 |
|------|------|
| `console_setting.api_info_enabled` | ApiInfoPanel 显隐 |
| `console_setting.announcements_enabled` | AnnouncementsPanel 显隐 |
| `console_setting.faq_enabled` | FaqPanel 显隐 |
| `console_setting.uptime_kuma_enabled` | UptimePanel 显隐 |
| `DataExportEnabled` | 数据看板功能总开关 |
| `DataExportDefaultTime` | 默认聚合粒度 (hour/day/week) |

---

## 六、部署前检查

- [ ] 后端 T-006 已部署 (数据看板 API 可用)
- [ ] `DataExportEnabled = true`
- [ ] 至少有消费记录 (否则图表为空)
- [ ] 如需 Uptime: `console_setting.uptime_kuma_enabled = true` + 配置 uptime_kuma_groups
- [ ] 如需 API Info: `console_setting.api_info_enabled = true` + 配置 api_info
- [ ] 如需公告: `console_setting.announcements_enabled = true` + 配置 announcements

---

## 七、部署后验证矩阵

| # | 验证项 | 方法 | 预期 | 通过 |
|---|--------|------|------|------|
| 1 | Dashboard 页面加载 | 访问 /console | 看板渲染，无白屏 | [ ] |
| 2 | 问候语显示 | DashboardHeader | 根据时段显示早/午/晚 | [ ] |
| 3 | 统计卡片 | StatsCards | 显示余额/用量/调用次数 + 迷你趋势 | [ ] |
| 4 | 消耗分布饼图 | Tab 1 | VChart 饼图渲染 | [ ] |
| 5 | 调用趋势折线图 | Tab 2 | VChart 折线图渲染 | [ ] |
| 6 | 调用次数分布 | Tab 3 | 多模型折线图 | [ ] |
| 7 | 调用次数排行 | Tab 4 | 横向柱状图 | [ ] |
| 8 | 用户排行 (Admin) | Tab 5 | 管理员可见 | [ ] |
| 9 | 用户趋势 (Admin) | Tab 6 | 管理员可见 | [ ] |
| 10 | 高级搜索 | 点击搜索按钮 | Modal 弹出 + 筛选生效 | [ ] |
| 11 | 时间粒度切换 | hour/day/week | 图表数据重新聚合 | [ ] |
| 12 | API Info 面板 | 如启用 | API 地址 + 复制 + 测速 | [ ] |
| 13 | Uptime 面板 | 如启用 | 服务状态指示器 | [ ] |
| 14 | 深色主题 | 切换 Dark 模式 | VChart Semi 主题适配 | [ ] |
| 15 | 用量日志页 | /console/log | 表格分页 + 筛选 | [ ] |
| 16 | 用户自助看板 | 普通用户登录 | 仅显示个人数据 | [ ] |

---

## 八、回滚方案

前端嵌入 Go 二进制，回滚即回退镜像版本：

```bash
cd /opt/new-api
docker compose pull ghcr.io/${REPO_OWNER}/new-api:<previous-tag>
docker compose up -d
```

如需临时隐藏看板面板（不回退版本）：

```bash
# 关闭数据看板
curl -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"key":"DataExportEnabled","value":"false"}'
```

---

## 九、代码量统计

| 类别 | 文件数 | 行数 |
|------|--------|------|
| Dashboard 组件 | 9 | 1,153 |
| Dashboard Hooks | 3 | 1,071 |
| Dashboard Helpers | 1 | 444 |
| Dashboard Constants | 1 | ~120 |
| Usage Logs Hook | 1 | 895 |
| **合计** | **15** | **~3,683** |

---

## 十、执行记录 (2026-04-10)

### 代码验证结果

| 维度 | 结果 |
|------|------|
| Dashboard 组件 (9 个) | ✅ 1,153 行 |
| Dashboard Hooks (3 个) | ✅ 1,071 行 |
| VChart 图表 (6 种) | ✅ pie/line/model_line/rank_bar/user_rank/user_trend |
| Semi 主题适配 | ✅ `initVChartSemiTheme` |
| API 集成 (4 端点) | ✅ /api/data/ + /api/data/self/ + /api/data/users + /api/uptime/status |
| 面板开关 (6 个) | ✅ API Info/公告/FAQ/Uptime/DataExport/聚合粒度 |
| 管理员/用户双视角 | ✅ Admin 6 Tab, User 4 Tab |
| 用量日志 (895 行) | ✅ 分页/筛选/统计/导出 |
| 响应式 (4 列 → 2 列 → 1 列) | ✅ Tailwind grid breakpoints |
| 深色主题 | ✅ VChart Semi 主题自动适配 |

---

*清单编制: ops-prjlite999 | 日期: 2026-04-10*
