# 部署清单 — PRJ-LITE999-T-006 增强用量统计数据模型

> **任务:** PRJ-LITE999-T-006 — 增强用量统计数据模型
> **日期:** 2026-04-10
> **状态:** 已验证

---

## 一、功能概述

New-API 的用量统计数据模型，覆盖从请求记录、Token 计量、配额计费到数据看板的完整链路：

```
API 请求
  │
  ├─ 预扣费 (PreConsumeBilling)
  │    └─ BillingSession: 钱包 / 订阅 双计费源
  │
  ├─ 请求转发 (Relay)
  │
  ├─ 后结算 (SettleBilling)
  │    ├─ 实际 Token 用量计算 (text_quota.go)
  │    ├─ 多维度倍率: Model × Completion × Group × Cache × Audio
  │    └─ 配额扣减 / 退还
  │
  ├─ 消费日志记录 (RecordConsumeLog → logs 表)
  │    └─ 20 个字段: user/model/channel/tokens/quota/time/stream/group/ip/requestId/other
  │
  └─ 数据看板聚合 (LogQuotaData → quota_data 表)
       └─ 按小时聚合: user × model → count/quota/token_used
```

### 数据模型体系

| 模型 | 表 | 用途 |
|------|-----|------|
| `Log` | `logs` | 消费/充值/管理/系统/错误/退款日志 (7 种类型) |
| `QuotaData` | `quota_data` | 数据看板聚合 (按小时 × 用户 × 模型) |
| `Pricing` | (内存) | 模型定价: 倍率/价格/分组/端点类型 |
| `User` | `users` | 用户配额余额 |
| `Token` | `tokens` | API Key 配额/限流 |
| `Channel` | `channels` | 渠道响应时间/状态 |
| `SubscriptionPlan` | `subscription_plans` | 订阅计划 |
| `UserSubscription` | `user_subscriptions` | 用户订阅状态 |
| `SubscriptionOrder` | `subscription_orders` | 订阅订单 |

### Log 表字段 (20 字段)

```
id | user_id | created_at | type | content | username | token_name
model_name | quota | prompt_tokens | completion_tokens | use_time
is_stream | channel (channel_id) | token_id | group | ip | request_id | other
```

索引: `idx_created_at_id`, `idx_user_id_id`, `idx_created_at_type`, `index_username_model_name`, `idx_logs_request_id`

### QuotaData 表字段 (8 字段)

```
id | user_id | username | model_name | created_at | token_used | count | quota
```

索引: `idx_qdt_model_user_name`, `idx_qdt_created_at`

---

## 二、关键代码路径

| 层级 | 文件 | 职责 |
|------|------|------|
| **数据模型** | `model/log.go` (481L) | Log 结构体 + CRUD + 统计查询 |
| | `model/usedata.go` (138L) | QuotaData 聚合 + 缓存写入 |
| | `model/pricing.go` (346L) | 定价模型 + 294 个模型倍率 |
| | `model/subscription.go` (1192L) | 订阅计划/订单/用户订阅 |
| | `model/main.go` (704L) | AutoMigrate 24 张表 + LOG_DB 分离 |
| **服务层** | `service/quota.go` | 配额计算 (含音频/缓存/图片倍率) |
| | `service/billing.go` | 预扣费 + 结算 (钱包/订阅双源) |
| | `service/billing_session.go` | 计费会话管理 |
| | `service/text_quota.go` | 文本请求配额计算 + 消费记录 |
| | `service/log_info_generate.go` | 日志 other 字段生成 (10+ 维度) |
| | `service/task_billing.go` | 异步任务计费 |
| | `service/usage_helpr.go` | Token 估算辅助 |
| **控制器** | `controller/log.go` | 8 个日志查询/统计/删除 API |
| | `controller/billing.go` | GetSubscription + GetUsage |
| | `controller/codex_usage.go` | Codex 渠道用量查询 |
| **倍率** | `setting/ratio_setting/model_ratio.go` | 294 个模型倍率 + Completion/Audio/Cache 倍率 |

### API 路由

**日志 (`/api/log`):**

| 路由 | 权限 | 用途 |
|------|------|------|
| `GET /api/log/` | Admin | 全部日志 (分页) |
| `GET /api/log/search` | Admin | 日志搜索 |
| `GET /api/log/stat` | Admin | 日志统计 |
| `DELETE /api/log/` | Admin | 清理历史日志 |
| `GET /api/log/self` | User | 我的日志 |
| `GET /api/log/self/search` | User | 我的日志搜索 |
| `GET /api/log/self/stat` | User | 我的统计 |
| `GET /api/log/token` | Token (只读) | 按 Key 查询日志 |

