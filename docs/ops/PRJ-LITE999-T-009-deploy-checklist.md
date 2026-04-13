# 部署清单 — PRJ-LITE999-T-009 智能 Fallback 策略实现

> **任务:** PRJ-LITE999-T-009 — 智能 Fallback 策略实现
> **日期:** 2026-04-10
> **状态:** 已验证

---

## 一、功能概述

智能 Fallback 是 New-API 请求可靠性的核心机制——当一个渠道请求失败后，自动尝试其他渠道，直到成功或耗尽重试。

```
客户端请求
  │
  ▼
Token 认证 → 模型分发 (Distribute) → 选择渠道
  │                                    │
  │    ┌───────────────────────────────┘
  │    │
  ▼    ▼
Relay 转发 ──失败──▶ shouldRetry() 判断
  │                    │
  成功                 ▼ 是
  │            processChannelError()
  返回         ├─ 禁用渠道 (如需)
               ├─ 记录错误日志
               └─ 重选渠道 (下一优先级/权重)
                    │
                    ▼
               Relay 转发 ──失败──▶ ... (重复)
                    │
                    成功 → 返回
```

### 核心决策链路

1. **渠道选择** — 按优先级分层 + 同层加权随机
2. **请求转发** — relay handler 执行
3. **失败判断** — `shouldRetry()` 决定是否重试
4. **渠道处理** — `processChannelError()` 决定是否禁用渠道
5. **重选渠道** — retry+1 → 下一优先级层的渠道
6. **循环** — 直到成功或 `RetryTimes` 耗尽

---

## 二、核心代码路径

### 2.1 Fallback 主循环

| 文件 | 函数 | 行为 |
|------|------|------|
| `controller/relay.go` | `Relay()` | 主循环: `for retry <= RetryTimes` |
| `controller/relay.go` | `getChannel()` | 获取渠道 (委托给 service 层) |
| `controller/relay.go` | `shouldRetry()` | 判断错误是否可重试 |
| `controller/relay.go` | `processChannelError()` | 渠道错误处理 + 自动禁用 + 错误日志 |
| `controller/relay.go` | `RelayTask()` | Task 类 Fallback (同构重试循环) |
| `controller/relay.go` | `shouldRetryTaskRelay()` | Task 类重试判断 |

### 2.2 渠道选择

| 文件 | 函数 | 行为 |
|------|------|------|
| `service/channel_select.go` | `CacheGetRandomSatisfiedChannel()` | 核心选择: auto 跨分组 + 优先级 + 权重 |
| `model/channel_cache.go` | `GetRandomSatisfiedChannel()` | 缓存层: 优先级分层 → 同层加权随机 |
| `middleware/distributor.go` | `Distribute()` | 首次渠道分发 (进入 Relay 前) |

### 2.3 重试策略控制

| 文件 | 函数/变量 | 行为 |
|------|-----------|------|
| `common/constants.go` | `RetryTimes = 0` | 全局重试次数 (默认 0 = 不重试) |
| `setting/operation_setting/status_code_ranges.go` | `AutomaticRetryStatusCodeRanges` | 可重试状态码范围 |
| | `alwaysSkipRetryStatusCodes` | 永不重试: 504, 524 (超时) |
| | `alwaysSkipRetryCodes` | 永不重试错误码: BadResponseBody |
| `types/error.go` | `IsChannelError()` | 渠道级错误 → 总是重试 |
| | `IsSkipRetryError()` | 跳过重试标记 |

### 2.4 渠道亲和性 (高级 Fallback)

| 文件 | 行 | 行为 |
|------|-----|------|
| `service/channel_affinity.go` (966L) | - | 渠道亲和: 记住成功渠道 → 下次直达 |
| `setting/operation_setting/channel_affinity_setting.go` | - | 亲和规则配置: 按模型/路径/UA 匹配 |
| | `SkipRetryOnFailure` | 亲和渠道失败时是否跳过重试 |
| | `SwitchOnSuccess` | 成功后是否更新亲和记录 |

### 2.5 自动禁用/恢复

| 文件 | 函数 | 行为 |
|------|------|------|
| `service/channel.go` | `ShouldDisableChannel()` | 判断是否禁用渠道 |
| `service/channel.go` | `DisableChannel()` | 异步禁用 (gopool) |
| `model/option.go` | `AutomaticDisableChannelEnabled` | 自动禁用总开关 |
| | `AutomaticEnableChannelEnabled` | 自动恢复开关 |
| | `ChannelDisableThreshold` | 禁用阈值 |

---

## 三、渠道选择算法详解

### 3.1 优先级 + 权重二级调度

