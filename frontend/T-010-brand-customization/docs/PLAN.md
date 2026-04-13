# PRJ-LITE999-T-010 品牌定制化配置系统 — 工作计划

## 任务概述

构建可配置的品牌系统，支持 Logo / 色彩主题 / 文案的动态替换，实现产品白标化能力。

## 依赖分析

- **PRJ-LITE999-T-003**（项目基础架构）：本任务假设基础技术栈为 **Vue 3 + TypeScript + Vite**
- 品牌系统作为独立模块设计，可无缝集成至任何 Vue 3 项目

## 架构设计

```
┌─────────────────────────────────────────────────┐
│                  应用层 (App)                     │
│  使用 useBrand() / <BrandLogo> / <BrandText>     │
├─────────────────────────────────────────────────┤
│              品牌上下文层 (Context)                │
│  BrandProvider → provide/inject 响应式品牌配置    │
├─────────────────────────────────────────────────┤
│              品牌引擎层 (Engine)                   │
│  配置合并 → CSS 变量注入 → 资源解析 → 文案查找    │
├─────────────────────────────────────────────────┤
│              配置层 (Config)                       │
│  默认配置 ← 静态覆盖 ← 远程配置 ← 运行时覆盖     │
└─────────────────────────────────────────────────┘
```

## 核心能力

### 1. 色彩主题系统
- CSS 自定义属性（CSS Variables）驱动
- 支持亮色/暗色主题切换
- 语义化 Token（primary, secondary, success, danger...）
- 自动生成色阶（50-950）
- 运行时动态切换

### 2. Logo 资源管理
- 多形态 Logo：full / icon / text / dark / light
- 支持 SVG 内联 / URL / Base64
- 响应式尺寸适配
- 加载状态与 fallback

### 3. 文案国际化
- 品牌名称、slogan、法律声明等
- 嵌套 key 路径访问（`brand.footer.copyright`）
- 支持模板变量插值（`{year}`, `{brandName}`）
- 运行时文案覆盖

### 4. 配置加载策略
- 多层配置合并（默认 → 静态 → 远程 → 运行时）
- 远程配置异步加载 + 缓存
- 配置校验（Zod schema）
- 配置变更事件通知

## 产出清单

| 文件 | 说明 |
|------|------|
| `src/types/brand.ts` | 品牌配置类型定义 |
| `src/brand/default-config.ts` | 默认品牌配置 |
| `src/brand/brand-engine.ts` | 品牌引擎核心逻辑 |
| `src/brand/color-utils.ts` | 色彩工具（色阶生成等） |
| `src/brand/text-resolver.ts` | 文案解析器 |
| `src/brand/config-loader.ts` | 配置加载器（合并/远程/缓存）|
| `src/brand/brand-provider.ts` | Vue 3 Provider 组件 |
| `src/hooks/use-brand.ts` | 组合式 API Hook |
| `src/hooks/use-brand-color.ts` | 色彩专用 Hook |
| `src/hooks/use-brand-text.ts` | 文案专用 Hook |
| `src/components/BrandLogo.vue` | Logo 组件 |
| `src/components/BrandText.vue` | 品牌文案组件 |
| `src/components/BrandColorPreview.vue` | 色彩预览组件 |
| `config/brand.default.json` | 默认品牌 JSON 配置 |
| `config/brand.example.json` | 示例品牌配置（白标） |
| `tests/brand-engine.test.ts` | 引擎单元测试 |
| `tests/color-utils.test.ts` | 色彩工具测试 |
| `tests/text-resolver.test.ts` | 文案解析器测试 |
| `docs/USAGE.md` | 使用文档 |

## 技术选型

- **Vue 3** Composition API + provide/inject
- **TypeScript** 严格类型
- **CSS Custom Properties** 运行时主题切换
- **Zod** 配置校验（可选依赖）
- **Vitest** 单元测试

## 开发计划

1. 类型定义与默认配置
2. 色彩工具函数
3. 文案解析器
4. 品牌引擎核心
5. 配置加载器
6. Vue Provider + Hooks
7. UI 组件
8. 测试与文档
