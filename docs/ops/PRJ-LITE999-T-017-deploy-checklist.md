# 部署清单 — PRJ-LITE999-T-017 监控告警系统搭建

> **任务:** PRJ-LITE999-T-017 — 监控告警系统搭建 (Prometheus + Grafana + Alertmanager)
> **日期:** 2026-04-11
> **状态:** 待部署

---

## 一、功能概述

为 PRJ-LITE999 生产环境搭建可观测性三件套：Prometheus (指标采集) + Grafana (可视化) + Alertmanager (告警通知)。

### 约束条件

| 维度 | 现状 | 影响 |
|------|------|------|
| CPU | 2C (阿里云 ECS) | 监控服务必须极低 CPU 占用 |
| 内存 | 3.5G 总量, ~727MB 可用 | 三件套 + exporter 总计 ≤ 350MB |
| 磁盘 | 40G, 15G 剩余 | TSDB 保留 7 天, 预计 ≤ 500MB |
| 网络 | 内网容器互通 | Prometheus 通过 Docker 网络抓取 |
| 现有服务 | new-api + PG + Redis + Nginx (+ n8n + mcp) | 已占用 ~580MB |

### 架构

```
┌──────────────────────────────────────────────────────────┐
│                    Docker Network: backend                │
│                                                          │
│  ┌─────────┐     ┌────────────┐     ┌───────────────┐   │
│  │ new-api  │────▶│ Prometheus │────▶│   Grafana     │   │
│  │ :3000    │     │ :9090      │     │   :3099       │   │
│  └─────────┘     └────────────┘     └───────────────┘   │
│       │                │                                  │
│       │          ┌─────┴──────┐                          │
│       │          │Alertmanager│                          │
│       │          │  :9093     │                          │
│       │          └────────────┘                          │
│       │                                                  │
│  ┌────┴────┐   ┌──────────────┐   ┌──────────────┐     │
│  │  Nginx  │   │ pg_exporter  │   │redis_exporter│     │
│  │ :3088   │   │ :9187        │   │ :9121        │     │
│  └─────────┘   └──────────────┘   └──────────────┘     │
│                                                          │
│  ┌──────────────┐   ┌──────────────┐                    │
│  │  PG (5432)   │   │ Redis (6379) │                    │
│  └──────────────┘   └──────────────┘                    │
│                                                          │
│  ┌──────────────────┐                                    │
│  │  node_exporter   │ (host network)                     │
│  │  :9100           │                                    │
│  └──────────────────┘                                    │
└──────────────────────────────────────────────────────────┘
```

### 数据流

```
node_exporter  ─┐
pg_exporter    ─┤
redis_exporter ─┼──▶ Prometheus (scrape 15s) ──▶ Grafana (dashboard)
new-api /metrics─┤                     │
nginx stub_status┘                     ▼
                                  Alertmanager ──▶ Webhook/Email
```

---

## 二、资源预算

| 服务 | 镜像 | 内存限制 | 预计实际 | CPU 限制 |
|------|------|----------|----------|----------|
| Prometheus | prom/prometheus:v2.53-lts | 200MB | ~80MB | 0.3 |
| Grafana | grafana/grafana-oss:11.6-lts | 128MB | ~60MB | 0.2 |
| Alertmanager | prom/alertmanager:v0.28 | 64MB | ~20MB | 0.1 |
| node_exporter | prom/node-exporter:v1.9 | 32MB | ~10MB | 0.05 |
| postgres_exporter | prometheuscommunity/postgres-exporter:v0.16 | 32MB | ~15MB | 0.05 |
| redis_exporter | oliver006/redis_exporter:v1.67 | 32MB | ~10MB | 0.05 |
| **合计** | | **488MB (limits)** | **~195MB** | **0.75** |

> 实际预计 ~195MB，留有余量到 488MB limits。系统可用 727MB 减去 195MB ≈ 530MB 富余。

---

## 三、监控目标清单

### 3.1 New-API 应用指标

New-API 目前**无原生 /metrics 端点**，但有：
- `middleware/stats.go` — 活跃连接数 (in-memory atomic counter)
- `common/system_monitor.go` — CPU/Memory/Disk (gopsutil, 5s 刷新)
- `middleware/performance.go` — 阈值保护 (CPU/Mem/Disk > 90% → 503)
- Gin 请求日志 — `[GIN] timestamp | tag | request_id | status | latency | ip | method | path`
- `prometheus/client_golang` — **已在 go.mod 中 (indirect)**

