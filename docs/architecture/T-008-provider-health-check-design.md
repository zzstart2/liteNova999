# T-008 多服务商健康检查机制 — 设计文档

> **任务**: PRJ-LITE999-T-008  
> **依赖**: T-001 (New-API 源码分析)  
> **目标**: 在现有被动指标采集基础上，构建完整的主动+被动健康检查体系，支持响应时间、错误率、可用性检测，并将健康分数反馈到渠道选择权重

---

## 1. 现状分析

### 1.1 已有能力（来自 T-001 分析 + 源码验证）

| 能力 | 现状 | 位置 | 不足 |
|------|------|------|------|
| **被动指标采集** | ✅ 每次请求记录延迟/错误/超时到内存 Snapshot | `model/channel_health.go` RecordChannelRequest() | 仅按小时聚合落盘，无实时窗口评分 |
| **定时落盘** | ✅ 每5分钟 FlushHealthCache → DB 小时桶 | `model/channel_health.go` RunHealthDataFlusher() | 只做持久化，不触发任何响应动作 |
| **健康分数** | ✅ 静态公式 CalculateHealthScore() | `model/channel_health.go` | 仅在查询 API 时计算，未参与路由选择 |
| **主动测试** | ✅ 定时 testAllChannels() 遍历所有渠道 | `controller/channel-test.go` AutomaticallyTestChannels() | 单线程串行，无并发控制；只测连通性，不测延迟SLA |
| **自动禁用** | ✅ ShouldDisableChannel() 基于错误类型 | `service/channel.go` | 单次触发，无滑动窗口熔断；禁用后仅靠测试恢复 |
| **自动恢复** | ✅ ShouldEnableChannel() 测试通过时恢复 | `service/channel.go` | 无半开状态，恢复后立即全量放流 |
| **渠道选择** | ✅ Priority 分组 + Weight 加权随机 | `model/channel_cache.go` GetRandomSatisfiedChannel() | Weight 是静态配置，不根据健康度动态调整 |
| **查询 API** | ✅ GET /channel/health[/:id] | `controller/channel_health.go` | 只读展示，不影响路由 |

### 1.2 核心缺失

1. **无实时滑动窗口** — 内存 Snapshot 在 Flush 时清空，无法保留近 N 分钟的实时指标
2. **无熔断器** — 没有 circuit breaker 状态机，错误累积不触发自动降级
3. **健康分数不参与路由** — CalculateHealthScore() 仅用于 API 展示
4. **无半开探测** — 渠道被禁用后，只能靠全量测试恢复，无 trial 放量
5. **主动测试无并发** — 串行遍历所有渠道，大量渠道时测试周期过长

---

## 2. 目标架构

```
                        ┌─────────────────────────────────────┐
                        │         Health Check System         │
                        │                                     │
  ┌─────────┐    ┌──────┴───────┐   ┌──────────────┐   ┌─────┴──────┐
  │ Passive  │    │   Sliding    │   │   Circuit    │   │  Active    │
  │ Metrics  │───▶│   Window     │──▶│   Breaker    │   │  Prober   │
  │ (per-req)│    │ (real-time)  │   │  (per-chan)  │   │ (periodic) │
  └─────────┘    └──────┬───────┘   └──────┬───────┘   └─────┬──────┘
                        │                   │                  │
                        ▼                   ▼                  ▼
                 ┌──────────────────────────────────────────────────┐
                 │          Dynamic Weight Calculator                │
                 │   healthScore → effectiveWeight adjustment       │
                 └──────────────────────┬───────────────────────────┘
                                        │
                                        ▼
                 ┌──────────────────────────────────────────────────┐
                 │      GetRandomSatisfiedChannel (enhanced)       │
                 │   weight = staticWeight × healthMultiplier      │
                 └──────────────────────────────────────────────────┘
```

---

## 3. 详细设计

### 3.1 实时滑动窗口 (Sliding Window)

**文件**: `model/channel_health_window.go` (新增)

