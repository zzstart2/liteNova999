# T-009 智能 Fallback 策略实现 — 设计文档

> **任务**: PRJ-LITE999-T-009  
> **依赖**: T-008 (多服务商健康检查机制)  
> **目标**: 同模型跨服务商智能切换、熔断、恢复策略

---

## 1. 现状分析

### 1.1 现有 Fallback 机制

**核心转发链** (`controller/relay.go` Relay 函数):

```
for retry = 0; retry <= RetryTimes; retry++ {
    channel = getChannel(c, relayInfo, retryParam)   // 选渠道
    newAPIError = relayHandler(c, relayInfo)          // 转发
    if newAPIError == nil { return }                  // 成功 → 返回
    processChannelError(...)                          // 错误处理
    if !shouldRetry(...) { break }                    // 判断是否重试
}
```

**渠道选择** (`model/channel_cache.go` GetRandomSatisfiedChannel):

```
1. 按 group + model 查找候选渠道列表
2. 按 Priority 降序排列去重 → sortedUniquePriorities
3. retry 值映射到优先级层: targetPriority = priorities[retry]
4. 同优先级内按 Weight 加权随机选一个
```

**跨组切换** (`service/channel_select.go` CacheGetRandomSatisfiedChannel):

```
TokenGroup == "auto" 时:
  遍历 autoGroups → 每组用完所有 Priority → 切换下一组
  通过 ContextKeyAutoGroupIndex 跟踪当前组
```

### 1.2 已有能力清单

| 能力 | 现状 | 位置 |
|------|------|------|
| **Priority 降级** | ✅ retry=N 对应第 N 优先级层 | `GetRandomSatisfiedChannel` |
| **Weight 加权** | ✅ 同优先级内按静态 Weight 随机 | `GetRandomSatisfiedChannel` |
| **跨组切换** | ✅ auto 模式下遍历多组 | `CacheGetRandomSatisfiedChannel` |
| **重试判断** | ✅ 基于 HTTP status code 范围 | `shouldRetry` + `status_code_ranges.go` |
| **自动禁用** | ✅ 特定错误类型 (401/403 等) 禁用渠道 | `ShouldDisableChannel` |
| **自动恢复** | ✅ 测试通过时重新启用 | `ShouldEnableChannel` |
| **渠道亲和** | ✅ 可选的 sticky session | `channel_affinity.go` |
| **健康记录** | ✅ 被动记录请求结果到内存 | `RecordChannelRequest` |

### 1.3 核心缺陷

| 缺陷 | 影响 | 严重程度 |
|------|------|----------|
| **1. retry = Priority 层，非渠道排除** | 同优先级有 3 个渠道，失败的渠道下次 retry 可能再次被选中 | 🔴 高 |
| **2. 无已试渠道排除** | retry 循环内无法排除刚失败的渠道 ID | 🔴 高 |
| **3. Weight 不感知健康** | 健康渠道和不健康渠道获得相同流量比例 | 🟡 中 |
| **4. 无熔断状态** | 渠道反复 500 但未触发 AutoBan 时持续被选中 | 🟡 中 |
| **5. 恢复无渐进** | 渠道恢复后立即全量放流 | 🟡 中 |
| **6. 无 Fallback 策略可配** | 重试次数/策略全局统一，无法按模型/组定制 | 🟡 中 |

---

## 2. 目标架构

```
请求到达
    │
    ▼
┌──────────────────────────────────────────────────┐
│              Smart Fallback Controller            │
│                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────┐│
│  │  Candidate   │  │   Health     │  │ Circuit  ││
│  │  Selector    │──│   Scorer     │──│ Breaker  ││
│  │  (排除+排序) │  │ (T-008窗口)  │  │(T-008 CB)││
│  └──────┬──────┘  └──────────────┘  └──────────┘│
│         │                                        │
│  ┌──────▼──────┐  ┌──────────────┐              │
│  │  Weighted   │  │   Fallback   │              │
│  │  Picker     │──│   Policy     │              │
│  │ (动态权重)   │  │  (策略配置)   │              │
│  └──────┬──────┘  └──────────────┘              │
│         │                                        │
└─────────┼────────────────────────────────────────┘
          ▼
    选中渠道 → Relay → 成功/失败 → 反馈健康数据
```

---

## 3. 详细设计

### 3.1 已试渠道排除 (Tried-Channel Exclusion)

**问题**: 现有 retry 循环中，同优先级有多个渠道时，失败渠道可能被再次选中。

**方案**: 在选渠道时传入已试渠道 ID 集合，排除后再做加权随机。

