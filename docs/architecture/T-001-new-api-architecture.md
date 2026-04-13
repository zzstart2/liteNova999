# New-API 架构分析与二开指南

> **任务**: T-001 New-API 源码分析与架构梳理  
> **项目**: PRJ-LITE999 (liteNova999 通用大模型API转发平台)  
> **目标**: 为二次开发提供架构文档与切入点识别

---

## 1. 整体架构概览

New-API 是一个 Go + React 构建的 AI API 转发平台，核心功能是：

1. **接收用户请求** (OpenAI 兼容格式)
2. **认证与配额管理**
3. **智能路由到下游渠道** (多厂商接入)
4. **计费与用量统计**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Relay     │────▶│  Channel   │────▶│  Upstream  │
│  (User)    │     │  Router    │     │  Selector  │     │  Providers│
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
   Token Auth      Request Transform   Channel Affinity   Response Transform
   Quota Check    Model Mapping     Load Balance    Usage Counting
```

---

## 2. 核心模块架构

### 2.1 路由层 (Relay Layer)

**位置**: `router/relay-router.go` + `relay/` + `controller/relay.go`

#### 请求分发流程

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  1. TokenAuth() [middleware/auth.go]                        │
│     - 验证 API Key (sk-xxx)                              │
│     - 加载用户上下文 (id, quota, group)                │
│     - 检查用户状态/Token限制                      │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Distribute() [middleware/distributor.go]               │
│     - 解析 model/group 参数                           │
│     - 检查 token model limits                      │
│     - 调用 Channel Selector                      │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Relay() [controller/relay.go]                     │
│     - GenRelayInfo() 生成请求上下文                │
│     - PreConsumeBilling() 预扣费                  │
│     - 循环调用下游渠道 + 重试                     │
│     - SettleBilling() 结算                        │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
Response
```

#### 关键路由定义

| 路由 | 类型 | 说明 |
|------|------|------|
| `/v1/chat/completions` | POST | 文本对话 |
| `/v1/embeddings` | POST | Embedding |
| `/v1/images/generations` | POST | 图像生成 |
| `/v1/audio/transcriptions` | POST | 语音转写 |
| `/v1beta/models/*` | POST | Gemini 兼容 |
| `/mj/submit/*` | POST | Midjourney |
| `/suno/submit/*` | POST | Suno 音乐 |

---

### 2.2 认证层 (Auth Layer)

**位置**: `middleware/auth.go` + `model/token.go`

#### Token 验证流程

```go
// middleware/auth.go - TokenAuth()
func TokenAuth() func(c *gin.Context) {
    return func(c *gin.Context) {
        key := c.Request.Header.Get("Authorization")
        // 去除 "Bearer " 或 "sk-" 前缀
        key = strings.TrimPrefix(key, "Bearer ")
        key = strings.TrimPrefix(key, "sk-")
        
        // 验证 Token
        token, err := model.ValidateUserToken(key)
        if err != nil {
            abortWithOpenAiMessage(c, 401, "Invalid token")
            return
        }
        
        // 检查用户状态
        userCache, _ := model.GetUserCache(token.UserId)
        if userCache.Status != common.UserStatusEnabled {
            abortWithOpenAiMessage(c, 403, "User disabled")
            return
        }
        
        // 设置上下文
        c.Set("id", token.UserId)
        c.Set("token_id", token.Id)
        c.Set("token_key", token.Key)
        
        // 检查分组权限
        common.SetContextKey(c, constant.ContextKeyUsingGroup, token.Group)
    }
}
```

#### Token 数据模型

```go
// model/token.go
type Token struct {
    Id                 int    // Token ID
    UserId             int    // 所属用户
    Key                string // API Key (sk-xxx)
    Status             int    // 状态 (1=启用, 0=禁用)
    Name               string // 名称
    RemainQuota        int    // 剩余配额
    UnlimitedQuota    bool   // 是否无限配额
    ModelLimitsEnabled bool   // 是否启用模型限制
    ModelLimits       string // 允许的模型列表 (JSON)
    AllowIps          *string // IP 白名单
    Group             string // 默认分组
    CrossGroupRetry   bool   // 跨分组重试
    ExpiredTime       int64   // 过期时间 (-1=永不过期)
}
```