```go
// SlidingWindowConfig 滑动窗口配置
type SlidingWindowConfig struct {
    WindowSize    time.Duration // 窗口大小，默认 5 分钟
    BucketCount   int           // 桶数量，默认 10（每桶 30 秒）
    MinSampleSize int           // 最小样本量，低于此值不计算评分，默认 5
}

// ChannelWindowMetrics 单个渠道的实时窗口指标
type ChannelWindowMetrics struct {
    ChannelId      int
    RequestCount   int64
    ErrorCount     int64
    TimeoutCount   int64
    TotalLatencyMs int64
    MaxLatencyMs   int64

    // 计算字段
    ErrorRate      float64   // ErrorCount / RequestCount
    AvgLatencyMs   int64     // TotalLatencyMs / RequestCount
    P99LatencyMs   int64     // 近似 P99（基于桶内最大值）
    HealthScore    int       // 0-100 实时健康分
    LastUpdateAt   time.Time
}

// windowBucket 单个时间桶
type windowBucket struct {
    startTime      time.Time
    requestCount   int64
    errorCount     int64
    timeoutCount   int64
    totalLatencyMs int64
    maxLatencyMs   int64
}

// SlidingWindow 基于环形缓冲区的滑动窗口
type SlidingWindow struct {
    mu        sync.RWMutex
    buckets   []windowBucket
    bucketDur time.Duration
    headIdx   int           // 当前写入桶
    lastTick  time.Time     // 上次推进时间
}
```

**设计要点**:
- 每个 channel 持有一个 `SlidingWindow` 实例，存放于 `map[int]*SlidingWindow`
- 在 `RecordChannelRequest()` 中同时写入现有 Snapshot（用于 DB 落盘）和 SlidingWindow（用于实时评分）
- `GetWindowMetrics(channelId)` 返回当前窗口的聚合指标，O(bucketCount) 复杂度
- 过期桶自动在下一次写入时回收（lazy advance）

**为什么不用现有 Snapshot？**  
Snapshot 在 FlushHealthCache() 时被清空重建，Flush 间隔内的数据是累加的但 Flush 后归零，不适合做连续实时评分。SlidingWindow 与 Flush 解耦，始终保持最近 N 分钟的数据。

---

### 3.2 熔断器 (Circuit Breaker)

**文件**: `service/circuit_breaker.go` (新增)

```go
// 状态机: Closed → Open → HalfOpen → Closed/Open
type CircuitState int

const (
    StateClosed   CircuitState = iota // 正常放行
    StateOpen                         // 熔断，拒绝请求
    StateHalfOpen                     // 半开，允许试探流量
)

type CircuitBreakerConfig struct {
    ErrorThreshold    float64       // 错误率阈值触发熔断, 默认 0.5 (50%)
    MinRequestCount   int           // 最小请求数才评估, 默认 10
    OpenDuration      time.Duration // Open 状态持续时间, 默认 60s
    HalfOpenMaxReqs   int           // HalfOpen 允许的探测请求数, 默认 3
    HalfOpenSuccessN  int           // HalfOpen 连续成功 N 次恢复, 默认 2
    TimeoutThresholdMs int64        // 超时阈值(ms), 超过算慢请求, 默认 10000
    SlowRateThreshold float64       // 慢请求比例阈值, 默认 0.8
}

type CircuitBreaker struct {
    mu              sync.RWMutex
    state           CircuitState
    openedAt        time.Time
    halfOpenReqs    int
    halfOpenSuccess int
    config          CircuitBreakerConfig
}

// 状态转换规则:
//
// Closed:
//   滑动窗口内 errorRate > ErrorThreshold && requestCount >= MinRequestCount
//   → 转 Open, 记录 openedAt
//
// Open:
//   time.Since(openedAt) > OpenDuration
//   → 转 HalfOpen, 重置计数器
//
// HalfOpen:
//   允许最多 HalfOpenMaxReqs 个请求通过
//   - 连续成功 HalfOpenSuccessN 次 → 转 Closed
//   - 任一失败 → 转 Open, 重新开始计时

func (cb *CircuitBreaker) Allow() bool          // 检查是否允许请求通过
func (cb *CircuitBreaker) RecordSuccess()        // 记录成功
func (cb *CircuitBreaker) RecordFailure()        // 记录失败
func (cb *CircuitBreaker) State() CircuitState   // 当前状态
func (cb *CircuitBreaker) Reset()                // 手动重置
```

**管理器**:

```go
// CircuitBreakerManager 全局熔断器管理
type CircuitBreakerManager struct {
    mu       sync.RWMutex
    breakers map[int]*CircuitBreaker // channelId → breaker
    config   CircuitBreakerConfig
}

var globalCBManager *CircuitBreakerManager

func GetCircuitBreaker(channelId int) *CircuitBreaker
func EvaluateCircuitBreakers()  // 定期根据滑动窗口指标评估所有 breaker 状态
```

