#!/bin/bash
# 千问 API 中转平台 — 部署/更新脚本
# 在 ECS 服务器上执行

set -e

PROJECT_DIR="/root/qwen-proxy"

echo "🚀 部署千问 API 中转平台..."

cd "$PROJECT_DIR"

# 拉取最新代码
git pull origin main 2>/dev/null || echo "Not a git repo on server, skipping pull"

# 更新容器
docker compose pull
docker compose up -d

# 等待健康检查
echo "等待服务启动..."
sleep 5

# 验证
STATUS=$(curl -s http://localhost:3000/api/status | python3 -c "import json,sys;print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
if [ "$STATUS" = "True" ]; then
    echo "✅ One-API 运行正常"
else
    echo "❌ One-API 启动异常"
    docker compose logs --tail 20
    exit 1
fi

echo "✅ 部署完成"
