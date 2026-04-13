# 部署清单 — PRJ-LITE999-T-012 API 文档站开发

> **任务:** PRJ-LITE999-T-012 — API 文档站开发
> **日期:** 2026-04-11
> **状态:** 已验证

---

## 一、功能概述

API 文档站由三大模块构成：OpenAPI 规范文件（机器可读 API 定义）、Playground 交互式调试（在线调用 API）、内置运维/渠道文档。

```
API 文档站架构
│
├── OpenAPI 规范 (docs/openapi/)
│   ├── api.json (7,817L / 164KB) — 后台管理接口: 131 路径, 17 Tags
│   └── relay.json (7,242L / 170KB) — AI 模型接口: 35 路径, 18 Tags
│
├── Playground 交互式调试 (/console/playground)
│   ├── 页面入口: src/pages/Playground/index.jsx (565L)
│   ├── 组件层: 16 个组件 (3,533L)
│   │   ├── ChatArea — Semi Chat 对话 UI
│   │   ├── SettingsPanel — 模型/参数/分组选择
│   │   ├── ParameterControl — temperature/top_p/max_tokens 等
│   │   ├── DebugPanel — 请求/响应预览
│   │   ├── CodeViewer — 代码高亮 (401L)
│   │   ├── SSEViewer — SSE 流式响应查看器 (314L)
│   │   ├── MessageContent — 消息渲染 + Markdown (373L)
│   │   ├── ThinkingContent — <think> 推理内容展示 (180L)
│   │   ├── ConfigManager — 配置导入/导出 (281L)
│   │   ├── CustomRequestEditor — 自定义请求体编辑 (217L)
│   │   ├── ImageUrlInput — 图片 URL 输入 (142L)
│   │   ├── FloatingButtons — 浮动操作按钮 (86L)
│   │   ├── MessageActions — 消息操作 (152L)
│   │   ├── CustomInputRender — 自定义输入渲染 (155L)
│   │   ├── OptimizedComponents — 性能优化封装 (97L)
│   │   └── configStorage — 配置持久化 (234L)
│   ├── Hooks 层: 6 个 (1,523L)
│   │   ├── useApiRequest — API 调用 + SSE 流 (518L)
│   │   ├── usePlaygroundState — 状态管理 (313L)
│   │   ├── useMessageActions — 消息操作 (291L)
│   │   ├── useMessageEdit — 消息编辑 (157L)
│   │   ├── useSyncMessageAndCustomBody — 同步 (149L)
│   │   └── useDataLoader — 数据加载 (95L)
│   ├── Context: PlaygroundContext (60L)
│   └── Constants: playground.constants.js (131L)
│
├── Swagger 注解 (Go 控制器)
│   └── controller/swag_video.go (136L) — @Tags Video 注解
│
└── 内置运维文档 (docs/)
    ├── channel/other_setting.md — 渠道额外设置 (JSON 配置)
    ├── installation/BT.md — 宝塔面板部署教程
    ├── translation-glossary.md — 翻译术语表 (中/英/法/俄)
    └── ionet-client.md — io.net 客户端
```

---

## 二、OpenAPI 规范文件

### 2.1 api.json — 后台管理接口

| 维度 | 值 |
|------|-----|
| Title | 后台管理接口 |
| Version | 1.0.0 |
| 路径数 | 131 |
| Tag 数 | 17 |

**Tags:**
OAuth, 两步验证, 令牌管理, 任务, 供应商, 充值, 兑换码, 分组, 安全验证, 数据统计, 日志, 模型管理, 渠道管理, 用户登陆注册, 用户管理, 系统, 系统设置

**重点路径 (示例):**
```
/api/channel/ [GET POST PUT]     — 渠道 CRUD
/api/token/ [GET POST PUT]       — 令牌管理
/api/user/ [GET POST PUT]        — 用户管理
/api/log/ [GET]                  — 日志查询
/api/data/ [GET]                 — 数据统计
/api/option/ [GET PUT]           — 系统设置
```

### 2.2 relay.json — AI 模型接口

| 维度 | 值 |
|------|-----|
| Title | AI模型接口 |
| Version | 1.0.0 |
| 路径数 | 35 |
| Tag 数 | 18 |

**Tags:**
Claude格式(Messages), Gemini格式, Moderations, OpenAI格式(Chat), OpenAI格式(Embeddings), OpenAI格式(Responses), OpenAI音频(Audio), Realtime, 图片生成/Qwen千问, 文本补全(Completions), 未实现/Files, 未实现/Fine-tunes, 获取模型列表, 视频生成, 视频生成/Kling格式, 视频生成/Sora兼容格式, 视频生成/即梦格式, 重排序(Rerank)

**重点路径 (示例):**
```
/v1/chat/completions [POST]      — OpenAI Chat
/v1/messages [POST]              — Claude Messages
/v1/embeddings [POST]            — Embeddings
/v1/audio/speech [POST]          — TTS
/v1/images/generations [POST]    — 图片生成
/v1/video/generations [POST]     — 视频生成
/v1/rerank [POST]                — 重排序
```

---

## 三、Playground 交互式调试

### 3.1 功能矩阵

| 功能 | 实现 |
|------|------|
| 对话式 API 调用 | Semi Chat + SSE 流式 |
| 模型选择 | 从 /api/user/models 动态加载 |
| 分组选择 | 从 /api/user/self/groups 加载 |
| 参数调整 | temperature/top_p/max_tokens/frequency_penalty/presence_penalty/seed |
| 流式输出 | SSE + 实时 token 渲染 |
| 推理内容 | `<think>` 标签解析 + 折叠展示 |
| 图片输入 | 多图 URL + 粘贴上传 |
| 调试面板 | 请求预览 / 响应查看 / 代码生成 |
| 配置管理 | 导入/导出 JSON + localStorage 持久化 |
| 自定义请求 | 直接编辑请求体 JSON |
| 消息操作 | 复制/重新生成/编辑/删除 |

