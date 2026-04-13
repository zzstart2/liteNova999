# 部署验证报告 — PRJ-LITE999-T-016

> **任务:** PRJ-LITE999-T-016 — 生产环境部署  
> **部署日期:** 2026-04-11  
> **服务器:** iZt4n0wa8waspa7l8knxzuZ (2C/3.5G/40G SSD, Alibaba Cloud)  
> **执行人:** ops-prjlite999

---

## 部署结果: ✅ 全部通过

---

## 一、部署适配说明

原方案面向推荐配置 (12C+ / 17G+)，当前服务器 2C/3.5G，做了以下精简适配：

| 原方案 | 实际部署 | 原因 |
|--------|----------|------|
| 双节点 (Master + Slave) | 单节点 (Master only) | 资源不足以跑双节点 |
| Nginx TLS 终止 (443) | Nginx HTTP 代理 (:3088) | 443 被 OpenClaw gateway 占用 |
| PG shared_buffers 2GB | 128MB | 总内存 3.5G，需给其他服务留空间 |
| Redis maxmemory 1GB | 256MB | 同上 |
| 应用连接池 1000 | 50 | 匹配 PG max_connections=100 |
| 移除 `DATA_EXPORT_ENABLED/INTERVAL` | — | 测试报告 F001: 源码中不存在 |
| `limit_req_zone` 移至正确位置 | conf.d 文件顶部 | 测试报告 W002: Nginx 语法要求 |
| `RELAY_TIMEOUT=60` → `120` | — | 测试报告 W001: 兼容长推理模型 |
| 补充 `/api/` 限流 | 已添加 | 测试报告 W003 |

---

## 二、服务状态验证 (18/18 通过)

### 基础设施层

| # | 测试项 | 结果 | 详情 |
|---|--------|------|------|
| 1 | 容器启动状态 | ✅ | 4/4 容器 Running |
| 2 | 健康检查 | ✅ | new-api=healthy, PG=healthy, Redis=healthy |
| 5 | PostgreSQL 连接 | ✅ | PG 15.17, Alpine |
| 6 | Redis 连接 | ✅ | PONG |
| 13 | 数据库自动建表 | ✅ | 25 张表自动创建 |
| 7 | 资源消耗 | ✅ | 全栈仅 ~93MB (new-api 38M + PG 44M + Redis 9M + Nginx 3M) |

### 应用层

| # | 测试项 | 结果 | 详情 |
|---|--------|------|------|
| 3 | 直接 API 健康检查 (:3001) | ✅ | HTTP 200, `"success": true`, v0.12.6 |
| 4 | Nginx 代理健康检查 (:3088) | ✅ | HTTP 200, 完整 JSON 响应 |
| 9 | SSE 流式端点 | ✅ | HTTP 401 (正确拒绝无 token 请求) |
| 10 | WebSocket 端点 | ✅ | HTTP 401 (正确鉴权) |
| 11 | 前端页面加载 | ✅ | HTTP 200, 1726 bytes, 1.15ms |
| 14 | 应用日志 | ✅ | GIN release 模式, 正常请求日志 |

### 安全层

| # | 测试项 | 结果 | 详情 |
|---|--------|------|------|
| 8 | Nginx 配置语法 | ✅ | `syntax is ok`, `test is successful` |
| 12 | IP 限流 | ✅ | 60 次快速请求: 59 成功 / 1 被限流 (30r/s burst=50) |
| 17 | 端口暴露安全 | ✅ | PG/Redis 零外部暴露; 应用仅 127.0.0.1:3001 |

### 运维层

| # | 测试项 | 结果 | 详情 |
|---|--------|------|------|
| 15 | 数据库备份 | ✅ | 87KB dump 文件成功创建 |
| 16 | 用户表初始化 | ✅ | 空表 (setup=false, 等待首次管理员注册) |
| 18 | 代理延迟 | ✅ | 直连 1.48ms vs Nginx 1.29ms (无可感知延迟) |

---

## 三、部署清单

