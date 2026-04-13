# 部署清单 — PRJ-LITE999-T-005 厂商 API 适配器开发

> **任务:** PRJ-LITE999-T-005 — 厂商 API 适配器开发
> **日期:** 2026-04-10
> **状态:** 已验证

---

## 一、功能概述

适配器层是 New-API 的核心中间件——将 37 家厂商的私有 API 协议统一转换为 OpenAI 兼容格式，实现"一个入口，多厂商透传"。

```
客户端 (OpenAI SDK)
  │
  ▼
统一入口 (/v1/chat/completions, /v1/images/generations, ...)
  │
  ▼
ChannelType → APIType 映射 (common/api_type.go)
  │
  ▼
GetAdaptor(apiType) → 具体适配器 (relay/relay_adaptor.go)
  │
  ▼
┌─────────────────────────────────────────────┐
│              Adaptor 接口 (15 方法)          │
│                                             │
│  Init → GetRequestURL → SetupRequestHeader  │
│  → ConvertXxxRequest → DoRequest → DoResponse│
│                                             │
│  支持: OpenAI / Claude / Gemini 三种入口格式  │
│  支持: Chat / Image / Audio / Embed / Rerank │
│        / Responses / Realtime               │
└─────────────────────────────────────────────┘
  │
  ▼
厂商私有 API (Anthropic Claude API, Google Gemini API, AWS Bedrock, ...)
```

### 适配器体系概览

| 类别 | 数量 | 说明 |
|------|------|------|
| Chat Adaptor | 36 个目录 | 标准 Adaptor 接口 |
| Task Adaptor | 11 个目录 | 异步任务 (视频/音乐生成) |
| APIType | 34 种 | 协议类型 |
| ChannelType | 40+ 种 | 渠道类型 (含 OpenAI 兼容复用) |
| EndpointType | 9 种 | 入口协议格式 |
| 适配器总代码量 | 24,871 行 | relay/channel/ 目录 |

---

## 二、适配器清单

### 2.1 Chat Adaptor (36 个)

| 适配器 | 代码量 | 厂商 | 协议特点 |
|--------|--------|------|----------|
| openai | 2,622L | OpenAI / 兼容 | 基准协议，8 文件 |
| gemini | 2,475L | Google | 独立协议 + SSE + 多模态 |
| claude | 1,753L | Anthropic | Messages API + SSE |
| volcengine | 1,259L | 火山引擎 | Doubao + 视频 |
| ollama | 1,046L | 本地推理 | 自有协议转换 |
| ali | 991L | 阿里通义 | DashScope + 任务 |
| aws | 884L | AWS Bedrock | SigV4 签名 + 流 |
| minimax | 751L | MiniMax | 自有 + 语音 |
| coze | 545L | Coze | Bot API |
| replicate | 562L | Replicate | Prediction API |
| baidu | 518L | 百度文心 | 独立 Token 鉴权 |
| xunfei | 468L | 讯飞星火 | WebSocket 协议 |
| dify | 469L | Dify | Workflow API |
| cohere | 423L | Cohere | Command + Rerank |
| tencent | 438L | 腾讯混元 | TC3 签名 |
| jimeng | 419L | 即梦 | 图片生成 |
| zhipu | 405L | 智谱 GLM | JWT 鉴权 |
| zhipu_4v | 388L | 智谱 (v4 视觉) | 视觉模型 |
| vertex | 684L | Google Vertex AI | ServiceAccount + OAuth |
| cloudflare | 344L | Cloudflare Workers AI | Account ID 路由 |
| xai | 305L | xAI (Grok) | OpenAI 兼容 + 定制 |
| palm | 276L | Google PaLM | 旧版 API |
| siliconflow | 258L | SiliconFlow | OpenAI 兼容 + 扩展 |
| codex | 248L | OpenAI Codex | Responses API |
| mokaai | 205L | MokaAI | OpenAI 兼容 |
| mistral | 189L | Mistral | OpenAI 兼容 + 差异 |
| baidu_v2 | 159L | 百度 V2 | 新版 API |
| perplexity | 138L | Perplexity | OpenAI 兼容 + 搜索 |
| moonshot | 130L | Moonshot (Kimi) | Claude 兼容 |
| deepseek | 119L | DeepSeek | OpenAI 兼容 + 缓存 |
| jina | 109L | Jina | Rerank + Embed |
| submodel | 103L | 子模型 | 内部路由 |
| openrouter | 22L | OpenRouter | OpenAI 复用 |
| xinference | 19L | Xinference | OpenAI 复用 |
| ai360 | 14L | 360 智脑 | OpenAI 复用 |
| lingyiwanwu | 9L | 零一万物 | OpenAI 复用 |