```go
// model/channel_cache.go — 新增函数

func GetRandomSatisfiedChannelExcluding(
    group string,
    model string,
    retry int,
    excludeIds map[int]bool,  // 新增: 已试渠道集合
) (*Channel, error) {
    // ... 现有逻辑直到 targetChannels 构建完成 ...

    // 过滤已试渠道
    var filtered []*Channel
    var filteredWeight int
    for _, ch := range targetChannels {
        if !excludeIds[ch.Id] {
            filtered = append(filtered, ch)
            filteredWeight += ch.GetWeight()
        }
    }

    // 如果全部被排除，回退到原始列表（宁可重试已试渠道，也不返回 nil）
    if len(filtered) == 0 {
        filtered = targetChannels
        filteredWeight = sumWeight
    }

    // 在 filtered 中做加权随机 (逻辑同现有)
    // ...
}
```

**调用侧修改** (`controller/relay.go`):

```go
// 在 retry 循环开始前
triedChannels := make(map[int]bool)

// 每次选渠道成功后
triedChannels[channel.Id] = true
```

### 3.2 健康感知加权选择 (Health-Aware Weighted Picker)

**依赖**: T-008 的 SlidingWindow + CalculateRealtimeHealthScore

**方案**: 在加权随机时，将静态 Weight 乘以健康乘数。

```go
// service/health_weight.go (T-008 设计)

func GetHealthMultiplier(channelId int) float64 {
    cb := GetCircuitBreaker(channelId)
    switch cb.State() {
    case StateOpen:
        return 0.0    // 熔断: 不分配流量
    case StateHalfOpen:
        return 0.05   // 半开: 极少探测流量
    case StateClosed:
        metrics := GetWindowMetrics(channelId)
        if metrics == nil || metrics.RequestCount < MinSampleSize {
            return 1.0 // 样本不足: 满权重
        }
        score := CalculateRealtimeHealthScore(metrics)
        return 0.1 + 0.9*float64(score)/100.0
    }
    return 1.0
}
```

**集成到 GetRandomSatisfiedChannelExcluding**:

```go
for _, ch := range filtered {
    multiplier := GetHealthMultiplier(ch.Id)
    effectiveWeight := int(float64(ch.GetWeight()) * multiplier)
    if effectiveWeight < 1 && multiplier > 0 {
        effectiveWeight = 1 // 保底: 非熔断渠道至少有 1 权重
    }
    totalWeight += effectiveWeight
    // ...
}
```

### 3.3 智能 Fallback 策略引擎

**文件**: `service/fallback_policy.go` (新增)

```go
// FallbackPolicy 定义 Fallback 行为
type FallbackPolicy struct {
    // 基础策略
    MaxRetries        int           // 最大重试次数 (覆盖全局 RetryTimes)
    RetryDelay        time.Duration // 重试间隔 (默认 0)

    // 优先级策略
    PriorityMode      PriorityMode  // priority_first | health_first | round_robin
    ExcludeTried      bool          // 排除已试渠道 (默认 true)

    // 熔断策略 (继承 T-008)
    CircuitBreakerEnabled bool
    SkipOpenCircuit       bool      // 跳过熔断中的渠道 (默认 true)

    // 超时策略
    PerAttemptTimeout time.Duration // 单次尝试超时
    TotalTimeout      time.Duration // 总超时 (包含所有重试)
}

type PriorityMode int
const (
    PriorityFirst PriorityMode = iota  // 先用完高优先级再降级 (现有行为)
    HealthFirst                        // 按健康分排序，忽略静态优先级
    Adaptive                           // 高优先级 + 健康分加权混合
)
```

**策略解析** — 可按组/模型配置:

```go
// 获取策略: 模型级 > 组级 > 全局默认
func GetFallbackPolicy(group string, modelName string) *FallbackPolicy {
    // 1. 检查模型级配置
    if policy, ok := modelPolicies[modelName]; ok {
        return policy
    }
    // 2. 检查组级配置
    if policy, ok := groupPolicies[group]; ok {
        return policy
    }
    // 3. 返回全局默认
    return defaultPolicy
}

var defaultPolicy = &FallbackPolicy{
    MaxRetries:            common.RetryTimes,  // 兼容现有配置
    PriorityMode:          Adaptive,
    ExcludeTried:          true,
    CircuitBreakerEnabled: true,
    SkipOpenCircuit:       true,
}
```

### 3.4 改造后的 Retry 循环

**修改**: `controller/relay.go` 的 Relay 函数核心循环