### 文件结构

```
/opt/new-api/
├── .env                          # 密钥和环境变量 (随机生成)
├── docker-compose.prod.yml       # 生产 Compose 配置
├── backup.sh                     # 每日备份脚本
├── config/
│   ├── nginx.conf                # Nginx 反向代理配置
│   ├── postgresql.conf           # PG 调优配置
│   └── redis.conf                # Redis 配置
├── backups/                      # 数据库备份目录
├── data/                         # 应用数据
└── logs/                         # 应用日志
```

### Docker 服务

| 容器 | 镜像 | 端口 | 资源限制 | 内存实际 |
|------|------|------|----------|----------|
| new-api | calciumion/new-api:latest (v0.12.6) | 127.0.0.1:3001→3000 | 1.5C/1G | 38MB |
| new-api-pg | postgres:15-alpine | 内部 5432 | 1C/512M | 44MB |
| new-api-redis | redis:7-alpine | 内部 6379 | 0.5C/384M | 9MB |
| new-api-nginx | nginx:1.27-alpine | 0.0.0.0:3088→80 | 0.5C/128M | 3MB |

### 定时任务

| 任务 | 频率 | 命令 |
|------|------|------|
| PG 全量备份 | 每日 02:00 | `/opt/new-api/backup.sh` |
| 备份清理 | 每日 02:00 (内嵌) | 保留 7 天 |

### 密钥管理

| 密钥 | 生成方式 | 存储位置 |
|------|----------|----------|
| SESSION_SECRET | `openssl rand -hex 32` | `/opt/new-api/.env` |
| CRYPTO_SECRET | `openssl rand -hex 32` | `/opt/new-api/.env` |
| PG_PASSWORD | `openssl rand -hex 16` | `/opt/new-api/.env` |
| REDIS_PASSWORD | `openssl rand -hex 16` | `/opt/new-api/.env` |

---

## 四、部署后系统资源

| 指标 | 部署前 | 部署后 | 变化 |
|------|--------|--------|------|
| 内存使用 | 2.6G / 3.5G | 2.7G / 3.5G | +~100MB |
| 可用内存 | 882MB | 833MB | -49MB |
| 磁盘使用 | 23G / 40G (58%) | 23G / 40G (61%) | +~1.2G (镜像) |
| Docker 镜像 | 2 (1.98GB) | 6 (~2.2GB) | +4 镜像 |

---

## 五、访问信息

| 入口 | 地址 | 说明 |
|------|------|------|
| 管理后台 (Nginx) | `http://<服务器IP>:3088` | 首次访问需注册管理员 |
| 管理后台 (直连) | `http://127.0.0.1:3001` | 仅本机可达 |
| API 端点 | `http://<服务器IP>:3088/v1/` | OpenAI 兼容 API |
| 健康检查 | `http://<服务器IP>:3088/api/status` | LB / Uptime Kuma 用 |

### 下一步操作

1. **注册管理员**: 浏览器访问 `http://<IP>:3088` 完成首次注册
2. **配置渠道**: 在管理后台添加上游 AI 渠道 (OpenAI/Claude/等)
3. **TLS 配置**: 如需 HTTPS，可配置域名 + Cloudflare 或 Let's Encrypt
4. **扩容**: 如需添加 Slave 节点，按方案第八节操作

---

## 六、常用运维命令

```bash
# 查看状态
cd /opt/new-api && docker compose -f docker-compose.prod.yml ps

# 查看日志
docker logs -f new-api --tail 50

# 重启应用
docker compose -f docker-compose.prod.yml restart new-api

# 版本更新
docker compose -f docker-compose.prod.yml pull new-api
docker compose -f docker-compose.prod.yml up -d --no-deps new-api

# 手动备份
/opt/new-api/backup.sh

# 恢复备份
docker exec -i new-api-pg pg_restore -U newapi -d newapi < backups/newapi_YYYYMMDD.dump
```

---

*部署报告编制: ops-prjlite999 | 日期: 2026-04-11*