### 3.2 后端路由

```
POST /pg/chat/completions
  ├── middleware: RouteTag("relay") → SystemPerformanceCheck → UserAuth → Distribute
  └── handler: controller.Playground
      └── 复用 Relay 链路 (RelayInfo → Channel 选择 → Adaptor 转发)
```

### 3.3 技术栈

| 技术 | 用途 |
|------|------|
| @douyinfe/semi-ui Chat | 对话 UI 组件 |
| react-markdown | Markdown 渲染 |
| rehype-highlight | 代码高亮 |
| marked | HTML 渲染 |
| EventSource (SSE) | 流式响应 |

---

## 四、代码量统计

| 模块 | 文件数 | 行数 |
|------|--------|------|
| OpenAPI Spec | 2 | 15,059 |
| Playground 页面 | 1 | 565 |
| Playground 组件 | 16 | 3,533 |
| Playground Hooks | 6 | 1,523 |
| Playground Context | 1 | 60 |
| Playground Constants | 1 | 131 |
| Swagger 注解 | 1 | 136 |
| 运维文档 | 5 | ~1,200 |
| **合计** | **33** | **~22,207** |

---

## 五、部署特点

- **OpenAPI Spec:** 静态 JSON 文件，随仓库发布，可被第三方工具 (Postman/Insomnia/Swagger UI) 导入
- **Playground:** 前端组件嵌入 Go 二进制，一体化交付
- **后端 /pg/:** 复用 Relay 完整链路，无需额外部署
- **无独立文档站:** 文档以 OpenAPI JSON + 内置 Playground + 仓库 Markdown 形式存在

---

## 六、部署前检查

- [ ] 至少有 1 个已启用渠道 + 模型 (Playground 需要)
- [ ] 至少有 1 个用户 Token / API Key (Playground 鉴权)
- [ ] OpenAPI spec 文件存在: `docs/openapi/api.json` + `relay.json`
- [ ] 如需外部文档渲染: 可将 spec 导入 Swagger UI / Redoc / Postman

---

## 七、部署后验证矩阵

| # | 验证项 | 方法 | 预期 | 通过 |
|---|--------|------|------|------|
| 1 | Playground 页面加载 | /console/playground | 对话界面渲染 | [ ] |
| 2 | 模型列表加载 | SettingsPanel 下拉 | 显示可用模型 | [ ] |
| 3 | 分组列表加载 | SettingsPanel 下拉 | 显示用户分组 | [ ] |
| 4 | 发送消息 | 输入 "Hello" + 发送 | 模型回复 (SSE 流) | [ ] |
| 5 | 流式输出 | 观察响应 | token 逐字渲染 | [ ] |
| 6 | 参数调整 | 修改 temperature | 生效 (调试面板可见) | [ ] |
| 7 | 调试面板 | 点击"显示调试" | 请求/响应 JSON 查看 | [ ] |
| 8 | 代码查看器 | CodeViewer | 代码高亮显示 | [ ] |
| 9 | 配置导入/导出 | ConfigManager | JSON 导出 + 重新导入 | [ ] |
| 10 | 自定义请求 | 切换自定义模式 | 直接编辑 JSON 请求体 | [ ] |
| 11 | 消息操作 | 复制/重新生成/删除 | 各操作生效 | [ ] |
| 12 | 图片输入 | 启用 + 输入 URL | 图片随消息发送 | [ ] |
| 13 | 推理内容 | 使用支持 thinking 的模型 | `<think>` 折叠展示 | [ ] |
| 14 | OpenAPI api.json | 读取 docs/openapi/api.json | 131 路径, 17 Tags | [ ] |
| 15 | OpenAPI relay.json | 读取 docs/openapi/relay.json | 35 路径, 18 Tags | [ ] |
| 16 | 深色主题 | 切换 Dark 模式 | Playground 适配 | [ ] |
| 17 | 移动端 | 窄屏访问 | 响应式布局 | [ ] |

---

## 八、回滚方案

Playground 嵌入 Go 二进制，回滚即回退镜像版本。

Playground 路由可通过注释后端路由禁用 (需重新构建):
```go
// router/relay-router.go:62-67
// playgroundRouter := router.Group("/pg")
```

---

## 九、执行记录 (2026-04-11)

### 代码验证结果

| 维度 | 结果 |
|------|------|
| OpenAPI api.json (131 路径) | ✅ 7,817 行, 17 Tags |
| OpenAPI relay.json (35 路径) | ✅ 7,242 行, 18 Tags |
| Playground 页面 (565L) | ✅ ChatArea + Settings + Debug |
| Playground 组件 (16 个, 3,533L) | ✅ Chat/Code/SSE/Config/Custom |
| Playground Hooks (6 个, 1,523L) | ✅ API/State/Message/Edit/Sync/Loader |
| 后端 /pg/chat/completions | ✅ 复用 Relay 链路 |
| Swagger 注解 (swag_video.go) | ✅ 136 行, @Tags Video |
| 运维文档 (5 个) | ✅ 渠道设置/宝塔部署/翻译术语 |
| Semi Chat 集成 | ✅ 对话式 UI + SSE |
| 配置持久化 | ✅ localStorage + JSON 导入导出 |
| 图片输入 + 推理展示 | ✅ 多图 URL + `<think>` 折叠 |

---

*清单编制: ops-prjlite999 | 日期: 2026-04-11*
