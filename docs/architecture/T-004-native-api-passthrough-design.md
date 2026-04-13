# T-004 原生 API 透传路由设计

> **任务**: PRJ-LITE999-T-004  
> **依赖**: T-001 (New-API 源码分析)  
> **目标**: 设计 `/v1/native/{provider}/` 路径路由，支持厂商原生格式透传

---

## 1. 背景与现状

### 1.1 现有透传能力

New-API 已在以下 Handler 中实现请求体透传：

| Handler | 透传条件 | 位置 |
|---------|----------|------|
| `TextHelper` | `PassThroughRequestEnabled` (全局) 或 `PassThroughBodyEnabled` (渠道) | `relay/compatible_handler.go` L95 |
| `GeminiHelper` | 同上 | `relay/gemini_handler.go` L140 |
| `ResponsesHelper` | 同上 | `relay/responses_handler.go` L74 |
| `ImageHandler` | 同上 | `relay/image_handler.go` L49 |

**透传行为**:
- **Request**: 跳过 `adaptor.ConvertOpenAIRequest()` 等转换，直接读取原始请求体
- **Response**: 仍经 `adaptor.DoResponse()` 解析，返回 OpenAI 格式 usage
- **URL 路由**: 仍走标准 OpenAI 路径 (`/v1/chat/completions` 等)

### 1.2 目标差异

| 维度 | 现有透传 | 原生透传 (T-004) |
|------|----------|-----------------|
| **路径** | `/v1/chat/completions` | `/v1/native/{provider}/*` |
| **协议转换** | Request 跳过，Response 保留 | 全链路跳过 (Request + Response) |
| **URL 映射** | 使用标准化 OpenAI 路径 | 直接拼接厂商原生 URL |
| **计费** | 正常解析 usage 计算 quota | 依赖厂商返回的 usage 或按次计费 |
| **适用场景** | 绕过不支持的 OpenAI 字段 | 完全兼容厂商原生 SDK |

---

## 2. 设计方案

### 2.1 路由结构

```
/v1/native/{provider}/{path...}
```

- `{provider}`: 厂商标识，对应 `ChannelType` 或 `APIType`
- `{path...}`: 透传到上游的剩余路径

**示例**:
```
# 用户请求
GET /v1/native/anthropic/v1/messages

# 上游请求 (Channel BaseURL: https://api.anthropic.com)
GET https://api.anthropic.com/v1/messages

# 用户请求
POST /v1/native/google/v1beta/models/gemini-2.0-flash:generateContent

# 上游请求
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
```

### 2.2 新增 RelayFormat

```go
// new-api/types/relay_format.go
const (
    // ... 现有格式 ...
    RelayFormatNative RelayFormat = "native"  // 原生格式透传
)
```

### 2.3 路由注册

```go
// new-api/router/relay-router.go

nativeRouter := router.Group("/v1/native")
nativeRouter.Use(middleware.RouteTag("relay"))
nativeRouter.Use(middleware.SystemPerformanceCheck())
nativeRouter.Use(middleware.TokenAuth())
nativeRouter.Use(middleware.ModelRequestRateLimit())
nativeRouter.Use(middleware.Distribute())

// 通用原生透传路由
nativeRouter.Any("/*path", func(c *gin.Context) {
    controller.Relay(c, types.RelayFormatNative)
})
```

### 2.4 Relay 逻辑 (NativeHelper)

```go
// new-api/relay/native_handler.go

func NativeHelper(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
    info.InitChannelMeta(c)

    // 1. 获取原始请求体 (不解析)
    storage, err := common.GetBodyStorage(c)
    if err != nil {
        return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest)
    }
    requestBody := common.ReaderOnly(storage)

    // 2. 构建厂商原生 URL
    upstreamURL, err := buildNativeUpstreamURL(info, c.Param("path"))
    if err != nil {
        return types.NewError(err, types.ErrorCodeInvalidRequest)
    }

    // 3. 设置请求头 (透传 + 注入渠道密钥)
    req, err := http.NewRequest(c.Request.Method, upstreamURL, requestBody)
    if err != nil {
        return types.NewError(err, types.ErrorCodeInvalidRequest)
    }
    // 透传客户端请求头 (排除 hop-by-hop)
    for k, v := range c.Request.Header {
        if !isHopByHopHeader(k) && !isAuthHeader(k) {
            req.Header[k] = v
        }
    }
    // 注入渠道 API Key
    if info.ChannelSetting.NativeAuthHeader != "" {
        req.Header.Set(info.ChannelSetting.NativeAuthHeader, info.ApiKey)
    } else {
        // 默认行为: 使用标准 Header
        switch info.ChannelType {
        case constant.ChannelTypeAnthropic:
            req.Header.Set("x-api-key", info.ApiKey)
            req.Header.Set("anthropic-version", info.ChannelSetting.NativeAPIVersion)
        case constant.ChannelTypeGemini:
            req.Header.Set("x-goog-api-key", info.ApiKey)
        default:
            req.Header.Set("Authorization", "Bearer "+info.ApiKey)
        }
    }

    // 4. 发起请求 (不使用 Adaptor，直接 HTTP)
    resp, err := channel.DoNativeRequest(c, req, info)
    if err != nil {
        return types.NewError(err, types.ErrorCodeDoRequestFailed, http.StatusBadGateway)
    }

    // 5. 透传响应 (不解析)
    for k, v := range resp.Header {
        if !isHopByHopHeader(k) {
            c.Header(k, v[0])
        }
    }
    c.Status(resp.StatusCode)

    // 6. 计费 (依赖厂商 usage 或按次)
    nativeUsage, _ := parseNativeUsage(resp, info.ChannelType)
    if nativeUsage != nil {
        // 按量计费
        service.PostNativeConsumeQuota(c, info, nativeUsage)
    } else if info.ChannelSetting.NativeFlatRate > 0 {
        // 按次计费
        service.PostNativeFlatRateQuota(c, info)
    }

    // 流式响应特殊处理
    if info.IsStream {
        return streamNativeResponse(c, resp, info)
    }

    // 非流式: 直接 COPY 响应体
    _, err = io.Copy(c.Writer, resp.Body)
    return nil
}
```

