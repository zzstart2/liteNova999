# 生产环境部署方案 — PRJ-LITE999-T-016

> **任务:** PRJ-LITE999-T-016 — 生产环境部署方案
> **依赖:** PRJ-LITE999-T-002 (开发环境搭建与项目初始化)
> **日期:** 2026-04-10

---

## 一、架构总览

```
                    ┌──────────────┐
                    │   Clients    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │    Nginx     │  ← TLS 终止 / 限流 / 静态缓存
                    │  (L7 反向代理) │
                    └──┬───────┬───┘
                       │       │
              ┌────────▼──┐ ┌──▼────────┐
              │ new-api-1 │ │ new-api-2 │  ← 应用节点 (可水平扩展)
              │  (master) │ │  (slave)  │
              └─────┬─────┘ └─────┬─────┘
                    │             │
         ┌──────────┼─────────────┼──────────┐
         │          │             │           │
    ┌────▼────┐ ┌───▼────┐ ┌─────▼─────┐ ┌──▼──────────┐
    │  PG 15  │ │ Redis 7│ │ PG-Logs   │ │  Monitoring  │
    │ (主库)  │ │ (缓存)  │ │ (日志库)  │ │ Prometheus   │
    │         │ │        │ │  可选分离   │ │ + Grafana    │
    └─────────┘ └────────┘ └───────────┘ └──────────────┘
```

### 部署规格建议

| 组件 | 最低配置 | 推荐配置 | 说明 |
|------|----------|----------|------|
| Nginx | 1C1G | 2C2G | 单节点即可，高并发可加 |
| new-api (每节点) | 1C2G | 2C4G | CPU 密集型少，内存主要是连接池 |
| PostgreSQL | 2C4G | 4C8G + SSD | 核心瓶颈在 IO |
| PostgreSQL-Logs | - | 2C4G + SSD | 大流量时分离 |
| Redis | 1C1G | 2C2G | 内存型，关注 maxmemory |

---

## 二、负载均衡层 (Nginx)

### 2.1 核心配置

```nginx
# /etc/nginx/conf.d/new-api.conf

upstream new_api_backend {
    # 加权轮询 — master 节点权重可高些
    server 127.0.0.1:3001 weight=3;  # new-api-1 (master)
    server 127.0.0.1:3002 weight=2;  # new-api-2 (slave)
    # 更多节点在此添加

    keepalive 64;  # 后端长连接池
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    # --- TLS ---
    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;

    # --- 全局安全头 ---
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # --- 请求体大小 (图片/音频上传) ---
    client_max_body_size 50m;

    # --- 全局限流 ---
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;

    # --- 健康检查端点 (不限流) ---
    location = /api/status {
        proxy_pass http://new_api_backend;
        proxy_set_header Host $host;
    }

    # --- API 透传路由 ---
    location /v1/ {
        limit_req zone=api_limit burst=50 nodelay;

        proxy_pass http://new_api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_http_version 1.1;

        # SSE 流式响应
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;

        # 重试 (仅安全方法)
        proxy_next_upstream error timeout http_502 http_503;
        proxy_next_upstream_tries 2;
    }

    # --- WebSocket (实时音频) ---
    location /v1/realtime {
        proxy_pass http://new_api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # --- 管理后台 ---
    location / {
        proxy_pass http://new_api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 静态资源缓存
        location ~* \.(js|css|png|jpg|ico|svg|woff2?)$ {
            proxy_pass http://new_api_backend;
            proxy_cache_valid 200 7d;
            add_header Cache-Control "public, max-age=604800";
        }
    }
}

# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name api.example.com;
    return 301 https://$host$request_uri;
}
```

### 2.2 Nginx 关键参数

| 参数 | 值 | 说明 |
|------|-----|------|
| `worker_processes` | `auto` | 匹配 CPU 核数 |
| `worker_connections` | `4096` | 每 worker 最大连接数 |
| `keepalive` (upstream) | `64` | 后端长连接池大小 |
| `proxy_read_timeout` | `300s` | SSE 流式超时 |
| `client_max_body_size` | `50m` | 图片/音频上传 |
| `limit_req rate` | `30r/s` burst `50` | IP 级限流 |

---

## 三、应用层 (New-API 多节点)

### 3.1 多节点架构

New-API 原生支持 Master/Slave 多节点部署：

| 节点类型 | 环境变量 | 职责 |
|----------|----------|------|
| Master | `NODE_TYPE=master` (默认) | 全部功能 + 定时任务 (渠道巡检/数据聚合/配额同步) |
| Slave | `NODE_TYPE=slave` | 仅处理 API 请求，不执行定时任务 |