**集成点**:
- `GetRandomSatisfiedChannel()` 在选渠道时，跳过 StateOpen 的渠道
- `controller/relay.go` 请求结束后调用 `RecordSuccess/RecordFailure`
- HalfOpen 状态的渠道仍参与选择但权重极低（仅用于探测）

---

### 3.3 动态权重计算器 (Health-Weighted Routing)

**文件**: `service/health_weight.go` (新增)

**核心思路**: 保留用户配置的 staticWeight 不变，在路由选择时乘以健康乘数。

```go
// GetHealthMultiplier 返回 0.0 ~ 1.0 之间的健康乘数
func GetHealthMultiplier(channelId int) float64 {
    cb := GetCircuitBreaker(channelId)

    switch cb.State() {
    case StateOpen:
        return 0.0   // 熔断中，不分配流量
    case StateHalfOpen:
        return 0.05  // 半开探测，极小流量
    case StateClosed:
        // 基于实时健康分计算乘数
        metrics := GetWindowMetrics(channelId)
        if metrics == nil || metrics.RequestCount < MinSampleSize {
            return 1.0 // 样本不足，使用满权重
        }
        score := CalculateRealtimeHealthScore(metrics)
        // score 0~100 映射到 multiplier 0.1~1.0
        // 保证不完全归零（避免永远选不到该渠道）
        return 0.1 + 0.9*float64(score)/100.0
    }
    return 1.0
}

// CalculateRealtimeHealthScore 基于实时窗口指标的健康分计算
// 与现有 CalculateHealthScore 保持兼容的打分逻辑，但使用实时数据
func CalculateRealtimeHealthScore(m *ChannelWindowMetrics) int {
    // 错误率组件: 40 分
    errorScore := 40.0 * (1.0 - m.ErrorRate)

    // 延迟组件: 30 分 (P99 < 2s 满分, > 15s 零分)
    latencyScore := 30.0
    if m.P99LatencyMs > 2000 {
        latencyScore = 30.0 * (1.0 - float64(m.P99LatencyMs-2000)/13000.0)
        if latencyScore < 0 { latencyScore = 0 }
    }

    // 超时组件: 30 分
    timeoutRate := float64(m.TimeoutCount) / float64(m.RequestCount)
    timeoutScore := 30.0 * (1.0 - timeoutRate*5) // 20% 超时 = 0 分
    if timeoutScore < 0 { timeoutScore = 0 }

    return clamp(int(errorScore + latencyScore + timeoutScore), 0, 100)
}
```

**修改 `GetRandomSatisfiedChannel`**:

```go
// model/channel_cache.go — 在权重随机选择时应用健康乘数

// 现有逻辑:
//   randomWeight -= channel.GetWeight() * smoothingFactor + smoothingAdjustment

// 改为:
//   healthMultiplier := service.GetHealthMultiplier(channel.Id)
//   effectiveWeight := int(float64(channel.GetWeight()) * healthMultiplier)
//   randomWeight -= effectiveWeight * smoothingFactor + smoothingAdjustment
```

**效果**: 健康的渠道权重不变（multiplier ≈ 1.0），不健康的渠道权重降低，熔断的渠道权重归零。静态优先级 (Priority) 仍然优先于动态权重——同优先级内才根据健康度加权分配。

---

### 3.4 主动探测增强 (Active Prober)

**文件**: `service/active_prober.go` (新增)

改造现有 `AutomaticallyTestChannels()` + `testAllChannels()`：

```go
type ActiveProberConfig struct {
    Enabled          bool          // 是否启用
    IntervalMinutes  float64       // 探测间隔, 默认 5
    Concurrency      int           // 并发探测数, 默认 5
    TimeoutSeconds   int           // 单次探测超时, 默认 30
    PriorityProbe    bool          // 优先探测不健康渠道, 默认 true
    ProbeOpenCircuit bool          // 是否探测熔断渠道, 默认 true
}

type ProbeResult struct {
    ChannelId    int
    Success      bool
    LatencyMs    int64
    Error        string
    Timestamp    time.Time
}
```

**改进点**:

