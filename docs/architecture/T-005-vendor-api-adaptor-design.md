# T-005 厂商 API 适配器开发 — 设计文档

> **任务**: PRJ-LITE999-T-005  
> **依赖**: T-004 (原生 API 透传路由设计)  
> **目标**: 千问/豆包/GLM/Kimi/MiniMax 原生 API 适配器能力评估与增强

---

## 1. 现状分析

### 1.1 五家厂商适配器已存在

所有五家厂商在 `relay/channel/` 下已有完整适配器实现：

| 厂商 | 目录 | ChannelType | APIType | 文件数 |
|------|------|-------------|---------|--------|
| **千问 (Qwen)** | `ali/` | 17 | `APITypeAli` | 8 |
| **豆包 (Doubao)** | `volcengine/` | 45 | `APITypeVolcEngine` | 4 |
| **GLM (智谱)** | `zhipu_4v/` | 26 | `APITypeZhipuV4` | 5 |
| **Kimi (月之暗面)** | `moonshot/` | 25 | `APITypeMoonshot` | 2 |
| **MiniMax** | `minimax/` | 35 | `APITypeMiniMax` | 6 |

### 1.2 各适配器能力矩阵

| 能力 | 千问 | 豆包 | GLM | Kimi | MiniMax |
|------|------|------|-----|------|---------|
| **Chat Completions** | ✅ 原生+OpenAI | ✅ OpenAI 兼容 | ✅ OpenAI 兼容 | ✅ OpenAI 兼容 | ✅ 原生格式 |
| **Claude Format** | ✅ 委托 claude.Adaptor | ✅ 委托 claude.Adaptor | ❌ | ✅ 委托 claude.Adaptor | ✅ 委托 claude.Adaptor |
| **Responses API** | ✅ 有路由 | ✅ 有路由 | ❌ | ❌ | ❌ |
| **Embedding** | ✅ 原生格式转换 | ✅ OpenAI 兼容 | ✅ OpenAI 兼容 | ✅ OpenAI 兼容 | ✅ OpenAI 兼容 |
| **Image Gen** | ✅ 万象/通义万相 | ✅ Seedream | ✅ 智谱图生 | ❌ | ✅ 原生格式 |
| **Rerank** | ✅ 原生格式 | ✅ OpenAI 兼容 | ❌ | ✅ OpenAI 兼容 | ❌ |
| **Audio/TTS** | ❌ | ✅ WebSocket 二进制 | ❌ | ❌ | ✅ 原生格式 |
| **原生 DTO** | ✅ AliChatRequest 等 | ✅ WebSocket 协议 | ✅ ZhipuV4Response | ❌ 纯 OpenAI | ✅ MiniMax 原生 |
| **Stream** | ✅ SSE | ✅ SSE | ✅ SSE | ✅ SSE | ✅ SSE |
| **PassThrough** | ✅ 支持 | ✅ 支持 | ✅ 支持 | ✅ 支持 | ✅ 支持 |
| **Model Mapping** | ✅ | ✅ | ✅ | ✅ | ✅ |

### 1.3 适配模式分析

| 厂商 | 适配方式 | 说明 |
|------|----------|------|
| **千问** | **原生格式转换** | 有独立 DTO (AliChatRequest)，OpenAI→原生→OpenAI 全链路 |
| **豆包** | **OpenAI 兼容层** | Chat 用 OpenAI 格式透传，TTS 用自有二进制 WebSocket 协议 |
| **GLM** | **OpenAI 兼容层** | 响应格式基本 OpenAI 兼容，有少量字段差异 |
| **Kimi** | **纯 OpenAI 兼容** | 请求/响应完全走 OpenAI 格式，最简单的适配器 |
| **MiniMax** | **原生格式转换** | Chat 用 MiniMax 原生 URL+格式，TTS/Image 各有原生协议 |

---

## 2. GAP 分析

### 2.1 与 T-004 原生透传的关系

T-004 设计了 `/v1/native/{provider}/*` 全链路透传路由。本任务需要确保各适配器既支持现有 OpenAI 兼容模式，也能与 T-004 原生透传协作。

| 场景 | 路径 | 适配器角色 |
|------|------|-----------|
| **OpenAI 兼容** | `/v1/chat/completions` | 请求转换 + 响应解析 (现有) |
| **原生透传** | `/v1/native/qwen/...` | 仅做认证注入，不转换 (T-004) |
| **混合模式** | `/v1/chat/completions` + PassThrough | 跳过请求转换，解析响应 (现有) |

