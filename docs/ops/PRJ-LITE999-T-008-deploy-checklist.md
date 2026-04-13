# 部署清单 — PRJ-LITE999-T-008 多服务商健康检查机制

> **任务:** PRJ-LITE999-T-008 — 多服务商健康检查机制
> **日期:** 2026-04-10
> **状态:** 执行中

---

## 一、功能概述

New-API 的多服务商（Channel）健康检查机制，核心能力：

| 能力 | 说明 |
|------|------|
| 单渠道测试 | `GET /api/channel/test/:id` — 对指定渠道发送真实推理请求验证可用性 |
| 全渠道批量测试 | `GET /api/channel/test` — 并发测试所有启用的渠道 |
| 定时自动巡检 | `AutomaticallyTestChannels()` — Master 节点定时轮询，可配置间隔 |
| 自动禁用 | 认证失败/余额不足/超时/关键词匹配 → 自动禁用渠道并通知 |
| 自动恢复 | 被自动禁用的渠道在后续测试通过后自动重新启用 |
| 响应时间记录 | 每次测试/请求记录渠道响应时间，用于智能路由 |
| 多模型类型覆盖 | Chat/Embedding/Rerank/Image/Responses/Compaction 全类型测试 |

### 关键代码路径

```
controller/channel-test.go    → 测试逻辑入口
service/channel.go             → 禁用/启用/判定逻辑
model/channel.go               → 状态更新、响应时间持久化
model/option.go                → 系统配置项持久化
setting/operation_setting/
  ├── monitor_setting.go       → 定时测试开关与频率
  ├── operation_setting.go     → 自动禁用关键词
  └── status_code_ranges.go   → 自动禁用状态码规则
common/constants.go            → 全局开关与阈值
router/api-router.go           → API 路由注册
```

---

## 二、部署配置项清单

### 2.1 环境变量（容器/进程级）

| 变量 | 类型 | 默认值 | 说明 | 建议生产值 |
|------|------|--------|------|------------|
| `CHANNEL_TEST_FREQUENCY` | int (分钟) | 无 (禁用) | 自动测试间隔，设置后覆盖数据库配置 | `10` |
| `POLLING_INTERVAL` | int (秒) | `0` | 测试请求间隔，防止并发过高 | `2` |
| `STREAMING_TIMEOUT` | int (秒) | `120` | 流式请求超时 | `300` |
| `RELAY_TIMEOUT` | int (秒) | `0` (不限) | 全局请求超时 | `60` |

### 2.2 系统选项（管理后台 / Options API）

| 选项 | 类型 | 默认值 | 说明 | 建议生产值 |
|------|------|--------|------|------------|
| `AutomaticDisableChannelEnabled` | bool | `false` | 自动禁用异常渠道 | **`true`** |
| `AutomaticEnableChannelEnabled` | bool | `false` | 自动恢复已修复渠道 | **`true`** |
| `ChannelDisableThreshold` | float (秒) | `5.0` | 响应时间超限阈值 | `10.0` |
| `AutoTestChannelEnabled` | bool | `false` | 定时自动测试开关 | **`true`** |
| `AutoTestChannelMinutes` | float | `10` | 自动测试间隔（分钟） | `10` |

### 2.3 渠道级配置（每个 Channel）

| 字段 | 说明 | 检查项 |
|------|------|--------|
| `auto_ban` | 是否允许自动禁用该渠道 | 生产渠道应设为 `1` |
| `test_model` | 测试用模型名称 | 应设为该渠道最便宜/最快的模型 |
| `status` | 渠道状态 (1=启用, 2=手动禁用, 3=自动禁用) | 部署前确认状态正确 |

---

## 三、部署前检查

### 3.1 代码与测试

- [x] T-008 所有测试用例通过
- [ ] CI Pipeline 全绿（lint + test + build）
- [ ] 代码已合并至 `develop`，PR 已 review

### 3.2 基础设施

- [ ] PostgreSQL 运行正常，`channels` 表已包含 `response_time`、`auto_ban`、`test_model` 字段
- [ ] Redis 运行正常（缓存渠道状态）
- [ ] 通知渠道已配置（渠道禁用/恢复通知需要 `NotifyRootUser` 可用）
- [ ] Master 节点标识正确（`NODE_TYPE=master` 或默认单节点）

### 3.3 渠道数据

- [ ] 所有生产渠道已设置 `test_model`（否则回退到渠道模型列表第一个，最终回退 `gpt-4o-mini`）
- [ ] 关键渠道的 `auto_ban` 已按需配置
- [ ] 不支持自动测试的渠道类型已知晓（Midjourney、Suno、Kling、即梦、豆包视频、Vidu）

---

## 四、部署执行

### Step 1: 更新环境变量

在 `docker-compose.yml` 或 `.env` 中添加：

```yaml
environment:
  # ... 已有配置 ...
  - CHANNEL_TEST_FREQUENCY=10          # 每10分钟自动测试
  - POLLING_INTERVAL=2                 # 渠道间测试间隔2秒
  - STREAMING_TIMEOUT=300              # 流式超时5分钟
```

### Step 2: 部署新版本

