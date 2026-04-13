# T-004 原生 API 透传路由设计

> **任务**: PRJ-LITE999-T-004  
> **依赖**: T-001 (New-API 源码分析)  
> **目标**: 设计并实现原生 API 透传模式，支持直接转发用户请求到上游渠道，绕过协议转换与适配器层

---

## 1. 背景与需求

### 1.1 什么是透传模式

透传模式（Pass-through / Proxy Mode）指 OpenClaw 接收用户请求后，**不做任何协议转换**，直接将请求转发到下游渠道，并将下游响应**直接返回给用户**。

对比：

| 模式 | 请求转换 | 响应转换 | 适用场景 |
|------|----------|----------|----------|
| **标准模式** | ✅ OpenAI → 厂商格式 | ✅ 厂商响应 → OpenAI 格式 | 大多数场景 |
| **透传模式** | ❌ 直接转发 | ❌ 直接返回 | 厂商 API 不兼容、测试、特定协议 |

### 1.2 需求场景

1. **厂商 API 不兼容** — 某些厂商返回非标准格式，需要透传避免适配器解析失败
2. **调试与测试** — 直通上游，便于抓包分析
3. **自定义协议** — 厂商使用私有协议，OpenClaw 不处理
4. **性能优化** — 跳过转换层，降低延迟
5. **多端点支持** — 同时暴露多个厂商端点

---

## 2. 路由架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OpenClaw Gateway                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌───────────┐ │
│  │  Client │───▶│   Auth      │───▶│  Router     │───▶│ Upstream  │ │
│  │ Request │    │  (Token)    │    │  (Passthrough)│   │ Provider  │ │
│  └─────────┘    └─────────────┘    └─────────────┘    └───────────┘ │
│                                                                      │
│       │                  │                   │                      │
│       ▼                  ▼                   ▼                      │
│  Token 验证        路由决策            透传转发                    │
│  Quota 检查       Channel 选择        Response 回传               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 请求流程

```
HTTP Request (OpenAI 兼容格式)
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  1. TokenAuth() - 认证与配额检查                            │
│     - 验证 API Key (sk-xxx)                                 │
│     - 检查用户状态/配额                                     │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  2. PassthroughRoute() - 透传路由决策                       │
│     - 解析 X-Passthrough-Channel 请求头                     │
│     - 或根据 model 分组映射到渠道                          │
│     - 获取目标 Channel 配置                                 │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  3. DirectForward() - 直接转发                              │
│     - 复制请求头 (Authorization, Content-Type 等)          │
│     - 转换请求路径 (/v1/chat/completions →厂商路径)        │
│     - 复制请求 Body                                         │
│     - 添加厂商认证头 (Authorization: Bearer $API_KEY)       │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  4. ResponsePassthrough() - 响应回传                        │
│     - 直接复制状态码                                         │
│     - 直接复制响应头 (Content-Type 等)                      │
│     - 直接复制响应 Body                                      │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
Response (厂商原生格式)
```

### 2.3 路由定义

| 路由 | 方法 | 说明 |
|------|------|------|
| `/v1/chat/completions` | POST | 文本对话透传 |
| `/v1/embeddings` | POST | Embedding 透传 |
| `/v1/models/*` | GET | 模型列表透传 |
| `/proxy/*` | * | 通用透传路由 |

---

## 3. 厂商列表与适配

### 3.1 支持的厂商

| 厂商 | Channel Type ID | API 格式 | 认证方式 | 备注 |
|------|-----------------|----------|----------|------|
| **OpenAI** | 1 | OpenAI API | Bearer Token | 官方 |
| **Anthropic** | 14 | Anthropic Messages API | x-api-key | Claude 系列 |
| **Google Gemini** | 24 | Google AI API | API Key | Vertex AI 也支持 |
| **MiniMax** | 35 | MiniMax API | Bearer Token | 国内厂商 |
| **Azure OpenAI** | 3 | Azure API | API-Key (Header) | 企业版 |
| **OpenRouter** | 20 | OpenAI 兼容 | API Key | 聚合平台 |
| **DeepSeek** | 43 | OpenAI 兼容 | Bearer Token | 国产大模型 |
| **Moonshot** | 25 | Moonshot API | Bearer Token | Kimi |
| **ZhipuAI** | 34 | Zhipu API | Bearer Token | ChatGLM |

### 3.2 厂商认证参数映射