### 2.2 Task Adaptor (11 个)

| 适配器 | 代码量 | 用途 |
|--------|--------|------|
| task/gemini | 601L | Gemini 视频/图片生成 |
| task/ali | 546L | 通义万相 |
| task/hailuo | 524L | 海螺视频 (MiniMax) |
| task/jimeng | 480L | 即梦图片 |
| task/kling | 416L | 可灵视频 |
| task/vertex | 424L | Vertex AI Imagen |
| task/doubao | 393L | 豆包视频 |
| task/sora | 339L | OpenAI Sora |
| task/vidu | 300L | Vidu 视频 |
| task/suno | 174L | Suno 音乐 |
| task/taskcommon | 97L | 公共工具 |

---

## 三、核心代码路径

### 3.1 适配器工厂

| 文件 | 函数 | 职责 |
|------|------|------|
| `common/api_type.go` | `ChannelType2APIType()` | ChannelType → APIType 映射 (40+ 到 34) |
| `relay/relay_adaptor.go` | `GetAdaptor()` | APIType → Adaptor 实例化 |
| `relay/relay_adaptor.go` | `GetTaskAdaptor()` | Platform → TaskAdaptor 实例化 |

### 3.2 Adaptor 接口 (15 方法)

| 方法 | 调用链路 | 说明 |
|------|----------|------|
| `Init` | 每次请求 | 初始化适配器状态 |
| `GetRequestURL` | 转发前 | 构建厂商 API URL |
| `SetupRequestHeader` | 转发前 | 设置鉴权头 (API Key / JWT / SigV4 / OAuth) |
| `ConvertOpenAIRequest` | OpenAI 入口 | 转换 Chat 请求 |
| `ConvertClaudeRequest` | Claude 入口 | 转换 Claude 请求 |
| `ConvertGeminiRequest` | Gemini 入口 | 转换 Gemini 请求 |
| `ConvertImageRequest` | 图片入口 | 转换图片生成请求 |
| `ConvertAudioRequest` | 音频入口 | 转换 TTS/STT 请求 |
| `ConvertEmbeddingRequest` | 向量入口 | 转换 Embedding 请求 |
| `ConvertRerankRequest` | 重排入口 | 转换 Rerank 请求 |
| `ConvertOpenAIResponsesRequest` | Responses 入口 | 转换 Responses API 请求 |
| `DoRequest` | 执行 | 发送 HTTP 请求到厂商 |
| `DoResponse` | 响应 | 解析厂商响应 + 流式处理 |
| `GetModelList` | 管理 | 返回支持的模型列表 |
| `GetChannelName` | 管理 | 返回渠道名称 |

### 3.3 参数覆盖系统

| 文件 | 功能 |
|------|------|
| `relay/common/override.go` | 参数覆盖引擎: set/delete/move/copy/prepend/append/replace/regex_replace 等 20+ 操作 |
| | 条件匹配: full/prefix/suffix/contains/gt/gte/lt/lte + 反选 |
| | Header 操作: set_header/delete_header/copy_header/move_header/pass_headers |
| `model/channel.go` | `ModelMapping` — 模型名映射 |
| | `ParamOverride` — 请求参数覆盖 |
| | `HeaderOverride` — 请求头覆盖 |

---

## 四、部署配置项

### 4.1 渠道配置 (管理后台 → 渠道管理)

| 字段 | 说明 | 适配器影响 |
|------|------|------------|
| `type` | 渠道类型 (ChannelType) | 决定使用哪个适配器 |
| `base_url` | 厂商 API 地址 | 适配器拼接路由 |
| `key` | API Key / Access Token | 适配器设置鉴权头 |
| `models` | 支持的模型列表 | 渠道选择依据 |
| `model_mapping` | 模型名映射 (JSON) | 请求前替换模型名 |
| `param_override` | 参数覆盖 (JSON) | 请求体改写 |
| `header_override` | 请求头覆盖 (JSON) | 自定义 Header |
| `group` | 所属分组 | Fallback/限流 |
| `priority` | 优先级 | Fallback 顺序 |
| `weight` | 权重 | 同优先级内选中概率 |
| `tag` | 标签 | 批量管理 |