```go
func Relay(c *gin.Context, relayFormat types.RelayFormat) {
    // ... 现有前置逻辑 (request 解析、relayInfo、计费) ...

    policy := service.GetFallbackPolicy(relayInfo.TokenGroup, relayInfo.OriginModelName)
    maxRetries := policy.MaxRetries
    triedChannels := make(map[int]bool)

    var totalDeadline time.Time
    if policy.TotalTimeout > 0 {
        totalDeadline = time.Now().Add(policy.TotalTimeout)
    }

    retryParam := &service.RetryParam{
        Ctx:        c,
        TokenGroup: relayInfo.TokenGroup,
        ModelName:  relayInfo.OriginModelName,
        Retry:      common.GetPointer(0),
    }

    for ; retryParam.GetRetry() <= maxRetries; retryParam.IncreaseRetry() {
        // 总超时检查
        if !totalDeadline.IsZero() && time.Now().After(totalDeadline) {
            newAPIError = types.NewError(
                fmt.Errorf("total fallback timeout exceeded"),
                types.ErrorCodeRequestTimeout,
            )
            break
        }

        // 选渠道 (带排除 + 健康感知)
        channel, channelErr := getChannelSmart(c, relayInfo, retryParam, triedChannels, policy)
        if channelErr != nil {
            newAPIError = channelErr
            break
        }

        triedChannels[channel.Id] = true
        relayInfo.RetryIndex = retryParam.GetRetry()
        relayInfo.StartTime = time.Now()

        // 重试延迟
        if retryParam.GetRetry() > 0 && policy.RetryDelay > 0 {
            time.Sleep(policy.RetryDelay)
        }

        // ... 现有 body reset + relay handler 调用 ...

        newAPIError = doRelay(c, relayInfo, relayFormat)

        if newAPIError == nil {
            // 成功: 记录健康 + 返回
            recordSuccess(channel, relayInfo)
            return
        }

        // 失败: 记录健康 + 反馈熔断器 + 处理错误
        recordFailure(channel, relayInfo, newAPIError)
        processChannelError(c, channelError, newAPIError)

        if !shouldRetry(c, newAPIError, maxRetries-retryParam.GetRetry()) {
            break
        }
    }
    // ... 现有错误返回逻辑 ...
}
```

**getChannelSmart**: 在现有 getChannel 基础上增加排除和策略

```go
func getChannelSmart(
    c *gin.Context,
    info *relaycommon.RelayInfo,
    retryParam *service.RetryParam,
    triedChannels map[int]bool,
    policy *service.FallbackPolicy,
) (*model.Channel, *types.NewAPIError) {

    // 注入排除列表到 context
    if policy.ExcludeTried {
        common.SetContextKey(c, constant.ContextKeyExcludeChannelIds, triedChannels)
    }

    // 注入策略模式到 context
    common.SetContextKey(c, constant.ContextKeyPriorityMode, policy.PriorityMode)
    common.SetContextKey(c, constant.ContextKeySkipOpenCircuit, policy.SkipOpenCircuit)

    return getChannel(c, info, retryParam)
}
```

### 3.5 渐进恢复 (Gradual Recovery)

**依赖**: T-008 的 CircuitBreaker HalfOpen 状态

**方案**: HalfOpen 状态的渠道获得极低权重 (5%)，连续成功 N 次后恢复到 Closed。

```
                 ┌─────────┐
                 │ Closed  │ ← 正常运行，healthMultiplier = 0.1~1.0
                 └────┬────┘
                      │ errorRate > threshold && count >= minRequests
                      ▼
                 ┌─────────┐
                 │  Open   │ ← 熔断，healthMultiplier = 0.0
                 └────┬────┘
                      │ openDuration 到期
                      ▼
                 ┌─────────┐
                 │HalfOpen │ ← 探测，healthMultiplier = 0.05
                 └────┬────┘
                      │
           ┌──────────┼──────────┐
           │ 连续成功 N 次       │ 任一失败
           ▼                     ▼
      ┌─────────┐         ┌─────────┐
      │ Closed  │         │  Open   │ (重新计时)
      └─────────┘         └─────────┘
```

**恢复后权重爬坡**: 从 HalfOpen 恢复到 Closed 后，不立即给满权重。

```go
func GetHealthMultiplier(channelId int) float64 {
    cb := GetCircuitBreaker(channelId)

    switch cb.State() {
    case StateOpen:
        return 0.0
    case StateHalfOpen:
        return 0.05
    case StateClosed:
        // 检查是否刚从 HalfOpen 恢复
        if cb.RecoveredAt != nil {
            elapsed := time.Since(*cb.RecoveredAt)
            rampUpDuration := 5 * time.Minute
            if elapsed < rampUpDuration {
                // 线性爬坡: 0.3 → 1.0 (5 分钟内)
                base := 0.3
                rampUp := 0.7 * (float64(elapsed) / float64(rampUpDuration))
                healthBase := base + rampUp
                return healthBase * windowScore(channelId)
            }
        }
        return windowScore(channelId)
    }
    return 1.0
}

func windowScore(channelId int) float64 {
    metrics := GetWindowMetrics(channelId)
    if metrics == nil || metrics.RequestCount < MinSampleSize {
        return 1.0
    }
    score := CalculateRealtimeHealthScore(metrics)
    return 0.1 + 0.9*float64(score)/100.0
}
```

