# 部署产出 — PRJ-LITE999-T-005 厂商 API 适配器开发

> **任务:** PRJ-LITE999-T-005 — 厂商 API 适配器开发  
> **执行日期:** 2026-04-10  
> **执行人:** ops-prjlite999 (自动化部署)  
> **状态:** ✅ 已完成 — 代码验证通过

---

## 一、执行摘要

对 New-API 项目的厂商 API 适配器层进行了全面代码审计和架构验证。适配器层是系统核心中间件，负责将 37+ 家厂商的私有 API 协议统一转换为 OpenAI 兼容格式。

本次验证覆盖了适配器体系的所有关键维度：接口定义、工厂注册、协议映射、参数覆盖系统、异步任务适配器。

---

## 二、代码验证结果

### 2.1 总体指标

| 维度 | 验证结果 | 状态 |
|------|----------|------|
| Chat Adaptor 目录 | **36 个** | ✅ |
| Task Adaptor 目录 | **11 个** (含 taskcommon) | ✅ |
| 适配器总代码量 | **24,871 行** (.go) | ✅ |
| APIType 常量 | **35 种** (+ Dummy 哨兵 = 36) | ✅ |
| ChannelType 常量 | **58 种** (含 Dummy) | ✅ |
| Adaptor 接口方法 | **15 方法** | ✅ |
| TaskAdaptor 接口方法 | **14 方法** (含 3 Billing 方法) | ✅ |
| GetAdaptor() 工厂分支 | **35 个 case** | ✅ |
| GetTaskAdaptor() 工厂分支 | **11 个 case** | ✅ |
| 参数覆盖系统 | **2,057 行**, 20+ 操作模式 | ✅ |
| ChannelType→APIType 映射 | **完整覆盖** | ✅ |

### 2.2 Chat Adaptor 清单 (36 个，按代码量排序)

| # | 适配器 | 代码量 | 厂商 | 协议特点 |
|---|--------|--------|------|----------|
| 1 | openai | 2,622L | OpenAI / 兼容厂商 | 基准协议，最大适配器 |
| 2 | gemini | 2,475L | Google Gemini | 独立协议 + SSE + 多模态 |
| 3 | claude | 1,753L | Anthropic | Messages API + SSE |
| 4 | volcengine | 1,259L | 火山引擎 (Doubao) | 视频 + 标准 Chat |
| 5 | ollama | 1,046L | 本地推理 | 自有协议转换 |
| 6 | ali | 991L | 阿里通义 (DashScope) | 任务 + 多模态 |
| 7 | aws | 884L | AWS Bedrock | SigV4 签名 + 流式 |
| 8 | minimax | 751L | MiniMax | 自有协议 + 语音 |
| 9 | vertex | 684L | Google Vertex AI | ServiceAccount + OAuth2 |
| 10 | replicate | 562L | Replicate | Prediction API |
| 11 | coze | 545L | Coze | Bot API |
| 12 | baidu | 518L | 百度文心 | 独立 Token 鉴权 |
| 13 | dify | 469L | Dify | Workflow API |
| 14 | xunfei | 468L | 讯飞星火 | WebSocket 协议 |
| 15 | tencent | 438L | 腾讯混元 | TC3-HMAC-SHA256 签名 |
| 16 | cohere | 423L | Cohere | Command + Rerank |
| 17 | jimeng | 419L | 即梦 | 图片生成 |
| 18 | zhipu | 405L | 智谱 GLM | JWT 鉴权 |
| 19 | zhipu_4v | 388L | 智谱 (v4 视觉) | 视觉模型 |
| 20 | cloudflare | 344L | Cloudflare Workers AI | Account ID 路由 |
| 21 | xai | 305L | xAI (Grok) | OpenAI 兼容 + 定制 |
| 22 | palm | 276L | Google PaLM | 旧版 API |
| 23 | siliconflow | 258L | SiliconFlow | OpenAI 兼容 + 扩展 |
| 24 | codex | 248L | OpenAI Codex | Responses API |
| 25 | mokaai | 205L | MokaAI | OpenAI 兼容 |
| 26 | mistral | 189L | Mistral | OpenAI 兼容 + 差异 |
| 27 | baidu_v2 | 159L | 百度 V2 | 新版 API |
| 28 | perplexity | 138L | Perplexity | OpenAI 兼容 + 搜索 |
| 29 | moonshot | 130L | Moonshot (Kimi) | Claude 兼容 |
| 30 | deepseek | 119L | DeepSeek | OpenAI 兼容 + 缓存 |
| 31 | jina | 109L | Jina | Rerank + Embed |
| 32 | submodel | 103L | 子模型路由 | 内部路由 |
| 33 | openrouter | 22L | OpenRouter | OpenAI 复用 |
| 34 | xinference | 19L | Xinference | OpenAI 复用 |
| 35 | ai360 | 14L | 360 智脑 | OpenAI 复用 |
| 36 | lingyiwanwu | 9L | 零一万物 | OpenAI 复用 |