```go
// service/passthrough/auth_map.go

var AuthHeaderMap = map[int]AuthConfig{
    // OpenAI
    1: {
        AuthHeader: "Authorization",
        AuthPrefix: "Bearer ",
        KeySource:  "channel.Key", // 从 Channel 配置获取
    },
    // Anthropic
    14: {
        AuthHeader: "x-api-key",
        AuthPrefix: "",
        KeySource:  "channel.Key",
    },
    // Google Gemini
    24: {
        AuthHeader: "x-goog-api-key",
        AuthPrefix: "",
        KeySource:  "channel.Key",
    },
    // MiniMax
    35: {
        AuthHeader: "Authorization",
        AuthPrefix: "Bearer ",
        KeySource:  "channel.Key",
    },
    // Azure
    3: {
        AuthHeader: "Api-Key",
        AuthPrefix: "",
        KeySource:  "channel.Key",
        // Azure 还需在 URL 中包含 api-version
    },
    // DeepSeek
    43: {
        AuthHeader: "Authorization",
        AuthPrefix: "Bearer ",
        KeySource:  "channel.Key",
    },
}
```

### 3.3 请求路径映射

```go
// service/passthrough/path_map.go

var PathRewriteMap = map[int]PathRewrite{
    // OpenAI 官方
    1: {
        BaseURL: "https://api.openai.com",
        PathMap: map[string]string{
            "/v1/chat/completions": "/v1/chat/completions",
            "/v1/embeddings":       "/v1/embeddings",
            "/v1/models":           "/v1/models",
        },
    },
    // Anthropic
    14: {
        BaseURL: "https://api.anthropic.com",
        PathMap: map[string]string{
            "/v1/chat/completions": "/v1/messages",
        },
        ExtraHeaders: map[string]string{
            "anthropic-version": "2023-06-01",
        },
    },
    // Google Gemini
    24: {
        BaseURL: "https://generativelanguage.googleapis.com",
        PathMap: map[string]string{
            "/v1/chat/completions": "/v1beta/models/{model}:streamGenerateContent",
            "/v1/embeddings":      "/v1beta/models/{model}:predict",
        },
        // Gemini 需要在 URL 参数中传递 key
    },
    // MiniMax
    35: {
        BaseURL: "https://api.minimax.chat",
        PathMap: map[string]string{
            "/v1/chat/completions": "/v1/text/chatcompletion_v2",
        },
    },
    // DeepSeek
    43: {
        BaseURL: "https://api.deepseek.com",
        PathMap: map[string]string{
            "/v1/chat/completions": "/v1/chat/completions",
            "/v1/embeddings":       "/v1/embeddings",
        },
    },
}
```

---

## 4. 请求响应透传机制

### 4.1 请求透传核心代码

```go
// middleware/passthrough.go

func PassthroughForward() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. 获取透传目标 Channel
        channelId := c.GetHeader("X-Passthrough-Channel-Id")
        if channelId == "" {
            // 尝试从 model 分组解析
            model := c.GetString("model")
            channelId = resolveChannelByModel(model)
        }
        
        channel, err := model.GetChannelById(channelId)
        if err != nil {
            c.JSON(400, gin.H{"error": "Invalid passthrough channel"})
            return
        }

        // 2. 构建上游请求
        upstreamURL := buildUpstreamURL(channel, c.Request)
        
        // 3. 复制请求头
        req, err := http.NewRequest(c.Request.Method, upstreamURL, c.Request.Body)
        if err != nil {
            c.JSON(500, gin.H{"error": "Failed to create request"})
            return
        }
        
        // 4. 设置认证头
        setAuthHeaders(req, channel)
        
        // 5. 复制原始请求头 (Content-Type, Accept 等)
        for key, values := range c.Request.Header {
            for _, value := range values {
                if isSkippableHeader(key) {
                    continue
                }
                req.Header.Add(key, value)
            }
        }

        // 6. 发送请求
        client := &http.Client{Timeout: 120 * time.Second}
        resp, err := client.Do(req)
        if err != nil {
            c.JSON(502, gin.H{"error": "Upstream request failed: " + err.Error()})
            return
        }
        defer resp.Body.Close()

        // 7. 回传响应
        for key, values := range resp.Header {
            for _, value := range values {
                c.Header(key, value)
            }
        }
        c.Status(resp.StatusCode)
        
        // 8. 流式响应处理
        if isStreamingRequest(c.Request) {
            streamResponse(c, resp.Body)
        } else {
            io.Copy(c.Writer, resp.Body)
        }
    }
}
```

### 4.2 流式响应透传

```go
// service/passthrough/stream.go

func streamResponse(c *gin.Context, body io.Reader) {
    flusher, ok := c.Writer.(http.Flusher)
    if !ok {
        io.Copy(c.Writer, body)
        return
    }

    reader := bufio.NewReader(body)
    c.Header("Content-Type", "text/event-stream")
    c.Header("Cache-Control", "no-cache")
    c.Header("Connection", "keep-alive")

    for {
        line, err := reader.ReadString('\n')
        if err != nil {
            break
        }
        c.Writer.Write([]byte(line))
        flusher.Flush()
    }
}
```

