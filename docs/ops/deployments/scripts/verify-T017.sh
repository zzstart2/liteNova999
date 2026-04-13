#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-017 验证脚本 — 监控告警系统
# 用法: bash verify-T017.sh
# =============================================================================
set -eo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass=0; fail=0; skip=0

check() {
    local name="$1" ok="$2"
    if [ "$ok" = "true" ]; then
        echo -e "  ${GREEN}✓${NC} $name"; pass=$((pass+1))
    elif [ "$ok" = "skip" ]; then
        echo -e "  ${YELLOW}⊘${NC} $name (跳过)"; skip=$((skip+1))
    else
        echo -e "  ${RED}✗${NC} $name"; fail=$((fail+1))
    fi
}

echo "============================================"
echo " T-017 监控告警系统 — 验证"
echo "============================================"

# --- 1. Container Status ---
echo ""
echo "=== 容器状态 ==="

for svc in new-api-prometheus new-api-grafana new-api-alertmanager new-api-node-exporter new-api-pg-exporter new-api-redis-exporter; do
    STATUS=$(docker inspect -f '{{.State.Status}}' "$svc" 2>/dev/null || echo "missing")
    if [ "$STATUS" = "running" ]; then
        check "$svc → running" "true"
    elif [ "$STATUS" = "missing" ]; then
        check "$svc → not found" "false"
    else
        check "$svc → $STATUS" "false"
    fi
done

# --- 2. Service Health ---
echo ""
echo "=== 服务健康 ==="

PROM=$(curl -sf "http://127.0.0.1:9090/-/healthy" 2>/dev/null || echo "")
check "Prometheus /-/healthy" "$([ -n "$PROM" ] && echo true || echo false)"

GRAF=$(curl -sf "http://127.0.0.1:3099/api/health" 2>/dev/null || echo "")
if echo "$GRAF" | grep -q "ok"; then
    check "Grafana /api/health" "true"
else
    check "Grafana /api/health" "false"
fi

AM=$(curl -sf "http://127.0.0.1:9093/-/healthy" 2>/dev/null || echo "")
check "Alertmanager /-/healthy" "$([ -n "$AM" ] && echo true || echo false)"

# --- 3. Prometheus Targets ---
echo ""
echo "=== Prometheus Targets ==="

TARGETS=$(curl -sf "http://127.0.0.1:9090/api/v1/targets" 2>/dev/null || echo "")
if [ -n "$TARGETS" ]; then
    for job in node postgres redis new-api nginx prometheus; do
        STATE=$(echo "$TARGETS" | python3 -c "
import json,sys
data=json.load(sys.stdin)
for t in data.get('data',{}).get('activeTargets',[]):
    if t.get('labels',{}).get('job','') == '$job':
        print(t.get('health',''))
        break
" 2>/dev/null || echo "")
        if [ "$STATE" = "up" ]; then
            check "Target $job → UP" "true"
        elif [ -n "$STATE" ]; then
            check "Target $job → $STATE" "false"
        else
            check "Target $job" "skip"
        fi
    done
else
    check "Prometheus targets API 不可达" "false"
fi

# --- 4. Exporter Metrics ---
echo ""
echo "=== Exporter 指标 ==="

NODE_METRICS=$(curl -sf "http://127.0.0.1:9100/metrics" 2>/dev/null || echo "")
if echo "$NODE_METRICS" | grep -q "node_cpu_seconds_total"; then
    check "node_exporter → node_cpu_seconds_total" "true"
else
    check "node_exporter metrics" "false"
fi

PG_METRICS=$(curl -sf "http://127.0.0.1:9187/metrics" 2>/dev/null || echo "")
if echo "$PG_METRICS" | grep -q "pg_up 1"; then
    check "postgres_exporter → pg_up=1" "true"
elif echo "$PG_METRICS" | grep -q "pg_up"; then
    check "postgres_exporter → pg_up=0 (DB 不可达)" "false"
else
    check "postgres_exporter metrics" "false"
fi

REDIS_METRICS=$(curl -sf "http://127.0.0.1:9121/metrics" 2>/dev/null || echo "")
if echo "$REDIS_METRICS" | grep -q "redis_up 1"; then
    check "redis_exporter → redis_up=1" "true"
elif echo "$REDIS_METRICS" | grep -q "redis_up"; then
    check "redis_exporter → redis_up=0 (Redis 不可达)" "false"
else
    check "redis_exporter metrics" "false"
fi

# --- 5. Alert Rules ---
echo ""
echo "=== 告警规则 ==="

RULES=$(curl -sf "http://127.0.0.1:9090/api/v1/rules" 2>/dev/null || echo "")
if [ -n "$RULES" ]; then
    RULE_COUNT=$(echo "$RULES" | python3 -c "
import json,sys
data=json.load(sys.stdin)
count=0
for g in data.get('data',{}).get('groups',[]):
    count+=len(g.get('rules',[]))
print(count)
" 2>/dev/null || echo "0")
    if [ "$RULE_COUNT" -gt 0 ]; then
        check "告警规则已加载 ($RULE_COUNT 条)" "true"
    else
        check "告警规则未加载" "false"
    fi
else
    check "Prometheus rules API" "false"
fi

# --- 6. Grafana Datasource ---
echo ""
echo "=== Grafana 数据源 ==="

DS=$(curl -sf -u admin:${GRAFANA_ADMIN_PASSWORD:-changeme} "http://127.0.0.1:3099/api/datasources" 2>/dev/null || echo "")
if echo "$DS" | grep -q "Prometheus"; then
    check "Grafana → Prometheus 数据源" "true"
else
    check "Grafana → Prometheus 数据源" "skip"
fi

# --- 7. Resource Usage ---
echo ""
echo "=== 资源占用 ==="

MONITORING_MEM=$(docker stats --no-stream --format "{{.Name}}\t{{.MemUsage}}" 2>/dev/null | grep -E "prometheus|grafana|alertmanager|exporter" | awk -F'/' '{print $1}' | awk '{sum+=$NF} END{printf "%.0f", sum}' 2>/dev/null || echo "0")
echo "  监控栈总内存: ~${MONITORING_MEM}MiB"

docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | grep -E "prometheus|grafana|alertmanager|exporter" | sed 's/^/  /'

# --- 8. Original services unaffected ---
echo ""
echo "=== 原服务状态 ==="

API_STATUS=$(curl -sf "http://127.0.0.1:3001/api/status" 2>/dev/null || echo "")
if echo "$API_STATUS" | grep -q '"success".*true'; then
    check "New-API 仍然健康" "true"
else
    check "New-API 健康检查" "false"
fi

# --- Summary ---
echo ""
echo "============================================"
echo -e " 结果: ${GREEN}$pass 通过${NC}  ${RED}$fail 失败${NC}  ${YELLOW}$skip 跳过${NC}"
echo "============================================"

[ "$fail" -gt 0 ] && exit 1 || exit 0