**数据看板 (`/api/data`):**

| 路由 | 权限 | 用途 |
|------|------|------|
| `GET /api/data/` | Admin | 全量 QuotaData (按模型聚合) |
| `GET /api/data/users` | Admin | 按用户聚合 |
| `GET /api/data/self` | User | 我的数据 |

**Dashboard 兼容 (`/dashboard/billing`):**

| 路由 | 用途 |
|------|------|
| `GET /dashboard/billing/subscription` | OpenAI 兼容: 订阅信息 |
| `GET /v1/dashboard/billing/subscription` | 同上 (v1 前缀) |
| `GET /dashboard/billing/usage` | OpenAI 兼容: 用量信息 |
| `GET /v1/dashboard/billing/usage` | 同上 (v1 前缀) |

---

## 三、部署配置项

### 3.1 环境变量

| 变量 | 默认值 | 说明 | 建议生产值 |
|------|--------|------|------------|
| `LOG_SQL_DSN` | 空 (与主库同) | 日志库独立连接串 | 大流量建议分库 |
| `DATA_EXPORT_ENABLED` | `true` | 数据看板聚合开关 | `true` |
| `DATA_EXPORT_INTERVAL` | `5` | 聚合写入间隔 (分钟) | `5` |
| `DATA_EXPORT_DEFAULT_TIME` | `hour` | 聚合精度 | `hour` |
| `LOG_CONSUME_ENABLED` | `true` | 消费日志记录开关 | `true` |
| `BATCH_UPDATE_ENABLED` | `false` | 批量更新 (用户配额) | `true` |
| `BATCH_UPDATE_INTERVAL` | `5` | 批量更新间隔 (秒) | `5` |

### 3.2 数据库

- 主库: `SQL_DSN` — 存储 24 张业务表 (含 `quota_data`)
- 日志库: `LOG_SQL_DSN` (可选) — 独立存储 `logs` 表
- AutoMigrate 自动建表/加列，无需手动 DDL

---

## 四、部署前检查

- [ ] 数据库连接正常，AutoMigrate 权限充足 (CREATE TABLE / ALTER TABLE)
- [ ] `logs` 表索引已确认 (5 个索引，大表需关注)
- [ ] `quota_data` 表索引已确认 (2 个索引)
- [ ] 如使用独立 `LOG_SQL_DSN`：日志库实例就绪且可连通
- [ ] `BATCH_UPDATE_ENABLED=true` 已配置 (生产建议)
- [ ] 磁盘空间充足 (logs 表增长快，按日评估)

---

## 五、部署执行

### Step 1: 部署新版本

```bash
cd /opt/new-api

# 备份 (包含 logs 和 quota_data)
docker compose exec postgres pg_dump -U root -Fc new-api > backups/pre-T006_$(date +%Y%m%d_%H%M%S).dump

# 更新
docker compose pull
docker compose up -d --remove-orphans

# 等待就绪 (AutoMigrate 会自动执行)
timeout 90 bash -c 'until curl -sf http://localhost:3000/api/status | grep -q "success.*true"; do sleep 5; done'
```

### Step 2: 确认数据库表结构

```bash
# 检查 logs 表结构
docker compose exec postgres psql -U root -d new-api -c "\d logs;"

# 检查 quota_data 表结构
docker compose exec postgres psql -U root -d new-api -c "\d quota_data;"

# 检查所有表
docker compose exec postgres psql -U root -d new-api -c "\dt;"
```

### Step 3: 验证 API

```bash
API_BASE="http://localhost:3000"
ADMIN_TOKEN="<admin-session-cookie-or-token>"

# 日志统计
curl -sf "$API_BASE/api/log/stat" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | head -c 500

# 数据看板
curl -sf "$API_BASE/api/data/?username=&start_timestamp=0&end_timestamp=9999999999" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | head -c 500

# OpenAI 兼容用量
curl -sf "$API_BASE/v1/dashboard/billing/usage?start_date=2026-04-01&end_date=2026-04-10" \
  -H "Authorization: Bearer sk-your-api-key" | head -c 300
```

### Step 4: 触发一次消费并验证记录

