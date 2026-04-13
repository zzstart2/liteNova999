# 部署清单 — PRJ-LITE999-T-003 UI/UX 设计系统规划

> **任务:** PRJ-LITE999-T-003 — UI/UX 设计系统规划
> **日期:** 2026-04-10
> **状态:** 已验证

---

## 一、设计系统概述

New-API 前端设计系统基于 **Semi Design + Tailwind CSS** 的混合架构，实现了主题化、响应式、国际化的完整 UI 体系。

```
设计系统架构
│
├── UI 框架: @douyinfe/semi-ui (字节 Semi Design)
│   ├── 组件库: Button/Table/Form/Modal/Navigation/...
│   └── 设计变量: --semi-color-* / --semi-border-radius-*
│
├── 样式系统: Tailwind CSS
│   ├── 颜色: 100+ Semi CSS 变量映射
│   ├── 圆角: 6 级 Semi 圆角映射
│   └── 层级: tailwind-base → semi → tailwind-components → tailwind-utils
│
├── 主题系统: ThemeProvider
│   ├── 三模式: light / dark / auto (跟随系统)
│   └── 持久化: localStorage('theme-mode')
│
├── 国际化: i18next + react-i18next
│   └── 7 种语言: zh-CN / zh-TW / en / fr / ru / ja / vi
│
├── 图标: Semi Icons + Lucide React + @lobehub/icons + React Icons
│
├── 数据可视化: VChart (字节 VisActor)
│   └── Semi 主题适配: @visactor/vchart-semi-theme
│
└── 构建: Vite + Bun
    ├── 代码分割: react-core / semi-ui / tools / i18n / react-components
    └── 嵌入 Go 二进制: go:embed web/dist
```

### 前端规模

| 维度 | 数量 |
|------|------|
| 总文件数 | 386 |
| JSX 组件 | 330 文件, 94,700 行 |
| JS 工具 | 54 文件, 7,036 行 |
| CSS | 2 文件, 1,457 行 (含 1,008 行全局样式) |
| 组件 (src/components) | 246 文件 |
| 页面 (src/pages) | 64 文件, 24 路由 |
| Hooks (src/hooks) | 36 文件, 14 领域 |
| i18n 键 | ~3,500 键 × 7 语言 |
| 构建产物 | 嵌入 Go 二进制 |

---

## 二、设计系统组成

### 2.1 Tailwind × Semi 色彩系统

`tailwind.config.js` 将 100+ Semi CSS 变量映射为 Tailwind 工具类：

| 类别 | 变量示例 | 用途 |
|------|----------|------|
| 主色 | `semi-color-primary` / `-hover` / `-active` / `-disabled` | 主操作色 |
| 次级色 | `semi-color-secondary-*` | 次要操作 |
| 三级色 | `semi-color-tertiary-*` | 辅助元素 |
| 语义色 | `semi-color-success/danger/warning/info-*` | 状态反馈 |
| 文本 | `semi-color-text-0/1/2/3` | 4 级文本层次 |
| 背景 | `semi-color-bg-0/1/2/3/4` | 5 级背景层次 |
| 填充 | `semi-color-fill-0/1/2` | 3 级填充 |
| 边框 | `semi-color-border` | 边框色 |
| 链接 | `semi-color-link-*` | 链接状态 |
| 数据 | `semi-color-data-0` ~ `data-19` | 图表 20 色 |
| 圆角 | `semi-border-radius-extra-small` ~ `full` | 6 级圆角 |

### 2.2 主题系统 (ThemeProvider)

| 特性 | 实现 |
|------|------|
| 三模式 | `light` / `dark` / `auto` (跟随系统偏好) |
| 系统检测 | `prefers-color-scheme` MediaQuery 监听 |
| 持久化 | `localStorage('theme-mode')` |
| DOM 应用 | `body[theme-mode=dark]` + `html.dark` |
| Context | `useTheme()` / `useActualTheme()` / `useSetTheme()` |

### 2.3 布局系统

