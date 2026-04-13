# T-006 增强用量统计数据模型 — 设计文档

> **任务**: PRJ-LITE999-T-006  
> **依赖**: T-001 (New-API 源码分析)  
> **目标**: 扩展统计表结构，增加成本、模型维度、时序数据字段

---

## 1. 现状分析

### 1.1 已有统计模型

New-API 已存在 **QuotaData** 表 (`model/usedata.go`)，结构如下：

| 字段 | 类型 | 说明 |
|------|------|------|
| **基础字段** | | |
| Id | int | 主键 |
| UserID | int | 用户 ID (索引) |
| Username | string | 用户名 (索引) |
| ModelName | string | 模型名 (索引) |
| CreatedAt | int64 | 小时桶时间戳 |
| TokenUsed | int | token 总数 |
| Count | int | 请求次数 |
| Quota | int | 消耗配额 |
| **成本维度** | | |
| PromptTokens | int | 输入 token |
| CompletionTokens | int | 输出 token |
| ModelRatio | float64 | 模型倍率 |
| CompletionRatio | float64 | 输出倍率 |
| **模型维度** | | |
| ChannelId | int | 渠道 ID (索引) |
| Group | string | 分组 (索引) |
| **时序数据** | | |
| AvgUseTime | int | 平均延迟 (毫秒) |
| MaxUseTime | int | 最大延迟 (毫秒) |
| StreamCount | int | 流式请求次数 |
| ErrorCount | int | 错误次数 |
| TotalUseTime | int | 总延迟 (用于计算平均值) |

### 1.2 现状评估

**已有字段已覆盖任务要求**:
- ✅ 成本维度: PromptTokens, CompletionTokens, ModelRatio, CompletionRatio
- ✅ 模型维度: ChannelId, Group, ModelName
- ✅ 时序数据: AvgUseTime, MaxUseTime, StreamCount, ErrorCount, TotalUseTime

### 1.3 增强需求

虽然核心字段已存在，可从以下维度进行扩展：

| 维度 | 现有 | 扩展建议 |
|------|------|----------|
| **成本增强** | ModelRatio, CompletionRatio | 增加 **上游成本** (上游花费)、**利润率**字段 |
| **模型增强** | ModelName, ChannelId | 增加 **模型类别** (文本/图像/音频)、**端点类型** |
| **时序增强** | 小时桶 | 支持 **分钟级** 粒度 (可选) |
| **请求元数据** | Count, TokenUsed | 增加 **首包延迟**、**错误类型分布** |

---

## 2. 扩展设计方案

### 2.1 扩展字段 (向后兼容)

```go
// model/usedata.go - QuotaData 扩展

type QuotaData struct {
    // ... 现有字段 ...

    // ---- 成本增强 ----
    UpstreamCost      float64 `json:"upstream_cost" gorm:"type:decimal(12,6);default:0"`    // 上游成本 (USD)
    ProfitMargin     float64 `json:"profit_margin" gorm:"type:decimal(5,2);default:0"`     // 利润率 %
    Currency         string  `json:"currency" gorm:"size:8;default:'USD'"`                // 货币类型

    // ---- 模型增强 ----
    ModelCategory    string  `json:"model_category" gorm:"size:32;default:''"`            // 模型类别: text/image/audio/video
    EndpointType     string  `json:"endpoint_type" gorm:"size:64;default:''"`            // 端点类型: chat/completion/embedding

    // ---- 时序增强 ----
    FirstResponseMs  int     `json:"first_response_ms" gorm:"default:0"`                   // 首包延迟 (毫秒)
    P95LatencyMs    int     `json:"p95_latency_ms" gorm:"default:0"`                     // P95 延迟
    SuccessCount    int     `json:"success_count" gorm:"default:0"`                       // 成功次数 (用于计算成功率)

    // ---- 请求元数据 ----
    ErrorTypeDetail string  `json:"error_type_detail" gorm:"size:256;default:''"`        // 错误类型详情 (JSON)
}
```

### 2.2 数据写入增强

**现有调用链路**:
```
请求完成 → PostTextConsumeQuota / PostAudioConsumeQuota → RecordConsumeLog → LogQuotaDataEx
```

**扩展 LogQuotaDataParams**:

```go
type LogQuotaDataParams struct {
    // ... 现有字段 ...
    
    // 扩展字段
    UpstreamCost     float64
    ModelCategory    string
    EndpointType     string
    FirstResponseMs  int
    P95LatencyMs     int
    ErrorType        string  // 错误类型: timeout/auth_error/rate_limit/server_error
}
```

**在 RecordConsumeLog 中扩展**:

```go
// service/quota.go 或 service/text_quota.go

model.RecordConsumeLog(ctx, relayInfo.UserId, model.RecordConsumeLogParams{
    // ... 现有字段 ...
    
    // 扩展
    UpstreamCost:    calculateUpstreamCost(usage, priceData),
    ModelCategory:   inferModelCategory(relayInfo.OriginModelName),
    EndpointType:    relayconstant.RelayModeToEndpointType(info.RelayMode),
    FirstResponseMs: relayInfo.FirstResponseTime.Sub(relayInfo.StartTime).Milliseconds(),
})
```

### 2.3 成本计算

**上游成本** 可通过以下方式获取：