1. **并发探测**: 用 worker pool (大小可配, 默认 5) 替代串行遍历
2. **优先级调度**: 不健康/Open 状态的渠道优先探测
3. **结果反馈**:
   - 探测成功 → 调用 CircuitBreaker.RecordSuccess()
   - 探测失败 → 调用 CircuitBreaker.RecordFailure()
   - 同时写入 RecordChannelRequest() 更新滑动窗口
4. **频率分层**:
   - 健康渠道: 每 intervalMinutes 探测一次
   - 不健康/HalfOpen 渠道: 每 intervalMinutes/3 探测一次
   - Open 渠道: 仅在 OpenDuration 到期后探测

---

### 3.5 配置模型扩展

**文件**: `setting/operation_setting/monitor_setting.go` (扩展)

```go
type MonitorSetting struct {
    // 原有字段
    AutoTestChannelEnabled bool    `json:"auto_test_channel_enabled"`
    AutoTestChannelMinutes float64 `json:"auto_test_channel_minutes"`

    // ---- 新增字段 ----

    // 滑动窗口
    HealthWindowMinutes int `json:"health_window_minutes"` // 默认 5
    HealthWindowBuckets int `json:"health_window_buckets"` // 默认 10
    HealthMinSamples    int `json:"health_min_samples"`    // 默认 5

    // 熔断器
    CircuitBreakerEnabled     bool    `json:"circuit_breaker_enabled"`      // 默认 false
    CircuitErrorThreshold     float64 `json:"circuit_error_threshold"`      // 默认 0.5
    CircuitMinRequests        int     `json:"circuit_min_requests"`         // 默认 10
    CircuitOpenSeconds        int     `json:"circuit_open_seconds"`         // 默认 60
    CircuitHalfOpenMaxReqs    int     `json:"circuit_half_open_max_reqs"`   // 默认 3
    CircuitHalfOpenSuccessN   int     `json:"circuit_half_open_success_n"`  // 默认 2

    // 动态权重
    HealthWeightEnabled bool `json:"health_weight_enabled"` // 默认 false

    // 主动探测
    ProbeConcurrency int `json:"probe_concurrency"` // 默认 5
    ProbeTimeoutSec  int `json:"probe_timeout_sec"`  // 默认 30
}
```

所有新增功能默认 **关闭 (false)**，存量部署零影响。管理员通过 Web UI 或 API 按需启用。

---

### 3.6 API 扩展

**路由**: 在现有 `/api/channel/health` 基础上扩展

| 路由 | 方法 | 说明 |
|------|------|------|
| `GET /api/channel/health` | GET | 现有, 增加 `realtime_score` 字段 |
| `GET /api/channel/health/:id` | GET | 现有, 增加窗口指标 + 熔断状态 |
| `GET /api/channel/health/:id/circuit` | GET | **新增** 查看熔断器状态详情 |
| `POST /api/channel/health/:id/circuit/reset` | POST | **新增** 手动重置熔断器 |
| `GET /api/channel/health/realtime` | GET | **新增** 所有渠道实时窗口指标快照 |
| `GET /api/channel/health/config` | GET | **新增** 查看健康检查配置 |
| `PUT /api/channel/health/config` | PUT | **新增** 更新健康检查配置 |

**`GET /api/channel/health/:id` 增强响应**:

```json
{
  "success": true,
  "data": {
    "channel_id": 5,
    "channel_name": "OpenAI-Primary",
    "channel_type": 1,
    "status": 1,

    "historical": { ... },

    "realtime": {
      "window_minutes": 5,
      "request_count": 127,
      "error_count": 3,
      "timeout_count": 1,
      "error_rate": 0.0236,
      "avg_latency_ms": 820,
      "p99_latency_ms": 2340,
      "health_score": 89,
      "health_multiplier": 0.901
    },

    "circuit_breaker": {
      "state": "closed",
      "opened_at": null,
      "half_open_reqs": 0,
      "half_open_success": 0,
      "config": {
        "error_threshold": 0.5,
        "min_requests": 10,
        "open_seconds": 60
      }
    }
  }
}
```

---

## 4. 数据流全景