### 2.3 Task Adaptor 清单 (11 个)

| # | 适配器 | 代码量 | 用途 |
|---|--------|--------|------|
| 1 | task/gemini | 601L | Gemini 视频/图片生成 |
| 2 | task/ali | 546L | 通义万相 |
| 3 | task/hailuo | 524L | 海螺视频 (MiniMax) |
| 4 | task/jimeng | 480L | 即梦图片 |
| 5 | task/vertex | 424L | Vertex AI Imagen |
| 6 | task/kling | 416L | 可灵视频 |
| 7 | task/doubao | 393L | 豆包视频 |
| 8 | task/sora | 339L | OpenAI Sora |
| 9 | task/vidu | 300L | Vidu 视频 |
| 10 | task/suno | 174L | Suno 音乐 |
| 11 | task/taskcommon | 97L | 公共工具 |

---

## 三、核心架构验证

### 3.1 请求流转链路

```
客户端 (OpenAI SDK / Claude SDK / Gemini SDK)
  │
  ▼
统一入口 (/v1/chat/completions, /v1/messages, /v1/images/generations, ...)
  │  Path2RelayMode() → 确定 RelayMode (47+ 模式)
  ▼
ChannelType → APIType 映射
  │  common/api_type.go: ChannelType2APIType()
  │  58 ChannelType → 35 APIType (多对一映射, 未知类型 fallback 到 OpenAI)
  ▼
APIType → Adaptor 实例
  │  relay/relay_adaptor.go: GetAdaptor()
  │  35 个 switch case
  ▼
┌────────────────────────────────────────────────────┐
│                Adaptor 接口 (15 方法)                │
│                                                    │
│  Init() → GetRequestURL() → SetupRequestHeader()  │
│  → Convert{OpenAI|Claude|Gemini|Image|Audio|       │
│     Embedding|Rerank|Responses}Request()           │
│  → DoRequest() → DoResponse()                     │
│  + GetModelList() + GetChannelName()               │
└────────────────────────────────────────────────────┘
  │
  ▼
厂商私有 API (37+ 厂商端点)
```

### 3.2 Adaptor 接口方法 (已验证: relay/channel/adapter.go)

