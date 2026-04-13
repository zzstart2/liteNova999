#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-019 性能优化部署脚本
# Usage: bash optimize-T019.sh [--apply|--dry-run|--rollback]
# =============================================================================
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PERF_DIR="$(dirname "$SCRIPT_DIR")/performance"
DEPLOY_DIR="/opt/new-api"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

ACTION="${1:-dry-run}"

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

echo "============================================"
echo " T-019 Performance Optimization"
echo " Action: $ACTION"
echo "============================================"

# =============================================
# 备份原始配置
# =============================================
backup_configs() {
    info "备份原始配置..."
    
    [ -f "$DEPLOY_DIR/.env" ] && cp "$DEPLOY_DIR/.env" "$DEPLOY_DIR/.env.bak.$TIMESTAMP"
    [ -f "$DEPLOY_DIR/config/nginx.conf" ] && cp "$DEPLOY_DIR/config/nginx.conf" "$DEPLOY_DIR/config/nginx.conf.bak.$TIMESTAMP"
    [ -f "$DEPLOY_DIR/config/postgresql.conf" ] && cp "$DEPLOY_DIR/config/postgresql.conf" "$DEPLOY_DIR/config/postgresql.conf.bak.$TIMESTAMP"
    [ -f "$DEPLOY_DIR/config/redis.conf" ] && cp "$DEPLOY_DIR/config/redis.conf" "$DEPLOY_DIR/config/redis.conf.bak.$TIMESTAMP"
    
    ok "配置备份完成 (后缀: .bak.$TIMESTAMP)"
}

# =============================================
# 应用优化配置
# =============================================
apply_optimizations() {
    info "应用性能优化配置..."

    # 1. 优化 .env (保留敏感信息)
    if [ -f "$DEPLOY_DIR/.env" ]; then
        source "$DEPLOY_DIR/.env"
        
        # 生成优化版本 (替换占位符)
        sed "s/__KEEP_ORIGINAL__/$SESSION_SECRET/g; s/__KEEP_ORIGINAL__/$CRYPTO_SECRET/g" \
            "$PERF_DIR/.env.optimized" > "$DEPLOY_DIR/.env.tmp"
        
        # 替换其他敏感信息
        sed -i "s|SQL_DSN=__KEEP_ORIGINAL__|SQL_DSN=$SQL_DSN|g" "$DEPLOY_DIR/.env.tmp"
        sed -i "s|REDIS_CONN_STRING=__KEEP_ORIGINAL__|REDIS_CONN_STRING=$REDIS_CONN_STRING|g" "$DEPLOY_DIR/.env.tmp"
        sed -i "s/PG_PASSWORD=__KEEP_ORIGINAL__/PG_PASSWORD=$PG_PASSWORD/g" "$DEPLOY_DIR/.env.tmp"
        sed -i "s/REDIS_PASSWORD=__KEEP_ORIGINAL__/REDIS_PASSWORD=$REDIS_PASSWORD/g" "$DEPLOY_DIR/.env.tmp"
        
        mv "$DEPLOY_DIR/.env.tmp" "$DEPLOY_DIR/.env"
        ok ".env 已优化"
    fi

    # 2. 优化 PostgreSQL 配置
    cp "$PERF_DIR/postgresql.optimized.conf" "$DEPLOY_DIR/config/postgresql.conf"
    ok "PostgreSQL 配置已优化"

    # 3. 优化 Redis 配置
    cp "$PERF_DIR/redis.optimized.conf" "$DEPLOY_DIR/config/redis.conf"
    ok "Redis 配置已优化"

    # 4. 优化 Nginx 配置
    cp "$PERF_DIR/nginx.optimized.conf" "$DEPLOY_DIR/config/nginx.conf"
    ok "Nginx 配置已优化"
}

# =============================================
# 重启服务
# =============================================
restart_services() {
    info "重启服务以应用优化..."
    
    cd "$DEPLOY_DIR"
    
    # 逐个重启 (减少停机时间)
    info "重启 PostgreSQL..."
    docker compose -f docker-compose.prod.yml restart postgres 2>&1 || warn "PG 重启可能失败"
    sleep 5
    
    info "重启 Redis..."
    docker compose -f docker-compose.prod.yml restart redis 2>&1 || warn "Redis 重启可能失败"
    sleep 5
    
    info "重启 Nginx..."
    docker compose -f docker-compose.prod.yml restart nginx 2>&1 || warn "Nginx 重启可能失败"
    sleep 5
    
    info "重启 New-API..."
    docker compose -f docker-compose.prod.yml restart new-api 2>&1 || warn "New-API 重启可能失败"
    sleep 10
    
    ok "服务重启完成"
}

