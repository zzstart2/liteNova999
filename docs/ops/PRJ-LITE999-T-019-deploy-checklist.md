# 部署清单 — PRJ-LITE999-T-019 性能优化与压力测试

> **任务:** PRJ-LITE999-T-019 — 性能优化与压力测试
> **日期:** 2026-04-13
> **状态:** 待部署

---

## 一、性能现状分析

### 1.1 系统资源

| 维度 | 规格 | 当前使用 | 可优化空间 |
|------|------|----------|------------|
| CPU | 2C Xeon 6982P-C | Load: 1.31 (65%) | 中等负载，有优化空间 |
| 内存 | 3.5GB | 1.7GB used (48%) | 充足，可调优缓存 |
| 磁盘 | NVMe SSD | 226 TPS, 10MB/s read | 高性能，无瓶颈 |
| 网络 | 阿里云内网 | 低延迟 | 已优化 |

### 1.2 容器资源分析

| 容器 | CPU% | 内存使用 | 内存限制 | 利用率 | 优化建议 |
|------|------|----------|----------|--------|----------|
| new-api | 0.00% | 21.4MB | 1GB | 2% | 💚 正常 |
| new-api-pg | 0.00% | 32.7MB | 512MB | 6% | 💚 正常 |
| new-api-redis | 0.30% | 9.3MB | 384MB | 2% | 💚 正常 |
| new-api-nginx | 0.01% | 3.4MB | 128MB | 3% | 💚 正常 |
| grafana | 0.04% | 99MB | 128MB | 77% | 🟡 内存紧张 |
| prometheus | 0.03% | 65.6MB | 200MB | 33% | 💚 正常 |
| n8n | 0.15% | 320MB | 3.5GB | 9% | 💚 正常 |

### 1.3 配置缺陷识别

| # | 配置项 | 当前值 | 问题 | 优化建议 |
|---|--------|--------|------|----------|
| P1 | New-API 性能参数 | 未设置 | 使用默认值，未针对 2C 优化 | 设置连接池/超时 |
| P2 | PG shared_buffers | 128MB | 偏小（建议 25% RAM = 896MB） | 调至 256MB |
| P3 | PG effective_cache_size | 384MB | 偏小（建议 75% RAM = 2.6GB） | 调至 1GB |
| P4 | Redis maxmemory | 256MB | 可适当增加 | 调至 320MB |
| P5 | Nginx worker_processes | 未明确 | 默认 auto，但可优化 | 设为 2 (CPU 数) |
| P6 | New-API 批量更新 | 未启用 | 错失性能提升机会 | 启用 + 调优间隔 |

---

## 二、性能优化方案

### 2.1 New-API 应用层优化

**环境变量调优 (.env)**
```bash
# 连接池优化 (2C 服务器)
BATCH_UPDATE_ENABLED=true
BATCH_UPDATE_INTERVAL=3
SQL_MAX_IDLE_CONNS=10
SQL_MAX_OPEN_CONNS=30
REDIS_POOL_SIZE=8

# 超时优化
STREAMING_TIMEOUT=180
RELAY_TIMEOUT=90
CHANNEL_TEST_FREQUENCY=20
POLLING_INTERVAL=3

# Go 运行时优化
GOMAXPROCS=2
GOGC=100
GOMEMLIMIT=800MB
```

### 2.2 PostgreSQL 调优

**postgresql.conf 关键参数**
```ini
# 内存设置 (3.5GB 系统)
shared_buffers = 256MB          # 从 128MB 提升
effective_cache_size = 1GB      # 从 384MB 提升  
work_mem = 8MB                  # 从 4MB 提升
maintenance_work_mem = 128MB    # 从 64MB 提升

# 连接与并发
max_connections = 60            # 从 100 降低 (减少开销)
max_prepared_transactions = 10

# 检查点优化
checkpoint_completion_target = 0.9
wal_buffers = 16MB
max_wal_size = 1GB
min_wal_size = 256MB

# 统计与监控
track_activities = on
track_counts = on
track_io_timing = on
log_min_duration_statement = 1000  # 记录慢查询 >1s
```

### 2.3 Redis 调优

**redis.conf 优化**
```ini
# 内存优化
maxmemory 320mb                 # 从 256MB 增加
maxmemory-policy allkeys-lru
hash-max-ziplist-entries 512
hash-max-ziplist-value 64

# 持久化优化 (性能优先)
save 900 1
save 300 10  
save 60 100                     # 从 10000 降低
appendfsync everysec           # 保持不变
no-appendfsync-on-rewrite yes  # 新增

# 网络优化
tcp-keepalive 300
timeout 0
maxclients 8000                # 从 10000 降低
```

### 2.4 Nginx 调优

**nginx.conf 优化**
```nginx
worker_processes 2;              # 明确设置为 CPU 数
worker_connections 2048;         # 增加连接数
worker_rlimit_nofile 8192;      # 文件句柄限制

# 事件模型优化
events {
    use epoll;
    multi_accept on;
}

# HTTP 优化
sendfile on;
tcp_nopush on;
tcp_nodelay on;
keepalive_timeout 65;
keepalive_requests 1000;

# 缓冲区优化
client_body_buffer_size 128k;
client_max_body_size 50m;
proxy_buffering on;
proxy_buffer_size 128k;
proxy_buffers 4 256k;
proxy_busy_buffers_size 256k;

# upstream 连接池
upstream new_api_backend {
    server new-api:3000;
    keepalive 16;                # 从 32 降低 (节省内存)
    keepalive_requests 1000;
    keepalive_timeout 60s;
}
```