### 4.2 特殊厂商配置

| 厂商 | 额外配置 | 说明 |
|------|----------|------|
| **AWS Bedrock** | `key` = `AK:SK:Region` | SigV4 签名需要 |
| **Vertex AI** | `key` = Service Account JSON | OAuth2 token 自动刷新 |
| **腾讯混元** | `key` = `SecretId:SecretKey` | TC3-HMAC-SHA256 签名 |
| **百度文心** | `key` = `API_KEY:SECRET_KEY` | 自动获取 access_token |
| **讯飞星火** | `key` = `APPID:APISecret:APIKey` | WebSocket + HMAC |
| **智谱 GLM** | `key` = API Key | 自动 JWT 签发 |
| **Coze** | `key` = Personal Access Token | Bot ID 在 model_mapping |

### 4.3 环境变量

适配器层无独立环境变量。所有配置通过渠道管理界面 (数据库持久化) 配置。

全局影响适配器的环境变量：

| 变量 | 默认 | 说明 |
|------|------|------|
| `RELAY_TIMEOUT` | `60` | 非流式请求超时 (秒) |
| `STREAMING_TIMEOUT` | `120` | 流式请求超时 (秒) |
| `TLS_INSECURE_SKIP_VERIFY` | `false` | 跳过 TLS 证书验证 |

---

## 五、部署前检查

- [ ] 目标厂商 API Key 已获取且有效
- [ ] 渠道 `base_url` 正确 (不同厂商格式不同)
- [ ] `model_mapping` 格式正确 (JSON: `{"display_name":"real_name"}`)
- [ ] 特殊厂商 Key 格式正确 (AWS: `AK:SK:Region`, Vertex: JSON, 等)
- [ ] Redis 可用 (渠道缓存)
- [ ] 网络可达 (服务器 → 各厂商 API 端点)
- [ ] 代理配置正确 (如需要)

---

## 六、部署执行

### Step 1: 部署新版本

```bash
cd /opt/new-api
docker compose pull && docker compose up -d --remove-orphans
timeout 90 bash -c 'until curl -sf http://localhost:3000/api/status | grep -q "success.*true"; do sleep 5; done'
```

### Step 2: 添加渠道

```bash
API_BASE="http://localhost:3000"
ADMIN_TOKEN="<admin-session-token>"

# 示例: 添加 OpenAI 渠道
curl -sf -X POST "$API_BASE/api/channel/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": 1,
    "name": "OpenAI-Primary",
    "key": "sk-xxx",
    "base_url": "https://api.openai.com",
    "models": "gpt-4o,gpt-4o-mini,gpt-4-turbo",
    "group": "default",
    "priority": 100,
    "weight": 5
  }'

# 示例: 添加 Claude 渠道
curl -sf -X POST "$API_BASE/api/channel/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": 14,
    "name": "Claude-Primary",
    "key": "sk-ant-xxx",
    "base_url": "https://api.anthropic.com",
    "models": "claude-sonnet-4-20250514,claude-3-5-haiku-20241022",
    "group": "default",
    "priority": 100,
    "weight": 5
  }'
```

### Step 3: 测试每个渠道

```bash
# 逐个测试渠道连通性
curl -sf "$API_BASE/api/channel/test" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 测试单个渠道
curl -sf "$API_BASE/api/channel/test/<channel_id>" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Step 4: 端到端验证

```bash
TOKEN="sk-your-api-key"

# Chat (OpenAI 格式)
curl -sf "$API_BASE/v1/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hello"}],"max_tokens":5}'

# Embedding
curl -sf "$API_BASE/v1/embeddings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"text-embedding-3-small","input":"hello"}'