### 4.3 请求体透传

透传模式下，**不做任何请求体转换**。但需要处理以下情况：

1. **模型名称映射** — 用户请求中的 `model` 可能需要映射到厂商模型名
2. **多模态 URL 处理** — 图片/音频 URL 需要确保上游可访问
3. **Base64 编码** — 保留原始编码

```go
// service/passthrough/request_body.go

func shouldModifyBody(channelType int, body []byte) (bool, []byte) {
    switch channelType {
    case 14: // Anthropic
        // Anthropic 使用 "messages" 而非 "messages" 结构稍有不同
        // 可选: 轻微调整或直接透传
        return false, body
    case 24: // Gemini
        // Gemini 需要将 OpenAI 格式转为 Gemini 格式
        // 但这违背了透传原则，默认不透传
        return false, body
    default:
        // OpenAI 兼容格式，直接透传
        return false, body
    }
}
```

---

## 5. 认证转发

### 5.1 Token 认证层

透传模式下，用户仍需通过 Token 认证，但**不执行协议转换**：

```go
// middleware/passthrough_auth.go

func PassthroughAuth() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. 验证用户 Token (与标准模式相同)
        key := c.GetHeader("Authorization")
        key = strings.TrimPrefix(key, "Bearer ")
        key = strings.TrimPrefix(key, "sk-")
        
        token, err := model.ValidateUserToken(key)
        if err != nil {
            c.JSON(401, gin.H{"error": "Invalid token"})
            return
        }
        
        // 2. 检查用户状态
        userCache, _ := model.GetUserCache(token.UserId)
        if userCache.Status != common.UserStatusEnabled {
            c.JSON(403, gin.H{"error": "User disabled"})
            return
        }
        
        // 3. 设置上下文 (但不执行模型映射)
        c.Set("token_id", token.Id)
        c.Set("user_id", token.UserId)
        
        // 4. 可选: 记录用量 (按请求字符数/字节数)
        recordPassthroughUsage(token.Id, c.Request)
        
        c.Next()
    }
}
```

### 5.2 渠道认证转发

```go
// service/passthrough/auth.go

func setAuthHeaders(req *http.Request, channel *model.Channel) {
    switch channel.Type {
    case 1: // OpenAI
        req.Header.Set("Authorization", "Bearer "+channel.Key)
        
    case 14: // Anthropic
        req.Header.Set("x-api-key", channel.Key)
        req.Header.Set("anthropic-version", "2023-06-01")
        
    case 24: // Google Gemini
        // Gemini 可能用 URL 参数或 Header
        // URL: ?key=YOUR_API_KEY
        req.Header.Set("x-goog-api-key", channel.Key)
        
    case 35: // MiniMax
        req.Header.Set("Authorization", "Bearer "+channel.Key)
        
    case 3: // Azure
        req.Header.Set("Api-Key", channel.Key)
        // Azure 还需处理 api-version 参数
        
    case 43: // DeepSeek
        req.Header.Set("Authorization", "Bearer "+channel.Key)
        
    default:
        req.Header.Set("Authorization", "Bearer "+channel.Key)
    }
}
```

### 5.3 多 Key 轮换

透传模式下同样支持多 Key：

```go
// service/passthrough/multikey.go

func getNextKey(channel *model.Channel) string {
    if !channel.ChannelInfo.IsMultiKey {
        return channel.Key
    }
    
    keys := strings.Split(channel.Key, "\n")
    switch channel.ChannelInfo.MultiKeyMode {
    case "polling":
        idx := channel.ChannelInfo.MultiKeyPollingIndex
        channel.ChannelInfo.MultiKeyPollingIndex = (idx + 1) % len(keys)
        return keys[idx]
    case "random":
        randIdx := rand.Intn(len(keys))
        return keys[randIdx]
    default:
        return keys[0]
    }
}
```

---

## 6. 错误处理

### 6.1 错误分类

| 错误类型 | 来源 | 处理策略 |
|----------|------|----------|
| **认证错误** | Token 无效/过期 | 401 返回，不转发 |
| **配额不足** | 用户配额用尽 | 402 返回，不转发 |
| **渠道不可用** | Channel 禁用/超时 | 502 返回，禁用该渠道 |
| **上游错误** | 厂商返回 4xx/5xx | 透传返回 |
| **网络错误** | 连接超时/失败 | 502 + 重试 |

### 6.2 错误透传

透传模式的核心是**保留上游错误**：