---

### 2.3 计费层 (Billing Layer)

**位置**: `service/billing.go` + `service/billing_session.go` + `relay/helper/price.go`

#### 计费流程

```
1. PreConsumeBilling (预扣费)
   │
   ├── EstimateRequestToken() - 估算 token 数量
   ├── ModelPriceHelper() - 计算模型价格
   │   ├── modelRatio (模型倍率)
   │   ├── completionRatio (补全倍率)
   │   ├── groupRatio (分组倍率)
   │   └── cacheRatio (缓存倍率)
   └── NewBillingSession() - 执行预扣费
       └── 从用户钱包/订阅中预扣 quota

2. Relay 循环 (实际请求)

3. SettleBilling (结算)
   │
   ├── 获取实际 usage
   ├── 计算实际 quota
   └── 多退少补 (如果预扣 > 实际, 退还; 不足, 补扣)
```

#### 价格计算公式

```go
// relay/helper/price.go
quota = inputTokens * modelRatio * groupRatio +
        outputTokens * completionRatio * groupRatio

// 或者使用固定价格
quota = modelPrice * modelRatio * groupRatio * quotaPerUnit
```

#### 倍率机制

| 倍率类型 | 来源 | 说明 |
|----------|------|------|
| `modelRatio` | `setting/ratio_setting/model_ratio.go` | 模型基础倍率 |
| `completionRatio` | 同上 | 输出 token 倍率 (通常 <1) |
| `groupRatio` | `setting/ratio_setting/group_ratio.go` | 分组倍率 |
| `cacheRatio` | `setting/ratio_setting/cache_ratio.go` | 缓存读取折扣 |
| `imageRatio` | `setting/ratio_setting/image_ratio.go` | 图像计费 |
| `audioRatio` | 同上 | 音频计费 |

#### 分组 (Group) 机制

- 每个渠道属于一个或多个分组
- Token 绑定一个默认分组
- `auto` 分组支持自动选择 + 故障转移

```go
// 分组配置示例
group: "default"           // 默认分组
group: "gpt-4"           // GPT-4 专用
group: "auto"             // 自动选择 (支持跨组重试)
group: "free"            // 免费渠道
```

---

### 2.4 渠道管理 (Channel Management)

**位置**: `model/channel.go` + `model/channel_cache.go` + `model/ability.go`

#### Channel 数据模型

```go
// model/channel.go
type Channel struct {
    Id          int           // 渠道 ID
    Type        int           // 渠道类型 (1=OpenAI, 24=Gemini, 14=Anthropic, etc.)
    Key         string       // API Key (多 key 用 \n 分隔)
    BaseURL     *string     // 自定义端点
    Status      int          // 状态 (1=启用, 0=禁用)
    Name        string       // 名称
    Models      string       // 支持的模型列表 (逗号分隔)
    Group      string       // 所属分组
    Weight     *uint        // 权重 (负载均衡)
    Priority   *int64      // 优先级
    ChannelInfo ChannelInfo // 扩展信息
    
    // 多 Key 支持
    ChannelInfo.IsMultiKey           bool
    ChannelInfo.MultiKeySize       int
    ChannelInfo.MultiKeyMode      // Polling / Random
    ChannelInfo.MultiKeyPollingIndex int
}
```

#### 渠道类型 (constant/channel.go)

```go
const (
    ChannelTypeOpenAI      = 1   // OpenAI 官方
    ChannelTypeAnthropic = 14  // Anthropic (Claude)
    ChannelTypeGemini     = 24  // Google Gemini
    ChannelTypeAzure    = 3   // Azure OpenAI
    ChannelTypeOpenRouter = 20  // OpenRouter
    ChannelTypeDeepSeek  = 43  // DeepSeek
    ChannelTypeMiniMax   = 35  // MiniMax
    ChannelTypeMoonshot = 25  // Moonshot (Kimi)
    // ... 共 58 种渠道类型
)
```