# =============================================
# 验证优化效果
# =============================================
verify_optimizations() {
    info "验证优化效果..."
    
    # 检查容器状态
    UNHEALTHY=$(docker ps --filter "name=new-api" --format "{{.Names}}: {{.Status}}" | grep -v "healthy\|Up" || true)
    if [ -n "$UNHEALTHY" ]; then
        err "容器状态异常:\n$UNHEALTHY"
    fi
    ok "所有容器运行正常"
    
    # 检查 API 响应
    for i in {1..5}; do
        RESP=$(curl -sf http://127.0.0.1:3001/api/status 2>/dev/null) || RESP=""
        if echo "$RESP" | grep -q '"success".*true'; then
            ok "API 响应正常 (尝试 $i)"
            break
        elif [ $i -eq 5 ]; then
            err "API 响应异常"
        fi
        sleep 2
    done
    
    # 验证 PG 配置
    PG_BUFFERS=$(docker exec new-api-pg psql -U newapi -d newapi -t -c "SHOW shared_buffers;" 2>/dev/null | tr -d ' ')
    if [ "$PG_BUFFERS" = "256MB" ]; then
        ok "PostgreSQL shared_buffers = 256MB ✓"
    else
        warn "PostgreSQL shared_buffers = $PG_BUFFERS (期望 256MB)"
    fi
    
    # 验证 Redis 配置
    REDIS_MEM=$(docker exec new-api-redis redis-cli -a "$REDIS_PASSWORD" CONFIG GET maxmemory 2>/dev/null | tail -1)
    if [ "$REDIS_MEM" = "335544320" ]; then  # 320MB in bytes
        ok "Redis maxmemory = 320MB ✓"
    else
        warn "Redis maxmemory = $((REDIS_MEM/1024/1024))MB (期望 320MB)"
    fi
    
    ok "优化验证完成"
}

# =============================================
# 回滚
# =============================================
rollback() {
    info "回滚到优化前配置..."
    
    LATEST_BACKUP=$(ls -t "$DEPLOY_DIR"/.env.bak.* 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        SUFFIX=${LATEST_BACKUP##*.bak.}
        
        cp "$DEPLOY_DIR/.env.bak.$SUFFIX" "$DEPLOY_DIR/.env" 2>/dev/null || true
        cp "$DEPLOY_DIR/config/nginx.conf.bak.$SUFFIX" "$DEPLOY_DIR/config/nginx.conf" 2>/dev/null || true
        cp "$DEPLOY_DIR/config/postgresql.conf.bak.$SUFFIX" "$DEPLOY_DIR/config/postgresql.conf" 2>/dev/null || true
        cp "$DEPLOY_DIR/config/redis.conf.bak.$SUFFIX" "$DEPLOY_DIR/config/redis.conf" 2>/dev/null || true
        
        ok "配置已回滚到 $SUFFIX"
        restart_services
    else
        err "找不到备份文件"
    fi
}

# =============================================
# 主逻辑
# =============================================
case "$ACTION" in
    --dry-run)
        info "DRY RUN — 显示将要应用的优化："
        echo ""
        echo "📊 New-API (.env):"
        echo "  + BATCH_UPDATE_ENABLED=true"
        echo "  + SQL_MAX_OPEN_CONNS=30"
        echo "  + GOMAXPROCS=2, GOMEMLIMIT=800MB"
        echo ""
        echo "🐘 PostgreSQL:"
        echo "  + shared_buffers: 128MB → 256MB"
        echo "  + effective_cache_size: 384MB → 1GB"
        echo "  + max_connections: 100 → 60"
        echo ""
        echo "🔴 Redis:"
        echo "  + maxmemory: 256MB → 320MB"
        echo "  + save 频率优化"
        echo ""
        echo "🌐 Nginx:"
        echo "  + worker_connections: 1024 → 2048"
        echo "  + keepalive: 32 → 16 (节省内存)"
        echo ""
        warn "运行 $0 --apply 来实际应用优化"
        ;;
        
    --apply)
        backup_configs
        apply_optimizations
        restart_services
        verify_optimizations
        ok "性能优化部署完成！"
        echo ""
        info "下一步："
        echo "  1. 运行压力测试: bash stress-test-T019.sh"
        echo "  2. 监控性能: bash monitor-performance.sh"
        echo "  3. 如需回滚: $0 --rollback"
        ;;
        
    --rollback)
        rollback
        ;;
        
    *)
        echo "Usage: $0 [--dry-run|--apply|--rollback]"
        echo ""
        echo "  --dry-run    显示将要应用的优化（默认）"
        echo "  --apply      实际应用性能优化"
        echo "  --rollback   回滚到优化前配置"
        exit 1
        ;;
esac