```go
// service/passthrough/error_handler.go

func handleUpstreamError(c *gin.Context, resp *http.Response) {
    // 读取上游错误体
    body, _ := io.ReadAll(resp.Body)
    
    // 直接返回上游状态码和错误体
    for key, values := range resp.Header {
        // 排除可能被 OpenClaw 修改的头
        if !isInternalHeader(key) {
            for _, value := range values {
                c.Header(key, value)
            }
        }
    }
    
    c.Status(resp.StatusCode)
    c.Writer.Write(body)
}

func isInternalHeader(key string) bool {
    internalHeaders := []string{
        "X-Request-Id",
        "X-Response-Time",
        "X-Upstream-Channel",
    }
    for _, h := range internalHeaders {
        if strings.EqualFold(key, h) {
            return true
        }
    }
    return false
}
```

### 6.3 超时与重试

```go
// service/passthrough/retry.go

type PassthroughConfig struct {
    Timeout       time.Duration // 单次请求超时
    MaxRetries   int           // 重试次数
    RetryDelay   time.Duration // 重试间隔
}

var DefaultPassthroughConfig = PassthroughConfig{
    Timeout:     120 * time.Second,
    MaxRetries:  2,
    RetryDelay:  500 * time.Millisecond,
}

func forwardWithRetry(c *gin.Context, channel *model.Channel) error {
    var lastErr error
    
    for i := 0; i <= DefaultPassthroughConfig.MaxRetries; i++ {
        resp, err := doForward(c, channel)
        if err == nil {
            return handleResponse(c, resp)
        }
        
        lastErr = err
        
        // 检查错误是否可重试
        if !isRetryable(err) {
            break
        }
        
        // 等待后重试
        time.Sleep(DefaultPassthroughConfig.RetryDelay)
    }
    
    return lastErr
}

func isRetryable(err error) bool {
    if timeout, ok := err.(net.Error); ok && timeout.Timeout() {
        return true
    }
    return false
}
```

### 6.4 错误日志

```go
// service/passthrough/logging.go

func logPassthroughRequest(c *gin.Context, channel *model.Channel, resp *http.Response, err error) {
    logEntry := model.PassthroughLog{
        Timestamp:   time.Now(),
        TokenId:     c.GetInt("token_id"),
        ChannelId:   channel.Id,
        ChannelType: channel.Type,
        Method:      c.Request.Method,
        Path:        c.Request.URL.Path,
        UpstreamURL: getUpstreamURL(channel, c.Request),
        StatusCode:  getStatusCode(resp, err),
        Error:       err.Error(),
        RequestSize: c.Request.ContentLength,
        // 响应大小和延迟
    }
    
    model.SavePassthroughLog(logEntry)
}
```

---

## 7. 配置与启用

### 7.1 路由注册

```go
// router/passthrough_router.go

func SetupPassthroughRouter(r *gin.Engine) {
    // 透传专用中间件链
    passthroughGroup := r.Group("")
    passthroughGroup.Use(middleware.PassthroughAuth())    // Token 认证
    passthroughGroup.Use(middleware.PassthroughLimiter()) // 可选限流
    
    // 透传路由
    passthroughGroup.POST("/v1/chat/completions", middleware.PassthroughForward())
    passthroughGroup.POST("/v1/embeddings", middleware.PassthroughForward())
    passthroughGroup.GET("/v1/models", middleware.PassthroughForward())
}
```

### 7.2 渠道配置

```go
// model/channel.go 增加字段

type Channel struct {
    // ... 原有字段 ...
    
    // 透传相关
    EnablePassthrough bool  `json:"enable_passthrough"`
    PassthroughBaseURL string `json:"passthrough_base_url"` // 可覆盖默认 BaseURL
}
```

### 7.3 客户端调用示例

```bash
# 使用 X-Passthrough-Channel-Id 指定渠道
curl -X POST https://openclaw.example.com/v1/chat/completions \
  -H "Authorization: Bearer sk-xxx" \
  -H "X-Passthrough-Channel-Id: 123" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}'
```

---

## 8. 实现计划

### Phase 1: 核心透传 (MVP)

- [ ] 路由注册与中间件
- [ ] Channel 解析与认证转发
- [ ] 请求/响应透传 (非流式)
- [ ] 错误透传

### Phase 2: 流式与增强

- [ ] 流式响应透传 (SSE)
- [ ] 多 Key 轮换
- [ ] 超时与重试
- [ ] 用量记录

### Phase 3: 高级特性

- [ ] 路径重写规则引擎
- [ ] 请求/响应日志
- [ ] 熔断与降级

---

> 文档版本: 1.0  
> 生成时间: 2025-07-10  
> 依赖: T-001 (New-API 源码分析)  
> 状态: 已完成