#### Ability 关联表

```go
// model/ability.go
type Ability struct {
    Group     string  // 分组
    Model     string  // 模型名
    ChannelId int     // 渠道 ID
    Enabled   bool   // 是否启用
    Priority  *int64 // 优先级
    Weight   uint   // 权重
    Tag      *string // 标签
}
```

#### 渠道选择算法

```go
// service/channel_select.go - CacheGetRandomSatisfiedChannel()
// 1. 根据 group + model 查询可用 channels
// 2. 按 priority 降序排序
// 3. 根据 retry 参数选择不同 priority
// 4. weighted random 选择同 priority 内的 channel

// 关键数据结构:
// group2model2channels[group][model] → []channelId
// 按 priority 分组, 优先使用高 priority
```

---

## 3. 扩展接入点识别

### 3.1 官方API透传模式接入点

**需求**: 支持官方 API 完全透传模式 (如 OpenAI API Proxy)

**方案 A**: 简单模式 - 固定 Channel 绑定

```go
// 在 Token 创建时指定固定 channel_id
// 修改 middleware/distributor.go 逻辑
if token.SpecificChannelId > 0 {
    channel, _ = model.GetChannelById(token.SpecificChannelId)
    // 跳过通道选择
}
```

**方案 B**: 动态模式 - 按域名/路径选择

```go
// 位置: middleware/distributor.go
// 在 getModelRequest() 之前添加

func getPassThroughChannel(c *gin.Context) (*model.Channel, error) {
    // 检查请求头或参数
    passThrough := c.GetHeader("X-Pass-Through")
    if passThrough != "" {
        // 使用特定渠道
        return model.GetChannelByName(passThrough)
    }
    
    // 或按模型名匹配
    modelName := c.GetString("model")
    if isOfficialModel(modelName) {
        return getOfficialChannel(modelName)
    }
    return nil, nil
}
```

**方案 C**: 创建新的 Token 类型

```go
// model/token.go
type Token struct {
    // ...
    PassThroughChannelId *int  // 指定透传渠道 ID
    PassThroughMode    bool  // 透传模式
}
```

**推荐修改位置**:
- `middleware/distributor.go` - `Distribute()` 函数
- 添加新中间件 `middleware/pass_through.go`

---

### 3.2 用量仪表盘增强扩展点

**需求**: 更精细的用量可视化

#### 扩展点 1: 实时用量 API

```go
// controller 用量查询
// 位置: router/api-router.go

tokenUsageRoute.GET("/realtime", controller.GetTokenUsageRealtime)

// service/usage_realtime.go
func GetTokenUsageRealtime(tokenId int) UsageRealtime {
    return UsageRealtime{
        CurrentMinuteInputTokens:  getMinuteTokens(tokenId, "input"),
        CurrentMinuteOutputTokens: getMinuteTokens(tokenId, "output"),
        CurrentMinuteRequests:  getMinuteRequests(tokenId),
        MinuteQuota:          getMinuteQuota(tokenId),
    }
}
```

#### 扩展点 2: 渠道级别统计

```go
// model/channel.go
type ChannelUsage struct {
    ChannelId   int
    Date       time.Time
    InputTokens int
    OutputTokens int
    Requests   int
    Errors    int
    LatencyP50 int  // ms
    LatencyP99 int
}
```

#### 扩展点 3: Dashboard API 增强

```go
// router/dashboard-router.go
GET  /api/dashboard/usage/chart    // 图表数据
GET  /api/dashboard/usage/rank   // 模型排行
GET  /api/dashboard/channel/:id  // 渠道详情
```

**推荐修改位置**:
- `controller/dashboard.go` - 新增控制器
- `model/usage_enhanced.go` - 新增模型
- `web/src/views/Usage.vue` - 前端图表

---

### 3.3 同模型多Key Fallback改造点

**需求**: 同一模型配置多个 Key，主 Key 失败时自动切换到备用 Key

#### 当前机制分析

New-API 已有多 Key 支持:

```go
// model/channel.go
type ChannelInfo struct {
    IsMultiKey      bool
    MultiKeySize    int
    MultiKeyMode   // Polling / Random
}
```