**方案: 通过 Prometheus 黑盒 + Gin 日志解析**

| 指标 | 采集方式 | 说明 |
|------|----------|------|
| 服务存活 | `GET /api/status` (HTTP probe) | 健康检查 |
| HTTP 请求 (RPS/延迟) | Nginx `stub_status` + 日志 | 不侵入应用 |
| 活跃连接 | Nginx `stub_status` | `active`, `reading`, `writing`, `waiting` |
| 容器资源 | cAdvisor / Docker metrics | CPU/Mem/Network per container |

### 3.2 基础设施指标

| 目标 | Exporter | 端口 | 关键指标 |
|------|----------|------|----------|
| 主机 | node_exporter | :9100 | CPU/RAM/Disk/Network/Load |
| PostgreSQL | postgres_exporter | :9187 | 连接数/事务/锁/表膨胀/复制延迟 |
| Redis | redis_exporter | :9121 | 连接数/内存/命中率/键数/淘汰 |
| Nginx | stub_status (内置) | /nginx_status | 活跃连接/RPS/等待 |
| Docker | Docker daemon metrics | :9323 | 容器状态/资源 (可选) |

### 3.3 Nginx stub_status 配置

需在现有 nginx.conf 中添加:
```nginx
location /nginx_status {
    stub_status;
    allow 172.16.0.0/12;   # Docker 内网
    allow 127.0.0.1;
    deny all;
}
```

---

## 四、告警规则

### 4.1 Critical (立即通知)

| 规则 | 条件 | 持续 |
|------|------|------|
| NewApiDown | `probe_success{job="new-api"} == 0` | 1m |
| PostgresDown | `pg_up == 0` | 1m |
| RedisDown | `redis_up == 0` | 1m |
| DiskSpaceCritical | `node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.10` | 5m |
| MemoryCritical | `node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes < 0.10` | 5m |
| ContainerOOM | `container_oom_events_total increase > 0` | 0 |

### 4.2 Warning (延迟通知)

| 规则 | 条件 | 持续 |
|------|------|------|
| HighCPU | `node_load1 > 2 * count(node_cpu_seconds_total{mode="idle"})` | 10m |
| DiskSpaceWarning | `avail/total < 0.20` | 10m |
| MemoryWarning | `available/total < 0.20` | 10m |
| PGConnectionsHigh | `pg_stat_activity_count > 80` (max=100) | 5m |
| RedisMemoryHigh | `redis_memory_used_bytes / redis_memory_max_bytes > 0.80` | 5m |
| NginxHighLatency | P95 upstream response > 5s | 5m |
| NewApiHighErrorRate | HTTP 5xx > 5% of total requests | 5m |

### 4.3 Info (仅记录)

| 规则 | 条件 |
|------|------|
| ContainerRestarted | `increase(container_restart_count[1h]) > 0` |
| NewApiHealthDegraded | `/api/status` 响应时间 > 2s |

---

## 五、Grafana Dashboard

### 5.1 Dashboard 规划

| Dashboard | 面板数 | 数据源 |
|-----------|--------|--------|
| **System Overview** | 8 | node_exporter |
| **New-API Application** | 6 | Nginx + blackbox |
| **PostgreSQL** | 8 | postgres_exporter |
| **Redis** | 6 | redis_exporter |
| **Alert History** | 2 | Alertmanager |

### 5.2 System Overview Panels

- CPU 使用率 (多核) + Load Average
- 内存使用 (used/cached/available)
- 磁盘 I/O (read/write IOPS + throughput)
- 磁盘空间 (使用率 + 趋势预测)
- 网络流量 (in/out bytes + packets)
- 系统进程数 + 文件描述符
- 容器资源对比 (CPU/Mem per container)
- Uptime

### 5.3 New-API Application Panels

- 服务健康 (up/down timeline)
- Nginx 活跃连接 + RPS
- HTTP 状态码分布 (2xx/4xx/5xx)
- 上游响应时间
- 请求体大小分布
- 容器 CPU/Mem 趋势

### 5.4 PostgreSQL Panels

- 连接数 (active/idle/waiting)
- 事务率 (commits/rollbacks per second)
- 缓存命中率 (buffer hit ratio)
- 表膨胀 (dead tuples)
- 锁等待
- 查询延迟分布
- WAL 大小
- 数据库大小趋势

### 5.5 Redis Panels

- 连接数
- 内存使用 + 碎片率
- 命中率 (hits / hits+misses)
- 键总数 + 过期键
- 淘汰键数
- 命令延迟

---

## 六、配置文件清单

