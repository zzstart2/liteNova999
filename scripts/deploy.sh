#!/bin/bash
# LiteNova — 部署/更新脚本
# 在 ECS 服务器上执行

set -e

PROJECT_DIR="/root/liteNova999"

echo "Deploying LiteNova..."

cd "$PROJECT_DIR"

# 构建镜像
docker compose build

# 滚动更新（DB/Redis 不停）
docker compose up -d

# 等待健康检查
echo "Waiting for healthy..."
for i in $(seq 1 12); do
    sleep 5
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' one-api 2>/dev/null || echo "starting")
    if [ "$STATUS" = "healthy" ]; then
        echo "one-api is healthy"
        break
    fi
    echo "  [${i}] $STATUS"
done

# 验证 API
RESULT=$(curl -sf http://localhost:3000/api/status | python3 -c "import json,sys;print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
if [ "$RESULT" = "True" ]; then
    VERSION=$(curl -s http://localhost:3000/api/status | python3 -c "import json,sys;print(json.load(sys.stdin)['data']['version'])" 2>/dev/null)
    echo "Deploy OK — version: $VERSION"
else
    echo "Deploy FAILED"
    docker compose logs --tail 20 one-api
    exit 1
fi