```
用户请求
    │
    ▼
[TokenAuth → Distribute]
    │
    ▼
GetRandomSatisfiedChannel()  ◄── effectiveWeight = staticWeight × healthMultiplier
    │                                    ▲
    │                                    │
    │                         ┌──────────┴──────────┐
    │                         │  GetHealthMultiplier │
    │                         │  ├── CircuitBreaker  │
    │                         │  └── SlidingWindow   │
    │                         └─────────────────────┘
    ▼
[Relay → Adaptor → 上游]
    │
    ▼
请求完成/失败
    │
    ├──▶ RecordChannelRequest()    → 更新 Snapshot (用于DB落盘)
    ├──▶ SlidingWindow.Record()    → 更新实时窗口
    └──▶ CircuitBreaker.Record()   → 更新熔断器状态
    │
    ▼
[定时任务]
    ├── FlushHealthCache()          每 5min, 落盘到 channel_healths 表
    ├── EvaluateCircuitBreakers()   每 10s, 评估状态转换
    └── ActiveProber.Run()          每 N min, 主动探测
```

---

## 5. 实现文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `model/channel_health_window.go` | 新增 | SlidingWindow 实现 + 全局窗口管理 |
| `service/circuit_breaker.go` | 新增 | 熔断器状态机 + 全局管理器 |
| `service/health_weight.go` | 新增 | 健康乘数计算 + 渠道选择集成 |
| `service/active_prober.go` | 新增 | 并发主动探测器 |
| `model/channel_health.go` | 修改 | RecordChannelRequest 增加写入 SlidingWindow |
| `model/channel_cache.go` | 修改 | GetRandomSatisfiedChannel 应用 healthMultiplier |
| `controller/channel_health.go` | 修改 | API 增加实时指标 + 熔断状态 |
| `controller/relay.go` | 修改 | 请求结束后反馈 CircuitBreaker |
| `setting/operation_setting/monitor_setting.go` | 修改 | 增加新配置字段 |
| `router/api-router.go` | 修改 | 注册新路由 |

---

## 6. 实现优先级 (Phase 分期)

### Phase 1 — 实时可观测 (低风险)
- [x] 实时滑动窗口 `channel_health_window.go`
- [x] API 返回实时指标
- [x] 不影响路由逻辑

### Phase 2 — 熔断器 (中风险)
- [ ] 熔断器状态机 `circuit_breaker.go`
- [ ] 渠道选择跳过 Open 状态
- [ ] 手动重置 API
- [ ] 默认关闭，需管理员显式开启

### Phase 3 — 动态权重 (中风险)
- [ ] 健康乘数计算 `health_weight.go`
- [ ] 集成到 GetRandomSatisfiedChannel
- [ ] 默认关闭，需管理员显式开启

### Phase 4 — 主动探测增强 (低风险)
- [ ] 并发探测器替代串行测试
- [ ] 优先级调度
- [ ] 探测结果反馈到熔断器

---

## 7. 兼容性与风险控制

| 风险 | 缓解措施 |
|------|----------|
| 新功能影响路由稳定性 | 所有新功能默认 `enabled=false`，零影响升级 |
| 内存开销增加 | 滑动窗口每渠道 ~1KB (10桶×96B)，1000渠道 < 1MB |
| 多实例部署不一致 | 滑动窗口/熔断器是实例本地的（与现有 healthCache 一致），可接受 |
| 熔断误杀 | MinRequestCount 防止小样本误判；HalfOpen 保证恢复路径 |
| 与现有 AutoBan 冲突 | 互补关系：AutoBan 处理硬故障(401/403)，熔断器处理性能劣化；两者独立运行 |
| GetRandomSatisfiedChannel 热路径性能 | GetHealthMultiplier 只读内存，无锁竞争（RWMutex ReadLock） |

---

## 8. 测试策略

| 层级 | 测试内容 |
|------|----------|
| 单元测试 | SlidingWindow 桶推进/过期/聚合 |
| 单元测试 | CircuitBreaker 状态转换: Closed→Open→HalfOpen→Closed |
| 单元测试 | HealthMultiplier 计算精度 |
| 单元测试 | GetRandomSatisfiedChannel 集成健康权重后的分布验证 |
| 集成测试 | 模拟渠道连续错误 → 熔断触发 → 探测恢复 全流程 |
| 基准测试 | GetRandomSatisfiedChannel + HealthMultiplier 热路径延迟 |

---

> 文档版本: 1.0  
> 生成时间: 2025-07-11  
> 基于: T-001 架构分析 + new-api 源码 (QuantumNous fork)
