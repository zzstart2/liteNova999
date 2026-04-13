#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-017 部署脚本 — 监控告警系统
# 用法: GRAFANA_ADMIN_PASSWORD=xxx bash deploy-T017.sh
#
# 前提:
#   1. 生产 docker-compose.prod.yml 已运行 (docker network: new-api_backend)
#   2. /opt/new-api/.env 包含 PG_PASSWORD 和 REDIS_PASSWORD
#   3. GRAFANA_ADMIN_PASSWORD 已设置
# =============================================================================
set -eo pipefail

DEPLOY_DIR="/opt/new-api"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MONITORING_SRC="$SCRIPT_DIR/monitoring"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ===== Pre-flight checks =====
info "Pre-flight checks..."

[ -d "$DEPLOY_DIR" ] || err "Deploy directory $DEPLOY_DIR does not exist"
[ -f "$DEPLOY_DIR/.env" ] || err ".env file not found in $DEPLOY_DIR"

# Source .env for PG_PASSWORD / REDIS_PASSWORD
set -a
source "$DEPLOY_DIR/.env"
set +a

[ -n "$PG_PASSWORD" ] || err "PG_PASSWORD not set in .env"
[ -n "$REDIS_PASSWORD" ] || err "REDIS_PASSWORD not set in .env"
export GRAFANA_ADMIN_PASSWORD="${GRAFANA_ADMIN_PASSWORD:-changeme}"

# Check Docker network exists
docker network inspect new-api_backend >/dev/null 2>&1 || err "Docker network 'new-api_backend' not found. Is the main stack running?"

# Check available memory
AVAIL_MB=$(free -m | awk '/^Mem:/ {print $7}')
if [ "$AVAIL_MB" -lt 400 ]; then
    warn "Available memory is ${AVAIL_MB}MB (<400MB). Monitoring may cause OOM."
    read -p "Continue? [y/N] " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]] || exit 1
fi
ok "Available memory: ${AVAIL_MB}MB"

# Check ports
for port in 9090 9093 3099 9100 9121 9187; do
    if ss -tlnp | grep -q ":${port} "; then
        err "Port $port is already in use"
    fi
done
ok "All required ports available"

# ===== Copy monitoring configs =====
info "Copying monitoring configuration..."

mkdir -p "$DEPLOY_DIR/monitoring/grafana/provisioning/datasources"
mkdir -p "$DEPLOY_DIR/monitoring/grafana/provisioning/dashboards"
mkdir -p "$DEPLOY_DIR/monitoring/grafana/dashboards"

cp "$MONITORING_SRC/prometheus.yml" "$DEPLOY_DIR/monitoring/"
cp "$MONITORING_SRC/alert-rules.yml" "$DEPLOY_DIR/monitoring/"
cp "$MONITORING_SRC/alertmanager.yml" "$DEPLOY_DIR/monitoring/"
cp "$MONITORING_SRC/docker-compose.monitoring.yml" "$DEPLOY_DIR/"
cp "$MONITORING_SRC/grafana/provisioning/datasources/datasources.yml" \
   "$DEPLOY_DIR/monitoring/grafana/provisioning/datasources/"
cp "$MONITORING_SRC/grafana/provisioning/dashboards/dashboards.yml" \
   "$DEPLOY_DIR/monitoring/grafana/provisioning/dashboards/"

# Copy dashboards if they exist
if ls "$MONITORING_SRC/grafana/dashboards/"*.json >/dev/null 2>&1; then
    cp "$MONITORING_SRC/grafana/dashboards/"*.json "$DEPLOY_DIR/monitoring/grafana/dashboards/"
fi

ok "Configuration files copied"

# ===== Patch Nginx for stub_status =====
info "Checking Nginx stub_status..."

NGINX_CONF="$DEPLOY_DIR/config/nginx.conf"
if [ -f "$NGINX_CONF" ]; then
    if grep -q "stub_status" "$NGINX_CONF"; then
        ok "Nginx stub_status already configured"
    else
        info "Adding stub_status to nginx.conf..."
        # Insert before the last closing brace of the server block
        # We add it as a new location block
        STUB_BLOCK='
    # --- Monitoring: stub_status (T-017) ---
    location /nginx_status {
        stub_status;
        allow 172.16.0.0/12;
        allow 127.0.0.1;
        deny all;
        access_log off;
    }'
        # Find the last } in the file and insert before it
        sed -i "\$i\\${STUB_BLOCK}" "$NGINX_CONF"
        
        # Validate nginx config
        if docker exec new-api-nginx nginx -t 2>&1 | grep -q "successful"; then
            docker exec new-api-nginx nginx -s reload
            ok "Nginx stub_status added and reloaded"
        else
            warn "Nginx config test failed — reverting"
            # Remove the added block
            sed -i '/# --- Monitoring: stub_status (T-017) ---/,/^    }/d' "$NGINX_CONF"
            err "Failed to add stub_status. Please add manually."
        fi
    fi
else
    warn "Nginx config not found at $NGINX_CONF — stub_status not configured"
fi

# ===== Pull images =====
info "Pulling monitoring images..."

cd "$DEPLOY_DIR"
docker compose -f docker-compose.monitoring.yml pull 2>&1 | tail -10
ok "Images pulled"

# ===== Start monitoring stack =====
info "Starting monitoring stack..."

docker compose -f docker-compose.monitoring.yml up -d 2>&1
ok "Monitoring stack started"

# ===== Wait for services =====
info "Waiting for services to initialize (30s)..."
sleep 30

# ===== Verify =====
echo ""
echo "============================================"
echo " T-017 Post-deploy verification"
echo "============================================"

pass=0; fail=0

verify() {
    local name="$1" url="$2" expect="$3"
    RESP=$(curl -sf "$url" 2>/dev/null) || RESP=""
    if echo "$RESP" | grep -q "$expect"; then
        echo -e "  ${GREEN}✓${NC} $name"
        pass=$((pass+1))
    else
        echo -e "  ${RED}✗${NC} $name"
        fail=$((fail+1))
    fi
}

verify "Prometheus healthy" "http://127.0.0.1:9090/-/healthy" "Healthy"
verify "Grafana healthy" "http://127.0.0.1:3099/api/health" "ok"
verify "Alertmanager healthy" "http://127.0.0.1:9093/-/healthy" "OK"
verify "node_exporter" "http://127.0.0.1:9100/metrics" "node_cpu_seconds_total"
verify "postgres_exporter" "http://127.0.0.1:9187/metrics" "pg_up"
verify "redis_exporter" "http://127.0.0.1:9121/metrics" "redis_up"
verify "New-API still healthy" "http://127.0.0.1:3001/api/status" "success"

echo ""
echo "=== Memory usage ==="
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}" | grep -E "new-api|prometheus|grafana|alertmanager|exporter"

echo ""
echo "============================================"
echo -e " Results: ${GREEN}$pass passed${NC}  ${RED}$fail failed${NC}"
echo "============================================"

if [ "$fail" -gt 0 ]; then
    warn "Some checks failed. Review with: docker compose -f docker-compose.monitoring.yml logs"
    exit 1
fi

echo ""
info "Grafana UI: http://localhost:3099  (admin / $GRAFANA_ADMIN_PASSWORD)"
info "Prometheus: http://localhost:9090"
info "Alertmanager: http://localhost:9093"
echo ""
ok "Monitoring stack deployed successfully!"