| 文件 | 用途 | 挂载到 |
|------|------|--------|
| `prometheus.yml` | Prometheus 主配置 | prometheus:/etc/prometheus/ |
| `alert-rules.yml` | 告警规则 | prometheus:/etc/prometheus/rules/ |
| `alertmanager.yml` | Alertmanager 配置 | alertmanager:/etc/alertmanager/ |
| `grafana-datasources.yml` | 自动配置数据源 | grafana:/etc/grafana/provisioning/datasources/ |
| `grafana-dashboards.yml` | Dashboard 自动发现 | grafana:/etc/grafana/provisioning/dashboards/ |
| `dashboards/*.json` | Dashboard JSON 定义 | grafana:/var/lib/grafana/dashboards/ |
| `docker-compose.monitoring.yml` | 监控栈 Compose | /opt/new-api/ |
| `nginx-status.conf` | Nginx stub_status | 追加到现有 nginx.conf |

---

## 七、部署前检查

- [ ] 服务器可用内存 ≥ 500MB
- [ ] 磁盘剩余 ≥ 10GB (TSDB + Grafana 数据)
- [ ] 现有 4 容器运行正常 (`docker ps`)
- [ ] 端口 3099/9090/9093/9100/9121/9187 未占用
- [ ] 生产 .env 文件可读 (PG_PASSWORD / REDIS_PASSWORD)
- [ ] Nginx 配置可写 (`/opt/new-api/config/nginx.conf`)

---

## 八、部署后验证矩阵

| # | 验证项 | 方法 | 预期 | 通过 |
|---|--------|------|------|------|
| 1 | Prometheus 启动 | `curl localhost:9090/-/healthy` | 200 | [ ] |
| 2 | Prometheus targets | `curl localhost:9090/api/v1/targets` | 所有 target UP | [ ] |
| 3 | Grafana 启动 | `curl localhost:3099/api/health` | 200 | [ ] |
| 4 | Grafana 数据源 | UI → Connections → Data sources | Prometheus 已配置 | [ ] |
| 5 | Alertmanager 启动 | `curl localhost:9093/-/healthy` | 200 | [ ] |
| 6 | node_exporter | `curl localhost:9100/metrics` | 指标输出 | [ ] |
| 7 | postgres_exporter | `curl localhost:9187/metrics` | `pg_up 1` | [ ] |
| 8 | redis_exporter | `curl localhost:9121/metrics` | `redis_up 1` | [ ] |
| 9 | nginx stub_status | `curl new-api-nginx/nginx_status` | Active connections | [ ] |
| 10 | System Dashboard | Grafana → System Overview | CPU/Mem/Disk 图表 | [ ] |
| 11 | PG Dashboard | Grafana → PostgreSQL | 连接数/事务图表 | [ ] |
| 12 | Redis Dashboard | Grafana → Redis | 内存/命中率图表 | [ ] |
| 13 | NewApi Dashboard | Grafana → New-API | 健康/RPS 图表 | [ ] |
| 14 | 告警规则加载 | Prometheus → Alerts | 规则列表显示 | [ ] |
| 15 | 测试告警 | 手动触发 (停止 redis 30s) | Alertmanager 收到 | [ ] |
| 16 | 内存占用 | `docker stats --no-stream` | 监控栈总计 < 350MB | [ ] |
| 17 | 原服务不受影响 | `curl localhost:3088/api/status` | new-api 正常 | [ ] |

---

## 九、数据保留与维护

| 项目 | 策略 |
|------|------|
| TSDB 保留 | 7 天 (`--storage.tsdb.retention.time=7d`) |
| TSDB 大小限制 | 500MB (`--storage.tsdb.retention.size=500MB`) |
| Scrape interval | 15s (默认), node_exporter 30s |
| 预计日增 | ~50-70MB (6 targets × 15s) |
| Grafana 数据库 | SQLite (默认), 挂载持久卷 |
| 备份 | Prometheus TSDB snapshot + Grafana provisioning (配置即代码) |

---

## 十、回滚方案

监控栈完全独立于应用栈：

```bash
# 停止监控栈 (不影响应用)
cd /opt/new-api
docker compose -f docker-compose.monitoring.yml down

# 如需彻底清除
docker volume rm new-api_prometheus_data new-api_grafana_data
```

撤销 Nginx 变更:
```bash
# 从 nginx.conf 移除 /nginx_status location block
# 然后 docker exec new-api-nginx nginx -s reload
```

---

*清单编制: ops-prjlite999 | 日期: 2026-04-11*