### 2.2 各厂商增强需求

| 厂商 | 增强项 | 优先级 | 说明 |
|------|--------|--------|------|
| **千问** | | | |
| | Responses API 支持 | 🟡 中 | GetRequestURL 已有路由但缺 ConvertOpenAIResponsesRequest 实现 |
| | 文件上传/多模态增强 | 🟡 中 | 千问 VL 系列的图片处理需优化 |
| | 原生透传认证 | 🔴 高 | T-004 NativeAuthHeader 需配置为 `Authorization: Bearer` |
| **豆包** | | | |
| | Responses API 支持 | 🟡 中 | 同千问 |
| | TTS WebSocket 稳定性 | 🟡 中 | 二进制协议错误处理需加强 |
| | 图像编辑 (ImageEdits) | 🟢 低 | URL 路由已有但注释掉了 |
| | 原生透传认证 | 🔴 高 | 火山引擎使用 HMAC 签名认证 |
| **GLM** | | | |
| | Responses API 支持 | 🟡 中 | 完全缺失 |
| | Claude Format 支持 | 🟡 中 | 当前未实现 ConvertClaudeRequest |
| | Rerank 支持 | 🟢 低 | GLM 已有 rerank 模型但适配器未实现 |
| | 原生透传认证 | 🔴 高 | 使用 JWT Token (exp claim) |
| **Kimi** | | | |
| | Responses API 支持 | 🟡 中 | 缺失 ConvertOpenAIResponsesRequest |
| | Gemini Format 支持 | 🟢 低 | ConvertGeminiRequest 返回 not implemented |
| | 文件上传/长文本 | 🟡 中 | Kimi 特色功能，需原生 API 支持 |
| | 原生透传认证 | 🔴 高 | `Authorization: Bearer` 标准格式 |
| **MiniMax** | | | |
| | Responses API 支持 | 🟡 中 | 缺失 |
| | Embedding 原生格式 | 🟢 低 | 当前用 OpenAI 兼容，可优化 |
| | Rerank 支持 | 🟢 低 | MiniMax 有 rerank 能力但未适配 |
| | 原生透传认证 | 🔴 高 | `Authorization: Bearer` 标准格式 |

---

## 3. 设计方案

### 3.1 原生透传认证配置 (T-004 集成)

每个厂商需要在 T-004 的 NativeHelper 中正确注入认证信息。

```go
// relay/native_handler.go — 厂商认证注入

func injectNativeAuth(req *http.Request, info *relaycommon.RelayInfo) {
    // 优先使用渠道级自定义配置
    if info.ChannelSetting.NativeAuthHeader != "" {
        req.Header.Set(info.ChannelSetting.NativeAuthHeader, info.ApiKey)
        return
    }

    // 按厂商类型使用默认认证方式
    switch info.ChannelType {
    case constant.ChannelTypeAli:
        // 千问: 标准 Bearer Token
        req.Header.Set("Authorization", "Bearer "+info.ApiKey)

    case constant.ChannelTypeVolcEngine:
        // 豆包: HMAC 签名 (复杂场景需 volcengine SDK)
        // 简化模式: 火山引擎也支持 Bearer Token (Ark API)
        req.Header.Set("Authorization", "Bearer "+info.ApiKey)

    case constant.ChannelTypeZhipu_v4:
        // GLM: JWT Token (需 exp 签名)
        token, _ := generateZhipuJWT(info.ApiKey)
        req.Header.Set("Authorization", "Bearer "+token)

    case constant.ChannelTypeMoonshot:
        // Kimi: 标准 Bearer Token
        req.Header.Set("Authorization", "Bearer "+info.ApiKey)

    case constant.ChannelTypeMiniMax:
        // MiniMax: 标准 Bearer Token
        req.Header.Set("Authorization", "Bearer "+info.ApiKey)

    default:
        req.Header.Set("Authorization", "Bearer "+info.ApiKey)
    }
}
```

**GLM JWT 生成** (已有实现，复用):

```go
// relay/channel/zhipu_4v/dto.go 已有 tokenData + JWT 生成逻辑
// 需提取为公共函数供 NativeHelper 使用
```

### 3.2 Responses API 统一补齐

五家厂商中 Responses API 均未完全实现。方案：委托给 OpenAI Adaptor。