---

## 三、压力测试方案

### 3.1 测试工具选择

| 工具 | 用途 | 命令示例 |
|------|------|----------|
| **wrk** | HTTP 负载测试 | `wrk -t4 -c100 -d30s --latency` |
| **ab** | Apache Bench | `ab -n 10000 -c 50` |
| **siege** | Web 压力测试 | `siege -c 25 -t 1m` |
| **hey** | Go 编写的负载工具 | `hey -n 10000 -c 50` |

### 3.2 测试场景矩阵

| 场景 | 目标 | 并发数 | 持续时间 | 成功标准 |
|------|------|--------|----------|----------|
| **轻负载** | 基准性能 | 10 | 1min | P99 < 100ms, 0% 错误 |
| **中等负载** | 日常使用 | 50 | 5min | P99 < 200ms, <0.1% 错误 |
| **高负载** | 峰值处理 | 100 | 2min | P99 < 500ms, <1% 错误 |
| **极限负载** | 系统边界 | 200+ | 30s | 找到崩溃点 |
| **持久性测试** | 稳定性 | 30 | 30min | 无内存泄露，性能稳定 |

### 3.3 测试 API 端点

| 端点 | 权重 | 描述 |
|------|------|------|
| `GET /api/status` | 40% | 健康检查 (轻量) |
| `POST /api/user/login` | 20% | 认证 (中等) |
| `GET /api/channel/` | 20% | 渠道列表 (数据库查询) |
| `POST /v1/chat/completions` | 15% | AI 接口 (重型，需 mock) |
| `GET /api/log/` | 5% | 日志查询 (重型数据库) |

---

## 四、监控指标

### 4.1 关键性能指标 (KPI)

| 指标 | 目标值 | 监控方式 |
|------|--------|----------|
| **响应时间** | P95 < 200ms | wrk/Grafana |
| **吞吐量** | > 500 RPS | wrk/Prometheus |
| **错误率** | < 0.1% | HTTP 状态码统计 |
| **CPU 使用率** | < 80% | node_exporter |
| **内存使用率** | < 85% | node_exporter |
| **数据库连接** | < 50/60 | pg_exporter |
| **Redis 命中率** | > 90% | redis_exporter |

---

## 五、配置文件清单

| 文件 | 用途 |
|------|------|
| `performance/.env.optimized` | New-API 优化环境变量 |
| `performance/postgresql.optimized.conf` | PG 性能配置 |
| `performance/redis.optimized.conf` | Redis 性能配置 |
| `performance/nginx.optimized.conf` | Nginx 性能配置 |
| `scripts/optimize-T019.sh` | 一键优化部署脚本 |
| `scripts/stress-test-T019.sh` | 压力测试套件 |
| `scripts/monitor-performance.sh` | 实时性能监控 |
| `scripts/verify-T019.sh` | 优化验证脚本 |

---

## 六、部署后验证矩阵

| # | 验证项 | 方法 | 预期 | 通过 |
|---|--------|------|------|------|
| 1 | 服务启动正常 | docker ps + health check | 所有容器 healthy | [ ] |
| 2 | API 响应正常 | curl /api/status | success=true, <50ms | [ ] |
| 3 | PG 参数生效 | SHOW shared_buffers | 256MB | [ ] |
| 4 | Redis 参数生效 | INFO memory | maxmemory=320MB | [ ] |
| 5 | 基准测试 10并发 | wrk -t2 -c10 -d60s | P99<100ms, 0% error | [ ] |
| 6 | 中等负载 50并发 | wrk -t4 -c50 -d300s | P99<200ms, <0.1% error | [ ] |
| 7 | 高负载 100并发 | wrk -t4 -c100 -d120s | P99<500ms, <1% error | [ ] |
| 8 | CPU 使用率 | 压测期间 node_exporter | 平均 <80% | [ ] |
| 9 | 内存使用率 | 压测期间 node_exporter | 峰值 <85% | [ ] |
| 10 | PG 连接数 | 压测期间 pg_exporter | <50 连接 | [ ] |
| 11 | Redis 命中率 | info stats | >90% 命中率 | [ ] |
| 12 | 错误日志 | docker logs 检查 | 无 ERROR/FATAL | [ ] |
| 13 | 持久性测试 | wrk -c30 -d1800s | 30分钟无崩溃 | [ ] |
| 14 | 性能回归对比 | 优化前后数据 | 延迟↓20%+ 吞吐↑30%+ | [ ] |

---

## 七、预期性能提升

| 指标 | 优化前 | 优化后 | 提升幅度 |
|------|--------|--------|----------|
| P99 响应时间 | ~50ms | ~30ms | ↓40% |
| 最大 RPS | ~300 | ~500 | ↑67% |
| 并发处理能力 | 50 | 100+ | ↑100% |
| PG 查询性能 | 基准 | +20% | Buffer 增加 |
| Redis 响应 | <1ms | <0.5ms | 内存优化 |
| 整体系统负载 | 1.3 | <1.0 | 资源调优 |

---

*清单编制: ops-prjlite999 | 日期: 2026-04-13*