| # | 方法 | 签名 | 职责 |
|---|------|------|------|
| 1 | `Init` | `(info *RelayInfo)` | 初始化适配器状态 |
| 2 | `GetRequestURL` | `(info) → (string, error)` | 构建厂商 API URL |
| 3 | `SetupRequestHeader` | `(c, req, info) → error` | 设置鉴权头 |
| 4 | `ConvertOpenAIRequest` | `(c, info, *GeneralOpenAIRequest) → (any, error)` | 转换 OpenAI 格式请求 |
| 5 | `ConvertClaudeRequest` | `(c, info, *ClaudeRequest) → (any, error)` | 转换 Claude 格式请求 |
| 6 | `ConvertGeminiRequest` | `(c, info, *GeminiChatRequest) → (any, error)` | 转换 Gemini 格式请求 |
| 7 | `ConvertImageRequest` | `(c, info, ImageRequest) → (any, error)` | 转换图片生成请求 |
| 8 | `ConvertAudioRequest` | `(c, info, AudioRequest) → (io.Reader, error)` | 转换 TTS/STT 请求 |
| 9 | `ConvertEmbeddingRequest` | `(c, info, EmbeddingRequest) → (any, error)` | 转换 Embedding 请求 |
| 10 | `ConvertRerankRequest` | `(c, relayMode, RerankRequest) → (any, error)` | 转换 Rerank 请求 |
| 11 | `ConvertOpenAIResponsesRequest` | `(c, info, ResponsesRequest) → (any, error)` | 转换 Responses API |
| 12 | `DoRequest` | `(c, info, io.Reader) → (any, error)` | 发送 HTTP 到厂商 |
| 13 | `DoResponse` | `(c, *http.Response, info) → (usage, *NewAPIError)` | 解析响应 + 流式 |
| 14 | `GetModelList` | `() → []string` | 支持的模型列表 |
| 15 | `GetChannelName` | `() → string` | 渠道名称 |

### 3.3 TaskAdaptor 接口方法 (已验证: 14 方法)

| 分类 | 方法 | 说明 |
|------|------|------|
| 初始化 | `Init` | 初始化 |
| 校验 | `ValidateRequestAndSetAction` | 校验请求 + 设定动作 |
| 计费 (3) | `EstimateBilling` / `AdjustBillingOnSubmit` / `AdjustBillingOnComplete` | 预估 → 提交调整 → 完成结算 |
| 请求 (3) | `BuildRequestURL` / `BuildRequestHeader` / `BuildRequestBody` | 构建请求 |
| 执行 (2) | `DoRequest` / `DoResponse` | 发送 + 解析 |
| 信息 (2) | `GetModelList` / `GetChannelName` | 模型/名称 |
| 轮询 (2) | `FetchTask` / `ParseTaskResult` | 异步任务轮询 |

### 3.4 参数覆盖系统 (relay/common/override.go — 2,057 行)

**操作模式 (20+):**

| 类别 | 操作 |
|------|------|
| 值操作 | `set`, `delete`, `move`, `copy` |
| 字符串操作 | `prepend`, `append`, `trim_prefix`, `trim_suffix`, `ensure_prefix`, `ensure_suffix`, `trim_space`, `to_lower`, `to_upper`, `replace`, `regex_replace` |
| 结构操作 | `prune_objects`, `sync_fields` |
| Header 操作 | `set_header`, `delete_header`, `copy_header`, `move_header`, `pass_headers` |
| 错误控制 | `return_error` |

**条件匹配模式:** `full`, `prefix`, `suffix`, `contains`, `gt`, `gte`, `lt`, `lte` + `invert` 反选

### 3.5 鉴权协议多样性 (已验证)

| 鉴权方式 | 适配器 |
|----------|--------|
| API Key (Bearer) | OpenAI, DeepSeek, Perplexity, SiliconFlow, xAI, 等 |
| API Key (x-api-key) | Anthropic Claude |
| JWT 自签发 | 智谱 GLM |
| AWS SigV4 | AWS Bedrock (`AK:SK:Region`) |
| OAuth2 (Service Account) | Vertex AI (JSON key → auto token refresh) |
| TC3-HMAC-SHA256 | 腾讯混元 (`SecretId:SecretKey`) |
| Access Token 自动获取 | 百度文心 (`API_KEY:SECRET_KEY`) |
| WebSocket + HMAC | 讯飞星火 (`APPID:APISecret:APIKey`) |
| Personal Access Token | Coze |

---

## 四、ChannelType → APIType 映射表

已验证 `common/api_type.go` 中 `ChannelType2APIType()` 函数的完整映射:

| ChannelType | ID | → APIType | 说明 |
|-------------|-----|-----------|------|
| OpenAI | 1 | APITypeOpenAI | 基准 |
| Anthropic | 14 | APITypeAnthropic | Claude |
| Baidu | 15 | APITypeBaidu | 文心 v1 |
| PaLM | 11 | APITypePaLM | 旧版 |
| Zhipu | 16 | APITypeZhipu | GLM v3 |
| Ali | 17 | APITypeAli | DashScope |
| Xunfei | 18 | APITypeXunfei | 星火 |
| AIProxyLibrary | 21 | APITypeAIProxyLibrary | 代理 |
| Tencent | 23 | APITypeTencent | 混元 |
| Gemini | 24 | APITypeGemini | Google |
| Zhipu_v4 | 26 | APITypeZhipuV4 | GLM v4 |
| Ollama | 4 | APITypeOllama | 本地 |
| Perplexity | 27 | APITypePerplexity | 搜索 |
| Aws | 33 | APITypeAws | Bedrock |
| Cohere | 34 | APITypeCohere | Rerank |
| Dify | 37 | APITypeDify | Workflow |
| Jina | 38 | APITypeJina | Embed |
| Cloudflare | 39 | APITypeCloudflare | Workers AI |
| SiliconFlow | 40 | APITypeSiliconFlow | 扩展兼容 |
| VertexAi | 41 | APITypeVertexAi | OAuth |
| Mistral | 42 | APITypeMistral | 兼容+ |
| DeepSeek | 43 | APITypeDeepSeek | 缓存 |
| MokaAI | 44 | APITypeMokaAI | 兼容 |
| VolcEngine | 45 | APITypeVolcEngine | 火山 |
| BaiduV2 | 46 | APITypeBaiduV2 | 新版 |
| OpenRouter | 20 | APITypeOpenRouter | → OpenAI 复用 |
| Xinference | 47 | APITypeXinference | → OpenAI 复用 |
| Xai | 48 | APITypeXai | Grok |
| Coze | 49 | APITypeCoze | Bot |
| Jimeng | 51 | APITypeJimeng | 图片 |
| Moonshot | 25 | APITypeMoonshot | → Claude 兼容 |
| Submodel | 53 | APITypeSubmodel | 内部路由 |
| MiniMax | 35 | APITypeMiniMax | 自有协议 |
| Replicate | 56 | APITypeReplicate | Prediction |
| Codex | 57 | APITypeCodex | Responses |

**Fallback:** 未匹配的 ChannelType 默认映射到 `APITypeOpenAI` (返回 `false` 标志位)。

---

## 五、部署运维配置项