**关键约束：**
- 所有节点必须共享同一 `SESSION_SECRET` (会话一致性)
- 所有节点必须共享同一 `CRYPTO_SECRET` (加密一致性)
- 所有节点连接同一 PostgreSQL 和 Redis
- Master 仅一个 (避免定时任务重复执行)

### 3.2 环境变量全量清单

```bash
# ====== 必填 ======
SQL_DSN=postgresql://newapi:${PG_PASSWORD}@pg-host:5432/newapi?sslmode=require
REDIS_CONN_STRING=redis://:${REDIS_PASSWORD}@redis-host:6379/0
SESSION_SECRET=${RANDOM_HEX_32}      # openssl rand -hex 32
CRYPTO_SECRET=${RANDOM_HEX_32}       # openssl rand -hex 32

# ====== 节点角色 ======
NODE_TYPE=master                      # 或 slave

# ====== 数据库连接池 ======
SQL_MAX_IDLE_CONNS=100
SQL_MAX_OPEN_CONNS=1000
SQL_MAX_LIFETIME=60                   # 秒

# ====== 日志库 (可选分离) ======
# LOG_SQL_DSN=postgresql://newapi:${PG_PASSWORD}@pg-logs-host:5432/newapi_logs

# ====== Redis 连接池 ======
REDIS_POOL_SIZE=10

# ====== 性能调优 ======
BATCH_UPDATE_ENABLED=true
BATCH_UPDATE_INTERVAL=5               # 秒
SYNC_FREQUENCY=60                     # 秒, 数据库同步频率
STREAMING_TIMEOUT=300                 # 秒, 流式超时
RELAY_TIMEOUT=60                      # 秒, 非流式超时

# ====== 渠道监控 ======
CHANNEL_TEST_FREQUENCY=10             # 分钟, 自动巡检间隔
POLLING_INTERVAL=2                    # 秒, 巡检请求间隔

# ====== 数据看板 ======
DATA_EXPORT_ENABLED=true
DATA_EXPORT_INTERVAL=5                # 分钟

# ====== 安全 ======
GIN_MODE=release
TZ=Asia/Shanghai
ERROR_LOG_ENABLED=true

# ====== 监控 (可选) ======
ENABLE_PPROF=true                     # Go pprof
# PYROSCOPE_URL=http://pyroscope:4040 # 持续性能分析
# PYROSCOPE_APP_NAME=new-api
```

---

## 四、数据库层 (PostgreSQL)

### 4.1 主库配置

```ini
# postgresql.conf 关键调优参数

# 连接
max_connections = 200
superuser_reserved_connections = 3

# 内存 (假设 8G 实例)
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 16MB
maintenance_work_mem = 512MB

# WAL
wal_buffers = 64MB
max_wal_size = 2GB
min_wal_size = 512MB
checkpoint_completion_target = 0.9

# 查询优化
random_page_cost = 1.1          # SSD
effective_io_concurrency = 200  # SSD

# 日志
log_min_duration_statement = 1000  # 慢查询 > 1s
log_checkpoints = on
log_connections = on
log_disconnections = on
```

### 4.2 日志库 (可选)

当日均请求 > 10 万时，建议将 `logs` 表分离到独立 PostgreSQL 实例：

```bash
# 应用配置
LOG_SQL_DSN=postgresql://newapi:${PG_LOGS_PASSWORD}@pg-logs-host:5432/newapi_logs
```

### 4.3 备份策略

```bash
# 每日全量备份 (cron: 02:00)
0 2 * * * pg_dump -U newapi -Fc newapi > /backups/newapi_$(date +\%Y\%m\%d).dump

# 保留 7 天
0 3 * * * find /backups -name "newapi_*.dump" -mtime +7 -delete

# WAL 归档 (实现 PITR)
archive_mode = on
archive_command = 'cp %p /wal_archive/%f'
```

---

## 五、缓存层 (Redis)

### 5.1 Redis 配置

```conf
# redis.conf

# 内存限制
maxmemory 1gb
maxmemory-policy allkeys-lru

# 持久化 (RDB + AOF)
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec

# 连接
maxclients 10000
timeout 300

# 安全
requirepass ${REDIS_PASSWORD}
```

### 5.2 Redis 在 New-API 中的用途

| 用途 | Key 模式 | 说明 |
|------|----------|------|
| 渠道缓存 | `channel:*` | 渠道配置缓存，减少 DB 查询 |
| 用户缓存 | `user:*` | 用户信息/配额缓存 |
| 限流计数 | `rate:*` | 模型级别/IP 级别限流 |
| 渠道亲和 | `affinity:*` | 渠道亲和路由 |
| 配置同步 | `option:*` | 多节点配置同步 |
| Token 缓存 | `token:*` | API Key 校验缓存 |

---