```
渠道池 (某分组 × 某模型)
│
├── Priority 100: [渠道A(w=5), 渠道B(w=3)]  ← retry=0 在此层选
├── Priority 50:  [渠道C(w=2)]               ← retry=1 降级到此层
└── Priority 0:   [渠道D(w=1), 渠道E(w=1)]  ← retry=2 降级到此层
```

- **retry=0**: 选最高优先级层，按权重随机
- **retry=1**: 降到第二优先级层
- **retry >= 层数**: 停留在最低优先级层

### 3.2 Auto 分组跨组 Fallback

```
Token 设置 group="auto" + CrossGroupRetry=true

┌── Group A (priority0 → priority1 → exhausted) ──┐
│                                                   │
│   retry=0: GroupA, priority0                      │
│   retry=1: GroupA, priority1                      │
│   retry=2: GroupA exhausted → switch to GroupB    │
│                                                   │
├── Group B (priority0 → priority1) ───────────────┤
│                                                   │
│   retry=2: GroupB, priority0 (reset)              │
│   retry=3: GroupB, priority1                      │
└───────────────────────────────────────────────────┘
```

---

## 四、部署配置项

### 4.1 系统选项 (管理后台 → 运营设置)

| 选项 | 默认值 | 说明 | 生产建议 |
|------|--------|------|----------|
| `RetryTimes` | `0` | 全局最大重试次数 | **`3`** (至少大于优先级层数) |
| `AutomaticDisableChannelEnabled` | `true` | 渠道自动禁用 | `true` |
| `AutomaticEnableChannelEnabled` | `true` | 渠道自动恢复 | `true` |
| `ChannelDisableThreshold` | `10` | 禁用阈值 | `10` |
| `AutomaticDisableStatusCodes` | `401` | 触发禁用的状态码 | `401` |
| `AutomaticRetryStatusCodes` | `100-199,300-399,401-407,409-499,500-503,505-523,525-599` | 触发重试的状态码 | 默认即可 |
| `AutoGroups` | `[]` | Auto 分组列表 | 按需配置 |
| `DefaultUseAutoGroup` | `false` | 默认使用 auto 分组 | 按需 |

### 4.2 渠道配置 (管理后台 → 渠道管理)

| 字段 | 说明 | Fallback 影响 |
|------|------|---------------|
| `priority` | 优先级 (高→先选) | 决定 Fallback 降级顺序 |
| `weight` | 权重 (同优先级内) | 决定同层选中概率 |
| `auto_ban` | 是否允许自动禁用 | 关闭则永不自动禁用 |
| `status` | 渠道状态 | 禁用渠道不参与选择 |

### 4.3 渠道亲和性 (管理后台 → 运营设置 → 渠道亲和性)

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `Enabled` | `true` | 亲和性总开关 |
| `SwitchOnSuccess` | `true` | 成功后更新亲和记录 |
| `MaxEntries` | `100,000` | 亲和缓存最大条目 |
| `DefaultTTLSeconds` | `3600` | 亲和记录默认 TTL |
| `Rules[].SkipRetryOnFailure` | `false` | 亲和渠道失败跳过重试 |

### 4.4 环境变量

无新增环境变量。所有 Fallback 配置通过系统选项 (数据库持久化) 管理。

---

## 五、部署前检查

- [ ] 已理解当前渠道优先级分层布局
- [ ] `RetryTimes` 已设置 ≥ 1 (默认 0 = Fallback 关闭)
- [ ] 多优先级渠道已配置 (至少 2 个优先级层才有 Fallback 意义)
- [ ] `AutomaticDisableChannelEnabled = true`
- [ ] `AutomaticEnableChannelEnabled = true` (配合健康检查 T-008)
- [ ] Redis 可用 (渠道缓存 + 亲和缓存依赖 Redis)
- [ ] 渠道测试功能可用 (T-008 已部署)

---

## 六、部署执行

### Step 1: 确认当前设置

```bash
API_BASE="http://localhost:3000"
ADMIN_TOKEN="<admin-session-token>"

# 查看当前系统选项
curl -sf "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | \
  python3 -c "
import sys,json
opts = json.load(sys.stdin).get('data',{})
for k in ['RetryTimes','AutomaticDisableChannelEnabled','AutomaticEnableChannelEnabled',
          'ChannelDisableThreshold','AutoGroups','DefaultUseAutoGroup']:
    print(f'  {k}: {opts.get(k,\"NOT SET\")}')
"
```

### Step 2: 配置 RetryTimes

```bash
# 设置重试次数为 3
curl -sf -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"RetryTimes","value":"3"}'
```

### Step 3: 配置渠道优先级