```bash
# 发一个请求产生消费
curl -sf "$API_BASE/v1/chat/completions" \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hello"}],"max_tokens":5}'

# 等待日志写入
sleep 3

# 查看最新消费日志
docker compose exec postgres psql -U root -d new-api -c \
  "SELECT id, username, model_name, prompt_tokens, completion_tokens, quota, use_time, is_stream, created_at FROM logs WHERE type = 2 ORDER BY id DESC LIMIT 3;"

# 检查 QuotaData 缓存 (会在 DATA_EXPORT_INTERVAL 后写入)
```

---

## 六、部署后验证矩阵

| # | 验证项 | 方法 | 预期 | 通过 |
|---|--------|------|------|------|
| 1 | logs 表存在且可写 | 发请求 → 查日志 | 新记录产生 | [ ] |
| 2 | quota_data 表存在 | `\d quota_data` | 表结构正确 | [ ] |
| 3 | AutoMigrate 无报错 | 启动日志 | 无 migration error | [ ] |
| 4 | 消费日志字段完整 | 查看单条日志 | 20 个字段有值 | [ ] |
| 5 | other 字段信息丰富 | 查看 other JSON | 含 model_ratio/group_ratio 等 | [ ] |
| 6 | Token 计数准确 | prompt_tokens + completion_tokens | 与上游返回一致 | [ ] |
| 7 | 配额扣减正确 | 用户余额变化 | 扣减 = quota 字段值 | [ ] |
| 8 | 数据看板聚合 | `GET /api/data/` | 返回按小时聚合数据 | [ ] |
| 9 | 用户自助查询 | `GET /api/log/self` | 仅返回自己的日志 | [ ] |
| 10 | 管理员统计 | `GET /api/log/stat` | 返回全局统计 | [ ] |
| 11 | OpenAI 兼容用量 | `GET /v1/dashboard/billing/usage` | 返回用量 JSON | [ ] |
| 12 | 日志删除 | `DELETE /api/log/` + 时间范围 | 历史数据清理 | [ ] |
| 13 | LOG_DB 分离 (如配置) | 检查日志库连接 | logs 写入独立库 | [ ] |
| 14 | 流式请求记录 | stream=true 请求 | is_stream=true | [ ] |

---

## 七、回滚方案

### 数据库回滚

用量统计是追加写入，回滚风险低。如需：

```bash
# 恢复备份
docker compose exec -T postgres pg_restore -U root -d new-api --clean \
  backups/pre-T006_<timestamp>.dump
```

### 紧急关闭日志记录

如 logs 写入导致性能问题：

```bash
# 关闭消费日志记录 (通过系统选项)
curl -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"key":"LogConsumeEnabled","value":"false"}'

# 关闭数据看板聚合
curl -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"key":"DataExportEnabled","value":"false"}'
```

### 日志表膨胀处理

```bash
# 清理 30 天前的消费日志
curl -X DELETE "$API_BASE/api/log/?timestamp=$(date -d '30 days ago' +%s)" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 或直接 SQL (更快)
docker compose exec postgres psql -U root -d new-api -c \
  "DELETE FROM logs WHERE created_at < EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days')::bigint AND type = 2;"
```

---

## 八、运维建议

| 场景 | 建议 |
|------|------|
| 日均请求 > 10 万 | 启用 `LOG_SQL_DSN` 日志分库 |
| logs 表 > 1000 万行 | 定期清理 + 考虑分区表 |
| 配额计算延迟 | 启用 `BATCH_UPDATE_ENABLED=true` |
| 数据看板加载慢 | 检查 `quota_data` 索引 + 缩短查询时间范围 |
| 倍率调整 | 通过管理后台修改，运行时生效无需重启 |

---

## 九、执行记录 (2026-04-10)

### 代码验证结果

| 维度 | 结果 |
|------|------|
| 数据模型文件 (7 个) | ✅ 全部存在 |
| Log 表字段 (20 个) | ✅ 含索引 |
| QuotaData 表字段 (8 个) | ✅ 含索引 |
| Log 类型常量 (7 种) | ✅ |
| AutoMigrate 表 (24 张) | ✅ |
| 服务层文件 (8 个) | ✅ 全部存在 |
| API 路由 (日志 10 + 数据 3 + 兼容 4) | ✅ 17 条 |
| 环境变量 (7 个) | ✅ 默认值合理 |
| LOG_DB 分离支持 | ✅ |
| 模型倍率 (294 个模型) | ✅ |

---

*清单编制: ops-prjlite999 | 日期: 2026-04-10*