## 六、监控层

### 6.1 监控架构

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  new-api    │────▶│ Prometheus  │────▶│   Grafana    │
│  (pprof)    │     │  (采集)     │     │  (可视化)     │
└─────────────┘     └──────┬──────┘     └──────────────┘
                           │
┌─────────────┐            │
│  PostgreSQL │────────────┤  postgres_exporter
└─────────────┘            │
                           │
┌─────────────┐            │
│    Redis    │────────────┤  redis_exporter
└─────────────┘            │
                           │
┌─────────────┐            │
│    Nginx    │────────────┘  nginx-prometheus-exporter
└─────────────┘

┌─────────────┐
│ Uptime Kuma │  ← 外部可用性拨测
└─────────────┘
```

### 6.2 关键监控指标

| 层级 | 指标 | 告警阈值 |
|------|------|----------|
| **应用** | 活跃连接数 (`/api/performance/stats`) | > 500 |
| | 请求延迟 P99 | > 10s |
| | 错误率 (5xx) | > 5% / 2min |
| | 渠道自动禁用数 | > 20% 渠道禁用 |
| **数据库** | 连接数 | > 80% max_connections |
| | 慢查询 (>1s) | > 10/min |
| | 磁盘使用率 | > 85% |
| | Replication lag (如有) | > 30s |
| **Redis** | 内存使用率 | > 80% maxmemory |
| | 连接数 | > 80% maxclients |
| | Key eviction rate | > 100/s |
| **Nginx** | 4xx 率 | > 20% / 5min |
| | 5xx 率 | > 5% / 2min |
| | 连接排队 | > 100 |

### 6.3 内置监控端点

| 端点 | 方法 | 权限 | 用途 |
|------|------|------|------|
| `/api/status` | GET | 公开 | 健康检查 (Uptime Kuma / LB 用) |
| `/api/uptime/status` | GET | 公开 | Uptime Kuma 专用 |
| `/api/performance/stats` | GET | Root | CPU/内存/磁盘/连接数/缓存统计 |
| `/api/performance/logs` | GET | Root | 日志文件列表 |
| `/api/performance/gc` | POST | Root | 手动触发 GC |
| `/debug/pprof/*` | GET | 网络隔离 | Go pprof 性能剖析 |

---

## 七、生产 Docker Compose

```yaml
# docker-compose.prod.yml

version: '3.8'

services:
  # ===== 应用节点 1 (Master) =====
  new-api-master:
    image: ghcr.io/${REPO_OWNER}/new-api:${VERSION}
    container_name: new-api-master
    restart: always
    command: --log-dir /app/logs
    ports:
      - "127.0.0.1:3001:3000"
    volumes:
      - master_data:/data
      - master_logs:/app/logs
    environment:
      - NODE_TYPE=master
      - SQL_DSN=${SQL_DSN}
      - REDIS_CONN_STRING=${REDIS_CONN_STRING}
      - SESSION_SECRET=${SESSION_SECRET}
      - CRYPTO_SECRET=${CRYPTO_SECRET}
      - TZ=Asia/Shanghai
      - GIN_MODE=release
      - BATCH_UPDATE_ENABLED=true
      - BATCH_UPDATE_INTERVAL=5
      - SYNC_FREQUENCY=60
      - STREAMING_TIMEOUT=300
      - RELAY_TIMEOUT=60
      - CHANNEL_TEST_FREQUENCY=10
      - POLLING_INTERVAL=2
      - DATA_EXPORT_ENABLED=true
      - ERROR_LOG_ENABLED=true
      - ENABLE_PPROF=true
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O - http://localhost:3000/api/status | grep -o '\"success\":\\s*true' || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 512M

  # ===== 应用节点 2 (Slave) =====
  new-api-slave:
    image: ghcr.io/${REPO_OWNER}/new-api:${VERSION}
    container_name: new-api-slave
    restart: always
    command: --log-dir /app/logs
    ports:
      - "127.0.0.1:3002:3000"
    volumes:
      - slave_data:/data
      - slave_logs:/app/logs
    environment:
      - NODE_TYPE=slave
      - SQL_DSN=${SQL_DSN}
      - REDIS_CONN_STRING=${REDIS_CONN_STRING}
      - SESSION_SECRET=${SESSION_SECRET}
      - CRYPTO_SECRET=${CRYPTO_SECRET}
      - TZ=Asia/Shanghai
      - GIN_MODE=release
      - BATCH_UPDATE_ENABLED=true
      - SYNC_FREQUENCY=60
      - STREAMING_TIMEOUT=300
      - RELAY_TIMEOUT=60
      - ERROR_LOG_ENABLED=true
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O - http://localhost:3000/api/status | grep -o '\"success\":\\s*true' || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G

  # ===== PostgreSQL =====
  postgres:
    image: postgres:15-alpine
    container_name: new-api-pg
    restart: always
    environment:
      POSTGRES_USER: newapi
      POSTGRES_PASSWORD: ${PG_PASSWORD}
      POSTGRES_DB: newapi
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./config/postgresql.conf:/etc/postgresql/postgresql.conf:ro
      - ./backups:/backups
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U newapi"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G

  # ===== Redis =====
  redis:
    image: redis:7-alpine
    container_name: new-api-redis
    restart: always
    command: redis-server /usr/local/etc/redis/redis.conf
    volumes:
      - redis_data:/data
      - ./config/redis.conf:/usr/local/etc/redis/redis.conf:ro
    networks:
      - backend
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G

  # ===== Nginx =====
  nginx:
    image: nginx:1.27-alpine
    container_name: new-api-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/nginx.conf:/etc/nginx/conf.d/new-api.conf:ro
      - ./certs:/etc/letsencrypt:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      new-api-master:
        condition: service_healthy
    networks:
      - backend
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G

volumes:
  pg_data:
  redis_data:
  master_data:
  master_logs:
  slave_data:
  slave_logs:
  nginx_logs:

networks:
  backend:
    driver: bridge
```

---

## 八、部署流程

### 8.1 首次部署

```bash
# 1. 准备目录
mkdir -p /opt/new-api/{config,certs,backups}
cd /opt/new-api

# 2. 生成密钥
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
echo "CRYPTO_SECRET=$(openssl rand -hex 32)" >> .env
echo "PG_PASSWORD=$(openssl rand -hex 16)" >> .env
echo "REDIS_PASSWORD=$(openssl rand -hex 16)" >> .env

# 填入其余变量
echo "SQL_DSN=postgresql://newapi:\${PG_PASSWORD}@postgres:5432/newapi" >> .env
echo "REDIS_CONN_STRING=redis://:\${REDIS_PASSWORD}@redis:6379/0" >> .env
echo "VERSION=latest" >> .env
echo "REPO_OWNER=zzstart2" >> .env

# 3. 放入配置文件
# config/nginx.conf    ← 上面第二节的 Nginx 配置
# config/redis.conf    ← 上面第五节的 Redis 配置
# config/postgresql.conf ← 上面第四节的 PostgreSQL 配置
# certs/               ← TLS 证书

# 4. 启动
docker compose -f docker-compose.prod.yml up -d

# 5. 等待健康检查
docker compose -f docker-compose.prod.yml ps
```

### 8.2 版本更新

```bash
cd /opt/new-api

# 备份
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U newapi -Fc newapi > backups/newapi_$(date +%Y%m%d_%H%M%S).dump

# 更新版本
sed -i "s/VERSION=.*/VERSION=v1.2.3/" .env