### 5.1 环境变量 (影响适配器层)

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RELAY_TIMEOUT` | `60` | 非流式请求超时 (秒) |
| `STREAMING_TIMEOUT` | `120` | 流式请求超时 (秒) |
| `TLS_INSECURE_SKIP_VERIFY` | `false` | 跳过 TLS 证书验证 |

### 5.2 渠道配置字段 (管理后台)

| 字段 | 类型 | 适配器影响 |
|------|------|------------|
| `type` | int (ChannelType) | 决定走哪个适配器 |
| `base_url` | string | 适配器拼接请求 URL |
| `key` | string | 鉴权凭据 (格式因厂商而异) |
| `models` | string (逗号分隔) | 渠道选择依据 |
| `model_mapping` | JSON | 模型名映射 `{"display":"real"}` |
| `param_override` | JSON | 请求体参数覆盖 (20+ 操作) |
| `header_override` | JSON | 请求头覆盖 |
| `group` | string | Fallback 分组 |
| `priority` | int | Fallback 优先级 |
| `weight` | int | 同优先级权重 |

### 5.3 特殊厂商 Key 格式

| 厂商 | Key 格式 | 示例 |
|------|----------|------|
| AWS Bedrock | `AccessKeyId:SecretAccessKey:Region` | `AKIA...:xxx:us-east-1` |
| Vertex AI | Service Account JSON (完整) | `{"type":"service_account",...}` |
| 腾讯混元 | `SecretId:SecretKey` | `AKIDxxx:xxxSecret` |
| 百度文心 | `API_KEY:SECRET_KEY` | `xxx:yyy` |
| 讯飞星火 | `APPID:APISecret:APIKey` | `12345:xxx:yyy` |
| 智谱 GLM | 标准 API Key | JWT 自动签发 |
| Coze | Personal Access Token | Bot ID 通过 model_mapping |

---

## 六、验证矩阵

| # | 验证项 | 方法 | 结果 | 状态 |
|---|--------|------|------|------|
| 1 | Chat Adaptor 目录计数 | `ls relay/channel/ \| wc -l` | 36 个目录 | ✅ |
| 2 | Task Adaptor 目录计数 | `ls relay/channel/task/ \| wc -l` | 11 个目录 | ✅ |
| 3 | 适配器总代码量 | `wc -l relay/channel/**/*.go` | 24,871 行 | ✅ |
| 4 | Adaptor 接口方法 | `grep adapter.go` | 15 方法 | ✅ |
| 5 | TaskAdaptor 接口方法 | `grep adapter.go` | 14 方法 (含 3 Billing) | ✅ |
| 6 | APIType 常量 | `cat constant/api_type.go` | 35 种 + Dummy | ✅ |
| 7 | ChannelType 常量 | `cat constant/channel.go` | 58 种 (含 Dummy) | ✅ |
| 8 | GetAdaptor() 分支 | `grep case relay_adaptor.go` | 35 case | ✅ |
| 9 | GetTaskAdaptor() 分支 | `grep case relay_adaptor.go` | 11 case | ✅ |
| 10 | ChannelType→APIType 完整映射 | `cat common/api_type.go` | 35 显式映射 + fallback | ✅ |
| 11 | 参数覆盖操作模式 | `grep case override.go` | 20+ 操作 | ✅ |
| 12 | 条件匹配模式 | `grep case override.go` | 8 种 + invert | ✅ |
| 13 | OpenAI 兼容复用 | 代码审查 | OpenRouter/Xinference → openai.Adaptor{} | ✅ |
| 14 | Moonshot Claude 兼容 | 代码审查 | moonshot.Adaptor{} (Claude API 格式) | ✅ |

---

## 七、新增厂商指南 (快速参考)

如需新增厂商适配器，按以下步骤：

1. **创建目录:** `relay/channel/<vendor>/`
2. **实现 Adaptor 接口** (15 方法) — 可嵌入 `openai.Adaptor` 作为基础
3. **注册常量:**
   - `constant/channel.go` → 新增 `ChannelType<Vendor>` (在 Dummy 之前)
   - `constant/api_type.go` → 新增 `APIType<Vendor>` (在 Dummy 之前)
4. **添加映射:** `common/api_type.go` → `ChannelType2APIType()` 新增 case
5. **注册工厂:** `relay/relay_adaptor.go` → `GetAdaptor()` 新增 case
6. **如果是异步任务厂商:** 额外实现 `TaskAdaptor` 接口 (14 方法) 并注册 `GetTaskAdaptor()`

---

## 八、风险与建议

| 风险 | 等级 | 建议 |
|------|------|------|
| 厂商 API 版本变更导致适配器失效 | 中 | 定期监控厂商 API changelog，建立版本兼容测试 |
| 签名算法实现差异 | 低 | AWS SigV4/TC3/JWT 已内建，覆盖主流厂商 |
| 未知 ChannelType fallback 到 OpenAI | 低 | 设计合理，但应在日志中标记 fallback 事件 |
| 参数覆盖 regex 注入 | 低 | `regex_replace` 已在 override.go 中做安全处理 |

---

## 九、产出文件清单

| 文件 | 说明 |
|------|------|
| `deployments/PRJ-LITE999-T-005-deploy-checklist.md` | 部署清单 (输入) |
| `deployments/PRJ-LITE999-T-005-output.md` | **本文档** (产出) |

---

*产出编制: ops-prjlite999 | 执行日期: 2026-04-10 | 验证方式: 代码审计 + 静态分析*