### 2.5 渠道配置扩展

```go
// new-api/dto/channel_settings.go

type ChannelSettings struct {
    // ... 现有字段 ...
    
    // 原生透传配置
    NativeEnabled        bool   `json:"native_enabled"`          // 启用原生透传
    NativeBaseURL        string `json:"native_base_url"`         // 自定义上游 URL (覆盖默认)
    NativeAuthHeader     string `json:"native_auth_header"`       // 认证 Header 名称
    NativeAPIVersion     string `json:"native_api_version"`      // API 版本 (如 anthropic-version)
    NativeFlatRate       int    `json:"native_flat_rate"`        // 按次计费配额 (0=按量)
    NativeResponsePassthrough bool `json:"native_response_passthrough"` // 响应透传 (不解码)
}
```

### 2.6 计费策略

| 场景 | 计费方式 | 实现 |
|------|----------|------|
| **厂商返回 usage** | 按量 (Prompt + Completion tokens) | 解析 `X-Usage-Token` 等自定义 Header 或 Response Body |
| **厂商无 usage** | 按次 (FlatRate) | 使用 `NativeFlatRate` 配置的固定配额 |
| **流式响应** | 按首次 token 预估 + 后结算 | 记录首包时间，后续轮询结算 |

---

## 3. 兼容性与限制

### 3.1 不支持的功能

| 功能 | 原因 | 替代方案 |
|------|------|----------|
| Token 计数 | 跳过 Request 解析，无法统计 input tokens | 依赖厂商返回或使用固定值 |
| 模型映射 | 跳过模型转换逻辑 | 在 NativeBaseURL 中自行映射 |
| System Prompt 注入 | 不解析 OpenAI Request | 通过 Middleware 在透传前修改 Body |
| 参数覆盖 | 不解析 Request Body | 通过 NativeBaseURL Query 参数 |
| 重试机制 | 响应透传后无法安全重试 | 依赖上游幂等性 |

### 3.2 安全限制

1. **仅允许启用 Native 的渠道**: 透传受 `NativeEnabled` 配置管控
2. **限制请求频率**: 复用现有 `ModelRequestRateLimit` Middleware
3. **审计日志**: 记录 `NativeUsage` 或 `NativeFlatRate` 到 Log 表
4. **Body Size 限制**: 复用现有 `MaxRequestSize` 限制

---

## 4. 实现清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `types/relay_format.go` | 修改 | 新增 `RelayFormatNative` |
| `dto/channel_settings.go` | 修改 | 新增 Native 配置字段 |
| `relay/native_handler.go` | 新增 | NativeHelper 实现 |
| `relay/channel/native.go` | 新增 | DoNativeRequest + 辅助函数 |
| `router/relay-router.go` | 修改 | 注册 `/v1/native/*` 路由 |
| `controller/relay.go` | 修改 | Relay 函数增加 `RelayFormatNative` 分支 |
| `service/native_quota.go` | 新增 | PostNativeConsumeQuota / PostNativeFlatRateQuota |

---

## 5. 测试用例

| 场景 | 输入 | 预期 |
|------|------|------|
| Anthropic 透传 | `POST /v1/native/anthropic/v1/messages` (Claude Request) | 上游 `https://api.anthropic.com/v1/messages` |
| Gemini 透传 | `POST /v1/native/google/v1beta/models/...:generateContent` | 上游 `generativelanguage.googleapis.com/...` |
| 自定义 BaseURL | 渠道配置 `NativeBaseURL: https://custom.ai` | 透传到自定义 URL |
| 按次计费 | 渠道配置 `NativeFlatRate: 100` | 每次请求扣除 100 quota |
| 流式透传 | 流式 Request | SSE 响应直接透传 |

---

> 文档版本: 1.0  
> 生成时间: 2025-07-11  
> 基于: T-001 架构分析 + new-api 源码 (QuantumNous fork)
