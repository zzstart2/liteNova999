# 千问 API 中转平台 — 项目导航

## 项目概述
基于 One-API 二次开发的千问 API 中转平台，为下游客户提供鉴权、限流、计费的统一 AI API 网关。

## 技术栈
- **基础**：One-API (Go + React)
- **数据库**：PostgreSQL 14
- **缓存**：Redis 7
- **部署**：Docker Compose + Nginx + Let's Encrypt
- **服务器**：阿里云 ECS ecs.c6.large (2vCPU 4GB)，华东2上海

## 文档导航

| 需要了解 | 文档位置 |
|----------|----------|
| 产品调研与评审 | [飞书文档](https://feishu.cn/docx/Gl3kdA83Ho6H9KxMLBocfCtYn8b) |
| 当前进度 | `PROJECT-STATUS.md` |
| Sprint 任务 | `team/SPRINT.md` |
| 技术决策 | `docs/DECISIONS.md` |

## 上游仓库
- One-API: https://github.com/songquanpeng/one-api

## 服务器
- 待阿哲提供 ECS 信息和域名

## 用户分组
| 分组 | Tokens/月 | 模型范围 | QPS |
|------|-----------|----------|-----|
| basic | 10k | qwen-turbo | 10/min |
| standard | 无限 | turbo+plus | 100/min |
| premium | 无限 | 全模型 | 500/min |
| admin | 无限 | 无限制 | 无限制 |

## 计费倍率
| 模型 | 倍率 |
|------|------|
| qwen-turbo | 1.2x |
| qwen-plus | 2.0x |
| qwen-max | 8.0x |
| qwen-max-longcontext | 10.0x |