| 来源 | 方式 | 精度 |
|------|------|------|
| **Response Header** | 厂商返回 `x-ratelimit-remaining-credits` 等 | 高 |
| **Response Body** | 解析 usage 后按官方定价计算 | 高 |
| **估算** | 按 input/output token 估算 | 中 |

```go
func calculateUpstreamCost(usage *dto.Usage, priceData types.PriceData) float64 {
    if priceData.ModelPrice > 0 && priceData.UsePrice {
        // 使用官方定价
        inputCost := float64(usage.PromptTokens) * priceData.ModelPrice / 1000000
        outputCost := float64(usage.CompletionTokens) * priceData.ModelPrice * priceData.CompletionRatio / 1000000
        return inputCost + outputCost
    }
    return 0
}
```

### 2.4 模型类别推断

```go
func inferModelCategory(modelName string) string {
    modelLower := strings.ToLower(modelName)
    
    // 图像生成
    if strings.Contains(modelLower, "dalle") || 
       strings.Contains(modelLower, "image") ||
       strings.Contains(modelLower, "stable-diffusion") {
        return "image"
    }
    
    // 音频
    if strings.Contains(modelLower, "tts") ||
       strings.Contains(modelLower, "whisper") ||
       strings.Contains(modelLower, "speech") {
        return "audio"
    }
    
    // 嵌入
    if strings.Contains(modelLower, "embedding") ||
       strings.Contains(modelLower, "embed") {
        return "embedding"
    }
    
    // 视频
    if strings.Contains(modelLower, "video") ||
       strings.Contains(modelLower, "sora") ||
       strings.Contains(modelLower, "kling") {
        return "video"
    }
    
    // 默认文本
    return "text"
}
```

---

## 3. 查询 API 扩展

### 3.1 现有 API

| 路由 | 方法 | 功能 |
|------|------|------|
| `GET /api/data` | Admin | 按模型聚合 |
| `GET /api/data/users` | Admin | 按用户聚合 |
| `GET /api/data/self` | User | 用户自查 |

### 3.2 扩展查询参数

```go
// controller/usedata.go

func GetAllQuotaDates(c *gin.Context) {
    // 现有参数
    startTimestamp := c.GetInt64("start_timestamp")
    endTimestamp := c.GetInt64("end_timestamp")
    username := c.Query("username")
    
    // 新增参数
    modelCategory := c.Query("model_category")  // text/image/audio/video
    channelId := c.GetInt("channel_id")
    group := c.Query("group")
    
    dates, err := model.GetAllQuotaDatesExt(startTimestamp, endTimestamp, username, modelCategory, channelId, group)
    // ...
}
```

### 3.3 新增聚合维度

```go
func GetAllQuotaDatesExt(startTime, endTime int64, username, modelCategory string, channelId int, group string) ([]*QuotaData, error) {
    tx := DB.Table("quota_data").
        Select("model_name, created_at, " +
            "sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, " +
            "sum(prompt_tokens) as prompt_tokens, sum(completion_tokens) as completion_tokens, " +
            "sum(stream_count) as stream_count, sum(error_count) as error_count, " +
            "sum(total_use_time) as total_use_time, " +
            "CASE WHEN sum(count) > 0 THEN sum(total_use_time) / sum(count) ELSE 0 END as avg_use_time, " +
            // 扩展字段
            "SUM(upstream_cost) as upstream_cost, " +
            "AVG(profit_margin) as profit_margin, " +
            "MAX(model_category) as model_category, " +
            "MAX(endpoint_type) as endpoint_type").
        Where("created_at >= ? AND created_at <= ?", startTime, endTime)
    
    if username != "" {
        tx = tx.Where("username = ?", username)
    }
    if modelCategory != "" {
        tx = tx.Where("model_category = ?", modelCategory)
    }
    if channelId > 0 {
        tx = tx.Where("channel_id = ?", channelId)
    }
    if group != "" {
        tx = tx.Where("group = ?", group)
    }
    
    return tx.Group("model_name, created_at").Find(&quotaDatas)
}
```

---

## 4. 实现清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `model/usedata.go` | 修改 | 扩展 QuotaData 结构体 + 新增字段 |
| `model/log.go` | 修改 | RecordConsumeLogParams 扩展字段 |
| `service/quota.go` | 修改 | 调用时传入扩展参数 (上游成本等) |
| `service/log_info_generate.go` | 修改 | 生成扩展字段 (model_category 等) |
| `controller/usedata.go` | 修改 | 新增查询参数 (model_category 等) |
| `router/api-router.go` | 修改 | 路由不变，参数扩展 |

---

## 5. 兼容性

- **向后兼容**: 所有新字段带默认值 `default:0` 或 `default:''`
- **渐进式迁移**: 存量数据新字段为空，不影响现有报表
- **GORM AutoMigrate**: 新字段会自动添加到数据库

---

## 6. 数据流

```
用户请求 → Relay → Adaptor → 上游
                         ↓
                   PostTextConsumeQuota
                         ↓
                   RecordConsumeLog
                         ↓
                   LogQuotaDataEx(扩展参数)
                         ↓
                   CacheQuotaData (内存)
                         ↓ (每5分钟)
                   SaveQuotaDataCache → DB
```

---

> 文档版本: 1.0  
> 生成时间: 2025-07-11  
> 基于: T-001 架构分析 + new-api 源码
