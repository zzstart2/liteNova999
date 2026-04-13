#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-017 回滚脚本 — 监控告警系统
# 用法: bash rollback-T017.sh [--purge]
#   --purge: 删除持久卷 (TSDB + Grafana 数据)
# =============================================================================
set -eo pipefail

DEPLOY_DIR="/opt/new-api"
PURGE=false
[ "${1:-}" = "--purge" ] && PURGE=true

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
info() { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }

# ===== Stop monitoring stack =====
info "Stopping monitoring stack..."
cd "$DEPLOY_DIR"

if [ -f docker-compose.monitoring.yml ]; then
    docker compose -f docker-compose.monitoring.yml down 2>&1 || true
    ok "Monitoring containers stopped"
else
    info "docker-compose.monitoring.yml not found — checking for individual containers"
    for c in new-api-prometheus new-api-grafana new-api-alertmanager new-api-node-exporter new-api-pg-exporter new-api-redis-exporter; do
        docker rm -f "$c" 2>/dev/null || true
    done
fi

# ===== Purge volumes if requested =====
if [ "$PURGE" = true ]; then
    info "Purging monitoring data volumes..."
    for vol in new-api_prometheus_data new-api_grafana_data new-api_alertmanager_data; do
        docker volume rm "$vol" 2>/dev/null && ok "Removed $vol" || true
    done
fi

# ===== Revert Nginx stub_status =====
NGINX_CONF="$DEPLOY_DIR/config/nginx.conf"
if [ -f "$NGINX_CONF" ] && grep -q "stub_status" "$NGINX_CONF"; then
    info "Removing Nginx stub_status block..."
    sed -i '/# --- Monitoring: stub_status (T-017) ---/,/^    }/d' "$NGINX_CONF"
    docker exec new-api-nginx nginx -t 2>&1 | grep -q "successful" && \
        docker exec new-api-nginx nginx -s reload
    ok "Nginx stub_status removed and reloaded"
fi

# ===== Verify original services =====
info "Verifying original services..."
API_STATUS=$(curl -sf "http://127.0.0.1:3001/api/status" 2>/dev/null || echo "")
if echo "$API_STATUS" | grep -q '"success".*true'; then
    ok "New-API is healthy"
else
    echo -e "${RED}[WARN]${NC} New-API health check failed — please investigate"
fi

echo ""
ok "Monitoring stack rolled back successfully."
[ "$PURGE" = true ] && info "Data volumes purged." || info "Data volumes preserved. Use --purge to remove."
