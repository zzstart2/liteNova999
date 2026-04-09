#!/bin/bash
# 千问 API 中转平台 — 健康检查

STATUS="healthy"
DETAILS=""

# One-API
ONEAPI=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/status 2>/dev/null)
if [ "$ONEAPI" = "200" ]; then
    DETAILS="$DETAILS\"one_api\":\"ok\","
else
    DETAILS="$DETAILS\"one_api\":\"down\","
    STATUS="unhealthy"
fi

# PostgreSQL (通过 docker health 判断)
PG_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' one-api-db 2>/dev/null || echo "unknown")
if [ "$PG_HEALTH" = "healthy" ]; then
    DETAILS="$DETAILS\"postgres\":\"ok\","
else
    DETAILS="$DETAILS\"postgres\":\"$PG_HEALTH\","
    STATUS="unhealthy"
fi

# Redis (通过 docker health 判断)
REDIS_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' one-api-redis 2>/dev/null || echo "unknown")
if [ "$REDIS_HEALTH" = "healthy" ]; then
    DETAILS="$DETAILS\"redis\":\"ok\","
else
    DETAILS="$DETAILS\"redis\":\"$REDIS_HEALTH\","
    STATUS="unhealthy"
fi

# Nginx
NGINX=$(systemctl is-active nginx 2>/dev/null)
if [ "$NGINX" = "active" ]; then
    DETAILS="$DETAILS\"nginx\":\"ok\","
else
    DETAILS="$DETAILS\"nginx\":\"$NGINX\","
    STATUS="unhealthy"
fi

DETAILS=${DETAILS%,}
echo "{\"status\":\"$STATUS\",$DETAILS,\"timestamp\":\"$(date -Iseconds)\"}"

# 如果不健康，输出到 stderr 给告警用
if [ "$STATUS" = "unhealthy" ]; then
    exit 1
fi