# 滚动更新 (先 slave 后 master)
docker compose -f docker-compose.prod.yml up -d --no-deps new-api-slave
sleep 30  # 等待 slave 就绪
docker compose -f docker-compose.prod.yml up -d --no-deps new-api-master
```

### 8.3 扩缩容

```bash
# 扩容: 复制 slave 配置，改端口为 3003，加入 Nginx upstream
# 缩容: 从 Nginx upstream 移除 → 等流量排空 → 停止容器
```

---

## 九、安全加固

| 层级 | 措施 |
|------|------|
| 网络 | PostgreSQL/Redis 仅 backend 网络可达，不暴露端口 |
| TLS | Nginx 终止 TLS 1.2+，HSTS 启用 |
| 密钥 | SESSION_SECRET / CRYPTO_SECRET / 数据库密码 均使用随机生成 |
| 限流 | Nginx IP 级 30r/s + 应用 Model 级限流 |
| pprof | 仅 127.0.0.1 可访问 (或 Nginx deny 外部) |
| 管理后台 | 建议设置强密码 + 2FA |
| 数据库 | 最小权限用户，非 root |
| 日志 | 用户可选 IP 记录，默认关闭 |

---

## 十、容灾与恢复

| 场景 | RTO | RPO | 方案 |
|------|-----|-----|------|
| 单应用节点故障 | < 30s | 0 | Nginx 自动摘除，健康检查恢复后加回 |
| 全部应用节点故障 | < 5min | 0 | `docker compose up -d` 重启 |
| PostgreSQL 故障 | < 30min | < 1min | 从备份恢复 + WAL 重放 (PITR) |
| Redis 故障 | < 1min | 可丢失 | 自动重连，缓存冷启动 |
| 数据误删除 | < 1h | 按备份周期 | pg_restore 从最近备份 |

---

*方案编制: ops-prjlite999 | 日期: 2026-04-10*