```go
// 通用实现模板 — 适用于所有 OpenAI 兼容厂商

func (a *Adaptor) ConvertOpenAIResponsesRequest(
    c *gin.Context,
    info *relaycommon.RelayInfo,
    request dto.OpenAIResponsesRequest,
) (any, error) {
    // 方案 A: 直接透传 (厂商支持 OpenAI Responses 格式)
    return &request, nil

    // 方案 B: 委托 OpenAI adaptor (厂商原生不支持但 OpenAI 兼容层支持)
    // adaptor := openai.Adaptor{}
    // return adaptor.ConvertOpenAIResponsesRequest(c, info, request)
}
```

### 3.3 各厂商具体增强

#### 3.3.1 千问 (Ali/Qwen)

**文件**: `relay/channel/ali/`

| 增强项 | 实现方式 |
|--------|----------|
| Responses API | ConvertOpenAIResponsesRequest 委托 openai.Adaptor |
| 多模态优化 | 增强 ConvertOpenAIRequest 中 VL 模型图片 URL 处理 |
| 原生透传 | Bearer Token，无需特殊处理 |
| 原生 URL 映射 | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` (OpenAI 兼容) |
| | `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation` (原生) |

#### 3.3.2 豆包 (VolcEngine/Doubao)

**文件**: `relay/channel/volcengine/`

| 增强项 | 实现方式 |
|--------|----------|
| Responses API | ConvertOpenAIResponsesRequest 委托 openai.Adaptor |
| TTS 错误处理 | 增强 WebSocket 二进制协议的 ErrorType 解析 |
| ImageEdits | 取消注释已有路由，实现 Seedream Edit 请求转换 |
| 原生透传 | Ark API 支持 Bearer Token |
| 原生 URL 映射 | `https://ark.cn-beijing.volces.com/api/v3/chat/completions` (OpenAI 兼容) |

#### 3.3.3 GLM (ZhipuV4)

**文件**: `relay/channel/zhipu_4v/`

| 增强项 | 实现方式 |
|--------|----------|
| Responses API | ConvertOpenAIResponsesRequest 委托 openai.Adaptor |
| Claude Format | ConvertClaudeRequest 委托 claude.Adaptor (同 Kimi 模式) |
| Rerank | 新增 ConvertRerankRequest (GLM rerank 模型用 OpenAI 兼容格式) |
| 原生透传 | JWT Token — 提取 `dto.go` 中的 JWT 生成为公共函数 |
| 原生 URL 映射 | `https://open.bigmodel.cn/api/paas/v4/chat/completions` (OpenAI 兼容) |

#### 3.3.4 Kimi (Moonshot)

**文件**: `relay/channel/moonshot/`

| 增强项 | 实现方式 |
|--------|----------|
| Responses API | ConvertOpenAIResponsesRequest 委托 openai.Adaptor |
| 文件上传 | 新增 `/v1/files` 路由支持，转发到 Kimi 原生文件 API |
| 长文本模式 | 支持 `kimi-*-128k` 模型的特殊 token 限制处理 |
| 原生透传 | Bearer Token，无需特殊处理 |
| 原生 URL 映射 | `https://api.moonshot.cn/v1/chat/completions` (已是 OpenAI 兼容) |

**注**: Kimi 是五家中最简单的适配器，因为其 API 完全 OpenAI 兼容。

#### 3.3.5 MiniMax

**文件**: `relay/channel/minimax/`

| 增强项 | 实现方式 |
|--------|----------|
| Responses API | ConvertOpenAIResponsesRequest 委托 openai.Adaptor |
| Rerank | 新增 ConvertRerankRequest |
| Embedding 优化 | 当前 OpenAI 兼容可保持，无需改为原生 |
| 原生透传 | Bearer Token，无需特殊处理 |
| 原生 URL 映射 | `https://api.minimax.chat/v1/text/chatcompletion_v2` (原生) |

---

## 4. 实现文件清单

### 4.1 公共变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `relay/native_handler.go` (T-004) | **修改** | 添加 injectNativeAuth 厂商认证分发 |
| `relay/channel/zhipu_4v/jwt.go` | **新增** | 提取 JWT 生成为公共函数 |

### 4.2 各厂商变更

