# PRJ-LITE999-T-012 API 文档站开发 — 工作计划

## 任务概述

构建交互式 API 文档站，覆盖两套接口体系：
1. **原生透传 (Passthrough)** — 兼容 OpenAI Chat Completions 格式，透传至后端各 LLM Provider
2. **标准接口 (Platform)** — Lite999 平台自有接口（Key 管理、用量查询、路由配置等）

文档站需支持在线 Playground（所见即所发）、多语言代码示例、实时请求/响应预览。

## 依赖

| 依赖 | 说明 |
|------|------|
| **T-005** (API 接口设计) | 接口定义数据来自此任务；本任务以 TypeScript 数据结构模拟 |

## 功能分解

### 1. 双模式文档
- **Passthrough 模式**: `/v1/chat/completions`, `/v1/embeddings`, `/v1/models` 等 OpenAI 兼容端点
- **Platform 模式**: `/api/keys`, `/api/usage`, `/api/routes`, `/api/models` 等平台管理端点
- 左侧导航双 Tab 切换

### 2. 端点参考页 (Endpoint Reference)
- 方法徽章 (GET/POST/PUT/DELETE)
- 路径 + 描述
- 请求参数表（路径参数、Query、Body），含类型、必填、默认值、说明
- 响应结构（成功 + 错误）
- 认证方式说明

### 3. 交互式 Playground
- 可编辑的请求 Body (JSON Editor)
- Header 配置 (Authorization)
- 发送请求 → 实时展示响应
- 请求耗时、状态码、响应大小
- cURL 命令一键复制
- 流式响应 (SSE) 实时渲染

### 4. 多语言代码示例
- cURL / Python / Node.js / Go
- 代码高亮 + 一键复制
- 参数自动填充（基于 Playground 输入）

### 5. 导航与搜索
- 左侧树形导航（分组 + 端点列表）
- 全文搜索（端点名/路径/描述/参数名）
- 面包屑

## 架构

```
┌──────────────────────────────────────────────┐
│  ApiDocsPage (主布局)                         │
├──────────┬───────────────────────────────────┤
│ Sidebar  │  Content Area                      │
│ ─────── │  ┌─────────────────────────────┐   │
│ Mode Tab │  │ EndpointHeader              │   │
│ Search   │  │ Method + Path + Description │   │
│ NavTree  │  ├─────────────────────────────┤   │
│          │  │ Authentication              │   │
│          │  ├─────────────────────────────┤   │
│          │  │ ParameterTable              │   │
│          │  ├─────────────────────────────┤   │
│          │  │ ResponseSchema              │   │
│          │  ├─────────────────────────────┤   │
│          │  │ CodeExamples                │   │
│          │  ├─────────────────────────────┤   │
│          │  │ Playground                  │   │
│          │  └─────────────────────────────┘   │
└──────────┴───────────────────────────────────┘
```

## 产出清单

### 数据层 (Types + Data)
| 文件 | 说明 |
|------|------|
| `src/types/api-docs.ts` | 文档数据类型（端点、参数、响应、分组） |
| `src/data/passthrough-endpoints.ts` | 原生透传端点定义 |
| `src/data/platform-endpoints.ts` | 平台标准接口端点定义 |
| `src/data/error-codes.ts` | 统一错误码表 |

### 工具
| 文件 | 说明 |
|------|------|
| `src/utils/code-generator.ts` | 多语言代码示例生成器 |
| `src/utils/curl-builder.ts` | cURL 命令构建器 |
| `src/utils/search.ts` | 端点全文搜索 |

### Composables
| 文件 | 说明 |
|------|------|
| `src/composables/use-api-docs.ts` | 文档主 Hook（模式切换、端点选择、搜索） |
| `src/composables/use-playground.ts` | Playground 状态管理（请求/响应/流式） |

### 组件
| 文件 | 说明 |
|------|------|
| `src/components/common/MethodBadge.vue` | HTTP 方法徽章 |
| `src/components/common/CopyButton.vue` | 一键复制按钮 |
| `src/components/common/CodeBlock.vue` | 代码高亮块 |
| `src/components/common/JsonEditor.vue` | JSON 编辑器 |
| `src/components/reference/EndpointHeader.vue` | 端点头部 |
| `src/components/reference/ParameterTable.vue` | 参数表 |
| `src/components/reference/ResponseSchema.vue` | 响应结构展示 |
| `src/components/reference/CodeExamples.vue` | 多语言代码示例 |
| `src/components/reference/AuthSection.vue` | 认证说明 |
| `src/components/playground/PlaygroundPanel.vue` | Playground 面板 |
| `src/components/playground/RequestEditor.vue` | 请求编辑器 |
| `src/components/playground/ResponseViewer.vue` | 响应查看器 |
| `src/components/navigation/DocsSidebar.vue` | 侧边栏 |
| `src/components/navigation/SearchBox.vue` | 搜索框 |
| `src/components/navigation/NavTree.vue` | 导航树 |

### 页面
| 文件 | 说明 |
|------|------|
| `src/pages/ApiDocsPage.vue` | 文档站主页 |
| `src/pages/EndpointPage.vue` | 单端点详情页 |

### 配置 & 文档 & 测试
| 文件 | 说明 |
|------|------|
| `config/api-docs.default.ts` | 文档站默认配置 |
| `docs/USAGE.md` | 使用文档 |
| `tests/code-generator.test.ts` | 代码生成器测试 |
| `tests/search.test.ts` | 搜索测试 |
| `tests/curl-builder.test.ts` | cURL 构建器测试 |

## 技术选型

- **Vue 3** `<script setup>` + Composition API
- **TypeScript** 严格类型
- **CSS Custom Properties** 品牌系统集成 (T-010)
- **Shiki / Prism** 代码高亮（按需，可降级纯 CSS）
- **Fetch API + ReadableStream** 流式响应
- **Vitest** 单元测试