| 组件 | 文件 | 职责 |
|------|------|------|
| `PageLayout` | `components/layout/PageLayout.jsx` | 主布局 (Header + Sider + Content) |
| `SiderBar` | `components/layout/SiderBar.jsx` | 侧边栏导航 |
| `headerbar/` | `components/layout/headerbar/` | 顶部导航栏 |
| `Footer` | `components/layout/Footer.jsx` | 页脚 |
| `NoticeModal` | `components/layout/NoticeModal.jsx` | 公告弹窗 |
| `SetupCheck` | `components/layout/SetupCheck.js` | 初始化检查 |

CSS 变量控制侧边栏宽度：
```css
--sidebar-width: 180px;
--sidebar-width-collapsed: 60px;
```

### 2.4 组件分层

```
src/components/
├── auth/          → 登录/注册/OAuth 组件
├── common/        → 通用: Markdown / 表单 / 对话框
├── dashboard/     → 控制台: API Info / 公告 / FAQ / Uptime
├── layout/        → 布局: Header / Sider / Footer / Page
├── model-deployments/ → 模型部署
├── playground/    → API 调试
├── settings/      → 系统设置
├── setup/         → 初始化引导
├── table/         → 表格封装
└── topup/         → 充值
```

### 2.5 国际化 (i18n)

| 语言 | 文件 | 翻译键数 |
|------|------|----------|
| 简体中文 | `zh-CN.json` | 2,989 |
| 繁体中文 | `zh-TW.json` | 3,123 |
| 英文 | `en.json` | 3,503 |
| 法文 | `fr.json` | 3,459 |
| 俄文 | `ru.json` | 3,473 |
| 日文 | `ja.json` | 3,440 |
| 越南文 | `vi.json` | 4,008 |

i18n 工具链：`i18next-cli` (extract / status / sync / lint)

### 2.6 构建配置

| 配置 | 说明 |
|------|------|
| 构建工具 | Vite + Bun |
| 代码分割 | 5 chunks: react-core / semi-ui / tools / i18n / react-components |
| 路径别名 | `@` → `./src` |
| Semi 集成 | `@douyinfe/vite-plugin-semi` (CSS Layer 模式) |
| CSS 层级 | `tailwind-base → semi → tailwind-components → tailwind-utils` |
| 代码检查 | ESLint (React hooks + AGPL header) + Prettier |
| 开发代理 | `/api` → `localhost:3000` |

---

## 三、部署特点

T-003 是**纯前端设计系统**。前端代码通过 `go:embed web/dist` 嵌入 Go 二进制，部署新版本即自动包含最新 UI。

**无需独立部署前端**——与后端一体化交付。

### 3.1 构建流程 (Dockerfile 中已集成)

```dockerfile
# Stage 1: 前端构建
FROM oven/bun:1 AS builder
WORKDIR /web
COPY web/package.json web/bun.lock ./
RUN bun install
COPY web/ .
RUN bun run build

# Stage 2: Go 构建
FROM golang:1.26.1-alpine AS builder2
COPY --from=builder /web/dist ./web/dist
# go:embed 嵌入 web/dist
RUN go build ...
```

---

## 四、部署配置项

### 4.1 运行时品牌定制 (通过 T-010 系统选项)

| 选项 | 影响的 UI |
|------|----------|
| `SystemName` | 导航栏标题、页面 title |
| `Logo` | 导航栏 Logo 图片 |
| `Footer` | 页脚 HTML |
| `HomePageContent` | 首页内容 |
| `DefaultCollapseSidebar` | 侧边栏默认折叠 |
| `HeaderNavModules` | 顶部导航模块 |
| `SidebarModulesAdmin` | 管理员侧边栏模块 |

### 4.2 环境变量 (构建时)

| 变量 | 说明 |
|------|------|
| `FRONTEND_BASE_URL` | 前端分离部署时的 URL (Slave 节点可配) |
| `GOOGLE_ANALYTICS_ID` | Google Analytics (GA4) |
| `UMAMI_WEBSITE_ID` | Umami 自建统计 |
| `UMAMI_SCRIPT_URL` | Umami 脚本 URL |

---

## 五、部署前检查

- [ ] 前端构建产物已嵌入 Docker 镜像 (Dockerfile multi-stage)
- [ ] Semi Design 主题变量生效 (light + dark)
- [ ] Tailwind CSS 工具类正常 (通过 Semi 变量)
- [ ] i18n 语言文件完整 (7 种语言)
- [ ] 静态资源就绪 (logo.png / favicon.ico)
- [ ] 品牌选项已通过 T-010 配置

