# 千问 API 中转平台 — 技术决策

## 2026-04-09: 基础架构选型

### 决策：基于 One-API 二次开发
- **原因**：31.7k Star，成熟度最高，原生支持千问 DashScope，Go+React 性能好
- **对比**：优于 New-API（社区小）、LiteLLM（商业场景弱）、APIPark（太重）
- **参考**：飞书产品文档调研对比

### 决策：PostgreSQL 14 + Redis 7
- **PG**：高并发、JSON 字段支持、成熟备份
- **Redis**：限流计数器、session 缓存、统计缓存

### 决策：Docker Compose 部署
- **原因**：MVP 阶段足够，一键启停，后续可升级 K8s
- **组件**：One-API + PostgreSQL + Redis + Nginx（4 容器）

### 决策：Nginx 反代 + Let's Encrypt
- **原因**：免费 HTTPS，DDoS 基础防护（limit_conn + limit_req）

## 千问模型映射

| 用户请求 | 实际转发 | 场景 |
|----------|----------|------|
| gpt-3.5-turbo | qwen-turbo | 兼容 OpenAI SDK 调用 |
| gpt-4 | qwen-max | 兼容 OpenAI SDK 调用 |
| qwen-turbo | qwen-turbo | 直接调用 |
| qwen-plus | qwen-plus | 直接调用 |
| qwen-max | qwen-max | 直接调用 |
| qwen-max-longcontext | qwen-max-longcontext | 直接调用 |
