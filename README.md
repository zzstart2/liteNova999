# 千问 API 中转平台 (LiteNova)

基于 [One-API](https://github.com/songquanpeng/one-api) 二次开发的千问 API 中转平台。

## 功能
- 千问 (Qwen) API 统一转发，兼容 OpenAI SDK
- 多用户分组限流（basic/standard/premium/admin）
- Token 级计费 + 模型倍率
- API Key 管理 + 安全加固
- 管理后台 Dashboard

## 技术栈
- One-API v0.6.11 (Go + React)
- PostgreSQL 14
- Redis 7
- Nginx + HTTPS
- Docker Compose

## 快速部署

```bash
# 1. 复制配置
cp .env.example .env
# 编辑 .env 填入密码

# 2. 启动
docker compose up -d

# 3. 访问
# 管理后台: http://your-ip:3000
# API: http://your-ip:3000/v1/chat/completions
```

## 模型支持

| 模型 | 倍率 | 说明 |
|------|------|------|
| qwen-turbo | 1.2x | 基础模型 |
| qwen-plus | 2.0x | 增强模型 |
| qwen-max | 8.0x | 旗舰模型 |
| qwen-max-longcontext | 10.0x | 长文本模型 |

### OpenAI 兼容映射
- `gpt-3.5-turbo` → `qwen-turbo`
- `gpt-4` → `qwen-max`

## 目录结构

```
├── docker-compose.yml     # 容器编排
├── deploy/
│   └── nginx/conf.d/      # Nginx 配置
├── scripts/               # 运维脚本
├── docs/                  # 技术文档
└── team/                  # Sprint 管理
```

## 产品文档
[飞书文档：千问API中转平台产品调研与评审](https://feishu.cn/docx/Gl3kdA83Ho6H9KxMLBocfCtYn8b)