---

## 六、部署后验证矩阵

| # | 验证项 | 方法 | 预期 | 通过 |
|---|--------|------|------|------|
| 1 | 页面可访问 | 浏览器打开首页 | 正常加载，无白屏 | [ ] |
| 2 | 浅色主题 | 切换 Light 模式 | 背景浅色，文字深色 | [ ] |
| 3 | 深色主题 | 切换 Dark 模式 | 背景深色，文字浅色 | [ ] |
| 4 | Auto 主题 | 设为 Auto + 切换系统偏好 | 跟随系统 | [ ] |
| 5 | 品牌显示 | 导航栏 | SystemName + Logo 正确 | [ ] |
| 6 | 侧边栏折叠 | 点击折叠按钮 | 宽度 180px → 60px | [ ] |
| 7 | 移动端响应 | 窄屏访问 | 布局自适应 | [ ] |
| 8 | 中文显示 | 切换到 zh-CN | 全站中文 | [ ] |
| 9 | 英文显示 | 切换到 en | 全站英文 | [ ] |
| 10 | 登录页 | 访问 /console | 登录表单 + OAuth 按钮 | [ ] |
| 11 | 数据看板 | 进入 Dashboard | VChart 图表正常渲染 | [ ] |
| 12 | 静态资源缓存 | 检查 Cache-Control | JS/CSS 带 hash，可长缓存 | [ ] |
| 13 | 页脚显示 | 页面底部 | 自定义 Footer HTML | [ ] |
| 14 | 路由正常 | 访问 24 个页面路由 | 无 404 / 白屏 | [ ] |

---

## 七、回滚方案

前端嵌入 Go 二进制，回滚即回退镜像版本：

```bash
cd /opt/new-api
# 回退到上一版本
docker compose pull ghcr.io/${REPO_OWNER}/new-api:<previous-tag>
docker compose up -d
```

---

## 八、设计系统维护指南

### 8.1 新增颜色/变量

1. Semi Design 变量通过主题包自动提供
2. 需要在 Tailwind 中使用：编辑 `tailwind.config.js` 添加映射
3. 直接使用 CSS 变量：`var(--semi-color-xxx)` 无需额外配置

### 8.2 新增语言

1. 在 `i18next.config.js` 的 `locales` 数组添加语言码
2. 运行 `bun run i18n:extract` 生成新语言文件
3. 翻译 `src/i18n/locales/<lang>.json`
4. 后端同步：`i18n/locales/<lang>.yaml`

### 8.3 组件规范

| 规范 | 要求 |
|------|------|
| UI 组件 | 优先使用 Semi Design 组件 |
| 样式 | Tailwind 工具类 > 内联样式 > CSS 文件 |
| 颜色 | 只用 Semi 变量映射的 Tailwind 类 |
| 图标 | Semi Icons / Lucide / LobeHub Icons |
| 文件头 | AGPL-3.0 版权声明 (ESLint 强制) |
| 格式化 | Prettier (自动) |

---

## 九、执行记录 (2026-04-10)

### 代码验证结果

| 维度 | 结果 |
|------|------|
| UI 框架 (Semi Design) | ✅ v2.69+ |
| Tailwind × Semi 映射 | ✅ 100+ 颜色 + 6 圆角 |
| CSS 层级 (4 层) | ✅ base → semi → components → utils |
| ThemeProvider (3 模式) | ✅ light/dark/auto + localStorage |
| 布局组件 (6 个) | ✅ 1,320 行 |
| 组件 (246 文件) | ✅ 8 领域 |
| 页面 (64 文件, 24 路由) | ✅ |
| Hooks (36 文件, 14 领域) | ✅ |
| i18n (7 语言, ~3,500 键) | ✅ |
| 构建分割 (5 chunks) | ✅ |
| ESLint + Prettier | ✅ AGPL header 强制 |
| Vite + Bun | ✅ 开发代理 + HMR |
| 全局样式 (1,008 行) | ✅ |
| 嵌入 Go 二进制 | ✅ go:embed web/dist |

---

*清单编制: ops-prjlite999 | 日期: 2026-04-10*