```bash
# 查看所有渠道
curl -sf "$API_BASE/api/channel/?p=1&page_size=100" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | \
  python3 -c "
import sys,json
data = json.load(sys.stdin).get('data',[])
print(f'  共 {len(data)} 个渠道:')
for ch in sorted(data, key=lambda x: -(x.get('priority') or 0)):
    print(f'    #{ch[\"id\"]} {ch[\"name\"]:20s} priority={ch.get(\"priority\",0):3d} weight={ch.get(\"weight\",0):3d} status={ch[\"status\"]}')
"
```

### Step 4: 验证 Fallback

```bash
# 1. 发送请求 (正常)
curl -sf "$API_BASE/v1/chat/completions" \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hello"}],"max_tokens":3}'

# 2. 检查日志中的重试记录
curl -sf "$API_BASE/api/log/search?keyword=重试" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | head -c 500
```

---

## 七、部署后验证矩阵

| # | 验证项 | 方法 | 预期 | 通过 |
|---|--------|------|------|------|
| 1 | RetryTimes 已生效 | 查系统选项 | ≥ 1 | [ ] |
| 2 | 正常请求成功 | 发 chat/completions | 200 OK | [ ] |
| 3 | 渠道优先级分层 | 查渠道列表 | 至少 2 个优先级层 | [ ] |
| 4 | 渠道权重分配 | 查同优先级渠道 | 权重 > 0 | [ ] |
| 5 | 自动禁用开启 | 查系统选项 | `AutomaticDisableChannelEnabled=true` | [ ] |
| 6 | 自动恢复开启 | 查系统选项 | `AutomaticEnableChannelEnabled=true` | [ ] |
| 7 | 重试日志记录 | 查错误日志 | 失败后有渠道切换记录 | [ ] |
| 8 | 超时不重试 | 模拟 504/524 | 直接返回错误 | [ ] |
| 9 | 400 不重试 | 模拟参数错误 | 直接返回错误 | [ ] |
| 10 | 亲和性缓存 | 连续请求同模型 | 命中同一渠道 | [ ] |
| 11 | 渠道亲和缓存统计 | `GET /api/log/channel_affinity_usage_cache` | 有缓存数据 | [ ] |
| 12 | Auto 分组 Fallback | 配置 auto group | 跨组切换 | [ ] |

---

## 八、回滚方案

Fallback 是纯配置驱动，回滚只需改系统选项：

### 关闭 Fallback

```bash
# 设置 RetryTimes=0 (关闭重试)
curl -sf -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"RetryTimes","value":"0"}'
```

### 关闭自动禁用

```bash
curl -sf -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"AutomaticDisableChannelEnabled","value":"false"}'
```

### 关闭渠道亲和性

通过管理后台 → 运营设置 → 渠道亲和性 → 关闭 `Enabled`

---

## 九、Fallback 策略调优建议

| 场景 | 建议配置 |
|------|----------|
| 少量渠道 (2-3 个) | `RetryTimes=2`，每个渠道不同优先级 |
| 中等渠道 (5-10 个) | `RetryTimes=3`，分 2-3 层优先级，同层设权重 |
| 大量渠道 (10+) | `RetryTimes=3-5`，启用 Auto 分组 + 跨组重试 |
| 延迟敏感场景 | 降低 `RetryTimes`，避免多次重试累加延迟 |
| 可用性优先 | 提高 `RetryTimes`，配合多层优先级 |
| Codex/Claude CLI | 启用渠道亲和性，`SwitchOnSuccess=true` |

### 不可重试的错误 (代码硬编码)

| 状态码/错误 | 原因 |
|-------------|------|
| 504 | 网关超时 |
| 524 | 源超时 (Cloudflare) |
| 400 (Task) | 参数错误，重试无意义 |
| 408 (Task) | Azure 处理超时 |
| `BadResponseBody` | 响应体损坏 |
| `SkipRetry` 标记 | 客户端错误 (如 413) |

---

## 十、执行记录 (2026-04-10)

### 代码验证结果

| 维度 | 结果 |
|------|------|
| Fallback 主循环 (`controller/relay.go`) | ✅ Relay + RelayTask 双循环 |
| 渠道选择 (优先级 + 权重) | ✅ `GetRandomSatisfiedChannel` |
| Auto 跨组 Fallback | ✅ `CacheGetRandomSatisfiedChannel` |
| 重试判断 (`shouldRetry`) | ✅ 状态码范围 + 错误类型 |
| 自动禁用 (`ShouldDisableChannel`) | ✅ 异步 gopool |
| 渠道亲和性 (966L) | ✅ HybridCache + 规则引擎 |
| 状态码重试范围 | ✅ 可配置 + 永不重试集 |
| 系统选项 (7 个) | ✅ 数据库持久化 |

---

*清单编制: ops-prjlite999 | 日期: 2026-04-10*