但这是 **单渠道多 Key**，不是 **多渠道**。

#### 方案 A: Channel 级别 (当前已支持)

```go
// 同一模型 + 同一分组 + 多个 Channel
// ability 表:
group=gpt-4, model=gpt-4o, channel_id=1, priority=100
group=gpt-4, model=gpt-4o, channel_id=2, priority=90
group=gpt-4, model=gpt-4o, channel_id=3, priority=80

// 自动按 priority 轮换 + 故障转移
```

#### 方案 B: 跨分组 Fallback (推荐改造)

```go
// token 表增加字段
type Token struct {
    // ...
    FallbackGroups []string  // ["openai", "azure", "claude"]
}

// middleware/distributor.go - 修改逻辑
func FindFallbackChannel(c *gin.Context, modelName string, groups []string) *model.Channel {
    for _, group := range groups {
        ch, _ := model.GetRandomSatisfiedChannel(group, modelName, 0)
        if ch != nil && isChannelHealthy(ch) {
            return ch
        }
    }
    return nil
}
```

#### 方案 C: 智能 Fallback (基于健康状态)

```go
// service/channel_health.go
type ChannelHealth struct {
    ChannelId      int
    SuccessRate   float64  // 近期成功率
    AvgLatency   int     // 平均延迟
    ErrorRate   float64 // 错误率
    LastErrorAt  int64   // 上次错误时间
}

// 修改 channel_select.go
func GetHealthyChannel(group, model string, retry int) (*model.Channel, error) {
    channels := getChannelsByPriority(group, model)
    for _, ch := range channels {
        health := GetChannelHealth(ch.Id)
        if health.SuccessRate > 0.95 && health.AvgLatency < 5000 {
            return ch, nil
        }
    }
    // 无健康渠道, 使用第一个
    return channels[0], nil
}
```

**推荐修改位置**:
- `service/channel_select.go` - `CacheGetRandomSatisfiedChannel()`
- `service/channel_health.go` - 新增健康检查
- `model/channel_health.go` - 新增模型

---

## 4. 核心文件索引

| 功能 | 文件路径 | 说明 |
|------|----------|------|
| **路由** | `router/relay-router.go` | Relay 路由定义 |
| | `router/api-router.go` | 管理 API 路由 |
| **认证** | `middleware/auth.go` | Token 验证 |
| | `model/token.go` | Token 数据模型 |
| **分发** | `middleware/distributor.go` | 渠道选择 |
| | `service/channel_select.go` | 渠道选择算法 |
| | `model/channel_cache.go` | 渠道缓存 |
| **计费** | `service/billing.go` | 预扣/结算 |
| | `service/quota.go` | 配额操作 |
| | `relay/helper/price.go` | 价格计算 |
| **倍数** | `setting/ratio_setting/` | 倍率配置 |
| **渠道** | `model/channel.go` | Channel 模型 |
| | `model/ability.go` | 能力映射 |
| | `relay/relay_adaptor.go` | 适配器注册 |
| | `relay/channel/*` | 各厂商适配器 |
| **请求** | `controller/relay.go` | 请求处理主逻辑 |
| | `relay/common/relay_info.go` | 请求上下文 |
| **日志** | `model/log.go` | 用量日志 |
| **前端** | `web/src/` | React 前端 |

---

## 5. 二开建议

### 快速开始

1. **理解数据流**: 用户请求 → Token验证 → 渠道选择 → 请求转发 → 响应处理 → 计费结算
2. **关键拦截点**:
   - `middleware/distributor.go` - 渠道选择前
   - `controller/relay.go` - 请求转发前后
   - `service/billing.go` - 计费前后
3. **测试方法**: 使用 `./new-api` 本地运行, 添加测试 channel

### 安全注意事项

- 不要泄露用户 API Key
- 预扣费需要设置合理超时
- 渠道失败自动禁用需谨慎
- 日志需脱敏处理

---

> 文档版本: 1.0  
> 生成时间: 2025-07-08  
> 分析基于: Calcium-Ion/new-api (latest)