```bash
cd /opt/new-api

# 备份数据库
docker compose exec postgres pg_dump -U root -Fc new-api > backups/pre-T008_$(date +%Y%m%d_%H%M%S).dump

# 拉取并更新
docker compose pull
docker compose up -d --remove-orphans

# 等待健康检查
timeout 90 bash -c 'until curl -sf http://localhost:3000/api/status | grep -q "success.*true"; do sleep 5; done'
```

### Step 3: 开启系统选项

通过管理后台「运营设置」→「监控设置」，或直接调用 API：

```bash
API_BASE="http://localhost:3000"
TOKEN="<admin-token>"

# 开启自动禁用
curl -s -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"AutomaticDisableChannelEnabled","value":"true"}'

# 开启自动恢复
curl -s -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"AutomaticEnableChannelEnabled","value":"true"}'

# 设置超时阈值为10秒
curl -s -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"ChannelDisableThreshold","value":"10"}'
```

### Step 4: 验证健康检查功能

```bash
# 4a. 单渠道测试
curl -s "$API_BASE/api/channel/test/1" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 预期: {"success": true, "message": "", "time": 1.23}

# 4b. 全渠道批量测试
curl -s "$API_BASE/api/channel/test" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 预期: {"success": true, "message": ""}

# 4c. 检查日志确认自动测试已启动
docker compose logs --tail=50 new-api | grep -i "automatically test"

# 预期: "automatically test channels with interval 10.000000 minutes"
```

---

## 五、部署后验证

### 5.1 功能验证矩阵

| # | 验证项 | 方法 | 预期结果 | 通过 |
|---|--------|------|----------|------|
| 1 | 单渠道测试 API | `GET /api/channel/test/:id` | 返回 success + 响应时间 | [ ] |
| 2 | 全渠道批量测试 | `GET /api/channel/test` | 启动测试，不重复触发 | [ ] |
| 3 | 定时自动巡检 | 等待一个周期，检查日志 | 日志显示巡检执行 | [ ] |
| 4 | 自动禁用 | 配置一个错误 key 的测试渠道 | 渠道状态变为 3 (自动禁用) | [ ] |
| 5 | 自动恢复 | 修复上述渠道的 key，等待巡检 | 渠道状态恢复为 1 (启用) | [ ] |
| 6 | 超时禁用 | 设置极低阈值 (0.1s) 测试 | 超时渠道被禁用 | [ ] |
| 7 | 通知送达 | 触发禁用/恢复事件 | 管理员收到通知 | [ ] |
| 8 | 响应时间记录 | 测试后查询渠道详情 | `response_time` 字段已更新 | [ ] |
| 9 | 手动禁用不受影响 | 手动禁用的渠道 (status=2) | 自动巡检跳过该渠道 | [ ] |
| 10 | 不支持类型跳过 | Midjourney 等类型渠道 | 测试返回 "not supported" | [ ] |

### 5.2 监控指标

- [ ] 容器无异常重启
- [ ] 日志中无非预期 ERROR
- [ ] 数据库连接池无异常
- [ ] 渠道状态分布合理（不应出现大面积误禁用）

---

## 六、回滚方案

### 场景 A：功能逻辑异常（误禁用大量渠道）

```bash
# 紧急关闭自动禁用
curl -s -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"AutomaticDisableChannelEnabled","value":"false"}'

# 批量恢复被误禁用的渠道 (status 3 → 1)
docker compose exec postgres psql -U root -d new-api -c \
  "UPDATE channels SET status = 1 WHERE status = 3;"
```

### 场景 B：服务不可用

```bash
# 回退到上一版本镜像
docker compose down
# 编辑 docker-compose.yml 指定上一版本 tag
docker compose up -d

# 恢复数据库
docker compose exec -T postgres pg_restore -U root -d new-api --clean \
  backups/pre-T008_<timestamp>.dump
```

### 回滚判定标准

| 指标 | 阈值 | 行动 |
|------|------|------|
| 渠道误禁率 | > 20% 渠道被自动禁用 | 关闭自动禁用 + 批量恢复 |
| 健康检查 API 失败 | 连续 3 次 | 回退版本 |
| 测试引发上游大量请求 | 上游告警 | 增大 `POLLING_INTERVAL` 或关闭自动测试 |

---

## 七、部署后运维

### 日常监控

```bash
# 查看渠道状态分布
docker compose exec postgres psql -U root -d new-api -c \
  "SELECT status, COUNT(*) FROM channels GROUP BY status;"

# 查看最慢的渠道
docker compose exec postgres psql -U root -d new-api -c \
  "SELECT id, name, type, response_time, status FROM channels WHERE status = 1 ORDER BY response_time DESC LIMIT 10;"

# 查看最近被自动禁用的渠道
docker compose exec postgres psql -U root -d new-api -c \
  "SELECT id, name, status, updated_at FROM channels WHERE status = 3 ORDER BY updated_at DESC LIMIT 10;"
```

### 调优建议

| 参数 | 场景 | 建议 |
|------|------|------|
| `AutoTestChannelMinutes` | 渠道多 (>100) | 增大到 `20-30` 分钟 |
| `POLLING_INTERVAL` | 上游有 rate limit | 增大到 `5-10` 秒 |
| `ChannelDisableThreshold` | 慢速模型 (o1 等) | 增大到 `30-60` 秒 |
| `test_model` | 降低测试成本 | 设置为各渠道最便宜的模型 |

---

*清单编制: ops-prjlite999 | 日期: 2026-04-10*