# Image Generation
curl -sf "$API_BASE/v1/images/generations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"dall-e-3","prompt":"a cat","n":1,"size":"1024x1024"}'
```

---

## 七、部署后验证矩阵

| # | 验证项 | 方法 | 预期 | 通过 |
|---|--------|------|------|------|
| 1 | 应用启动正常 | `/api/status` | success:true | [ ] |
| 2 | 渠道列表可见 | `GET /api/channel/` | 返回渠道列表 | [ ] |
| 3 | 渠道测试通过 | `GET /api/channel/test` | 各渠道状态正常 | [ ] |
| 4 | Chat Completions | `POST /v1/chat/completions` | 200 + 正确响应 | [ ] |
| 5 | 流式 Chat | `stream: true` | SSE 事件流 | [ ] |
| 6 | Embedding | `POST /v1/embeddings` | 向量返回 | [ ] |
| 7 | Image Generation | `POST /v1/images/generations` | 图片 URL 返回 | [ ] |
| 8 | Claude 入口 | `POST /v1/messages` (Claude 格式) | 正确转换 | [ ] |
| 9 | Gemini 入口 | Gemini 格式请求 | 正确转换 | [ ] |
| 10 | Model Mapping | 配置映射后请求 | 模型名正确替换 | [ ] |
| 11 | Param Override | 配置覆盖后请求 | 参数正确改写 | [ ] |
| 12 | 错误处理 | 无效 Key 请求 | 返回标准错误格式 | [ ] |
| 13 | 特殊厂商鉴权 | AWS/Vertex/腾讯等 | 签名正确 | [ ] |
| 14 | Task 异步任务 | 视频/图片生成 | 任务创建 + 轮询成功 | [ ] |

---

## 八、回滚方案

### 渠道级回滚

适配器是代码内嵌的，不能单独回滚。但可以通过渠道管理实现等效回滚：

```bash
# 禁用问题渠道
curl -sf -X PUT "$API_BASE/api/channel/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": <channel_id>, "status": 2}'  # 2 = 手动禁用
```

### 应用级回滚

```bash
cd /opt/new-api
# 回退到上一版本
docker compose pull ghcr.io/${REPO_OWNER}/new-api:<previous-tag>
docker compose up -d
```

---

## 九、厂商适配器运维指南

### 9.1 常见问题排查

| 问题 | 排查 |
|------|------|
| 请求 401 | 检查 API Key 格式和有效性 |
| 请求 403 | 检查 Key 权限 / 配额 / IP 白名单 |
| 模型不存在 | 检查 `models` 字段和 `model_mapping` |
| 超时 | 调整 `STREAMING_TIMEOUT` / `RELAY_TIMEOUT` |
| 响应格式异常 | 检查适配器版本是否匹配厂商 API 版本 |
| 签名错误 | 检查特殊 Key 格式 (AWS: AK:SK:Region) |

### 9.2 新增厂商适配器

如需自定义适配器：

1. 在 `relay/channel/<vendor>/` 创建目录
2. 实现 `Adaptor` 接口 (15 方法)
3. 在 `constant/channel.go` 添加 `ChannelType`
4. 在 `constant/api_type.go` 添加 `APIType`
5. 在 `common/api_type.go` 添加映射
6. 在 `relay/relay_adaptor.go` 注册

### 9.3 OpenAI 兼容厂商

以下厂商复用 OpenAI 适配器，添加渠道时选择对应类型即可：

| 厂商 | ChannelType | 只需配置 base_url + key |
|------|-------------|------------------------|
| OpenRouter | 26 | ✓ |
| Xinference | 27 | ✓ |
| 360 智脑 | (OpenAI 兼容) | ✓ |
| 零一万物 | (OpenAI 兼容) | ✓ |
| SiliconFlow | (部分兼容) | ✓ + 扩展 |
| DeepSeek | (部分兼容) | ✓ + 缓存 Token |

---

## 十、执行记录 (2026-04-10)

### 代码验证结果

| 维度 | 结果 |
|------|------|
| Chat Adaptor | ✅ 36 个目录, 24,871 行 |
| Task Adaptor | ✅ 11 个目录 (视频/音乐生成) |
| Adaptor 接口方法 | ✅ 15 方法, 全部 32 适配器实现 |
| APIType 常量 | ✅ 34 种 (含 Dummy 哨兵) |
| ChannelType→APIType 映射 | ✅ 40+ 渠道类型覆盖 |
| 工厂函数 GetAdaptor | ✅ 34 分支 |
| 工厂函数 GetTaskAdaptor | ✅ 11 分支 |
| EndpointType | ✅ 9 种入口协议 |
| 参数覆盖系统 | ✅ 20+ 操作模式 |
| 模型映射 | ✅ ModelMapping 字段 |

---

*清单编制: ops-prjlite999 | 日期: 2026-04-10*