---

## 4. 数据流全景

```
请求到达
    │
    ▼
[TokenAuth → Distribute]
    │
    ▼
GetFallbackPolicy(group, model)  ← 策略配置
    │
    ▼
┌───────── Retry Loop (maxRetries) ─────────┐
│                                            │
│  GetRandomSatisfiedChannelExcluding()      │
│    ├── 排除 triedChannels                  │
│    ├── 排除 CircuitBreaker.StateOpen       │
│    ├── Weight × HealthMultiplier           │
│    └── 加权随机选中渠道                     │
│                                            │
│  Relay → Adaptor → 上游                    │
│    │                                       │
│    ├── 成功:                               │
│    │   ├── CircuitBreaker.RecordSuccess()  │
│    │   ├── SlidingWindow.Record()          │
│    │   └── return                          │
│    │                                       │
│    └── 失败:                               │
│        ├── CircuitBreaker.RecordFailure()  │
│        ├── SlidingWindow.Record()          │
│        ├── processChannelError()           │
│        ├── triedChannels[id] = true        │
│        └── shouldRetry() → continue/break  │
│                                            │
└────────────────────────────────────────────┘
```

---

## 5. 实现文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `service/fallback_policy.go` | **新增** | FallbackPolicy 定义 + 策略解析 |
| `model/channel_cache.go` | **修改** | 新增 GetRandomSatisfiedChannelExcluding (排除 + 健康加权) |
| `controller/relay.go` | **修改** | retry 循环集成 policy + triedChannels + getChannelSmart |
| `service/channel_select.go` | **修改** | CacheGetRandomSatisfiedChannel 支持 excludeIds 参数 |
| `service/health_weight.go` | **新增**(T-008) | GetHealthMultiplier + 渐进恢复爬坡 |
| `service/circuit_breaker.go` | **新增**(T-008) | 熔断器状态机 (本任务增加 RecoveredAt 字段) |
| `setting/operation_setting/fallback_setting.go` | **新增** | Fallback 策略配置项 |
| `router/api-router.go` | **修改** | 注册策略配置 API |

---

## 6. 与现有机制兼容性

| 现有机制 | 兼容方式 |
|----------|----------|
| **RetryTimes 全局变量** | defaultPolicy.MaxRetries 默认值 = common.RetryTimes |
| **Priority 降级** | PriorityMode = PriorityFirst 时行为完全一致 |
| **Weight 加权** | 未启用健康权重时 multiplier = 1.0，行为一致 |
| **auto 跨组切换** | 不受影响，组内渠道选择逻辑增强 |
| **shouldRetry 判断** | 保留现有 status code 范围判断逻辑 |
| **AutoBan** | 保留现有硬故障禁用逻辑，与熔断互补 |
| **channel_affinity** | 亲和性优先于 Fallback；亲和渠道失败后才进入 Fallback |

**零影响升级**: 默认 Policy 的行为与现有逻辑完全一致 (PriorityFirst + ExcludeTried=true)。新功能 (健康权重/熔断/渐进恢复) 仅在管理员显式启用后生效。

---

## 7. 测试矩阵

| 场景 | 输入 | 期望行为 |
|------|------|----------|
| 基本降级 | 高优先级渠道全失败 | 自动降级到低优先级 |
| 已试排除 | 同优先级 3 渠道，A 失败 | retry 时不再选 A |
| 全部排除回退 | 同优先级所有渠道都失败 | 回退到原始列表（允许重试） |
| 熔断跳过 | 渠道 A 处于 Open 状态 | 选渠道时跳过 A |
| 半开探测 | 渠道 A 处于 HalfOpen | 以 5% 概率被选中 |
| 渐进恢复 | 渠道 A 刚从 HalfOpen→Closed | 权重从 30% 线性爬升到 100% |
| 健康加权 | 渠道 A 错误率 50%，B 正常 | B 获得显著更多流量 |
| 跨组 Fallback | auto 模式，GroupA 全失败 | 切换到 GroupB |
| 总超时 | TotalTimeout = 10s | 超过 10s 后停止重试 |
| 策略降级 | 模型无专属策略 | 回退到组级 → 全局默认 |

---

> 文档版本: 1.0  
> 生成时间: 2025-07-11  
> 基于: T-001 架构分析 + T-008 健康检查设计 + new-api 源码