| 厂商 | 文件 | 操作 | 说明 |
|------|------|------|------|
| **千问** | `ali/adaptor.go` | 修改 | 补齐 ConvertOpenAIResponsesRequest |
| **豆包** | `volcengine/adaptor.go` | 修改 | 补齐 ConvertOpenAIResponsesRequest, 解注释 ImageEdits |
| **GLM** | `zhipu_4v/adaptor.go` | 修改 | 补齐 ConvertOpenAIResponsesRequest + ConvertClaudeRequest |
| **GLM** | `zhipu_4v/rerank.go` | 新增 | ConvertRerankRequest 实现 |
| **Kimi** | `moonshot/adaptor.go` | 修改 | 补齐 ConvertOpenAIResponsesRequest |
| **MiniMax** | `minimax/adaptor.go` | 修改 | 补齐 ConvertOpenAIResponsesRequest |
| **MiniMax** | `minimax/rerank.go` | 新增 | ConvertRerankRequest 实现 |

---

## 5. 原生透传 URL 映射表

| 厂商 | 默认 BaseURL | OpenAI 兼容路径 | 原生路径 |
|------|-------------|----------------|----------|
| **千问** | `https://dashscope.aliyuncs.com` | `/compatible-mode/v1/chat/completions` | `/api/v1/services/aigc/text-generation/generation` |
| **豆包** | `https://ark.cn-beijing.volces.com` | `/api/v3/chat/completions` | `/api/v3/chat/completions` (同) |
| **GLM** | `https://open.bigmodel.cn` | `/api/paas/v4/chat/completions` | `/api/paas/v4/chat/completions` (同) |
| **Kimi** | `https://api.moonshot.cn` | `/v1/chat/completions` | `/v1/chat/completions` (同) |
| **MiniMax** | `https://api.minimax.chat` | N/A | `/v1/text/chatcompletion_v2` |

**注意**: 豆包/GLM/Kimi 的 API 本身就是 OpenAI 兼容格式，"原生"和"兼容"路径相同。千问有独立的原生格式 (DashScope)。MiniMax 有独立原生格式。

---

## 6. 测试矩阵

| 厂商 | 场景 | 路由 | 预期 |
|------|------|------|------|
| 千问 | Chat (OpenAI 兼容) | `/v1/chat/completions` + model=qwen-max | 标准 OpenAI 响应 |
| 千问 | Chat (原生透传) | `/v1/native/qwen/api/v1/services/aigc/...` | 千问原生响应 |
| 千问 | Embedding | `/v1/embeddings` + model=text-embedding-v3 | 标准 OpenAI embedding 响应 |
| 豆包 | Chat | `/v1/chat/completions` + model=Doubao-pro-32k | 标准 OpenAI 响应 |
| 豆包 | TTS | `/v1/audio/speech` | 音频二进制流 |
| 豆包 | Image | `/v1/images/generations` + model=seedream-3.0 | 图片 URL |
| GLM | Chat | `/v1/chat/completions` + model=glm-4 | 标准 OpenAI 响应 |
| GLM | Claude Format | `/v1/messages` + model=glm-4 | Claude 格式响应 (新增) |
| Kimi | Chat | `/v1/chat/completions` + model=kimi-k2.5 | 标准 OpenAI 响应 |
| Kimi | Claude Format | `/v1/messages` + model=kimi-k2.5 | Claude 格式响应 |
| MiniMax | Chat | `/v1/chat/completions` + model=MiniMax-Text-01 | 标准 OpenAI 响应 |
| MiniMax | TTS | `/v1/audio/speech` | 音频二进制流 |
| 全厂商 | Responses API | `/v1/responses` | OpenAI Responses 格式 (新增) |
| 全厂商 | 原生透传 | `/v1/native/{provider}/*` | 厂商原生响应 (T-004) |

---

## 7. 实现优先级

### Phase 1 — 原生透传认证 (🔴 高优先级)
- [ ] injectNativeAuth 五厂商认证分发
- [ ] GLM JWT 提取为公共函数
- [ ] 验证 T-004 `/v1/native/{provider}/*` 路由对五厂商可用

### Phase 2 — Responses API 补齐 (🟡 中优先级)
- [ ] 五厂商 ConvertOpenAIResponsesRequest 委托实现
- [ ] GLM ConvertClaudeRequest 委托实现

### Phase 3 — 能力扩展 (🟢 低优先级)
- [ ] GLM Rerank 适配
- [ ] MiniMax Rerank 适配
- [ ] 豆包 ImageEdits 解注释
- [ ] Kimi 文件上传支持

---

> 文档版本: 1.0  
> 生成时间: 2025-07-11  
> 基于: T-001 架构分析 + T-004 原生透传设计 + new-api 源码审计
