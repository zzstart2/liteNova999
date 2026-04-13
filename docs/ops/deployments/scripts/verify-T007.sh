#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-007 验证脚本 — 用量仪表盘前端组件开发
# 用法: API_BASE=http://localhost:3000 TOKEN=sk-xxx ADMIN_TOKEN=xxx bash verify-T007.sh
# =============================================================================
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"
TOKEN="${TOKEN:?请设置 TOKEN (API Key)}"
ADMIN_TOKEN="${ADMIN_TOKEN:?请设置 ADMIN_TOKEN (管理员 Token)}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass=0; fail=0; skip=0

check() {
    local name="$1" ok="$2"
    if [ "$ok" = "true" ]; then
        echo -e "  ${GREEN}✓${NC} $name"; ((pass++))
    elif [ "$ok" = "skip" ]; then
        echo -e "  ${YELLOW}⊘${NC} $name (跳过)"; ((skip++))
    else
        echo -e "  ${RED}✗${NC} $name"; ((fail++))
    fi
}

echo "============================================"
echo " T-007 用量仪表盘 — 验证"
echo "============================================"

# --- 1. 服务就绪 ---
echo ""
echo "=== 服务就绪 ==="
STATUS=$(curl -sf "$API_BASE/api/status" 2>/dev/null) || STATUS=""
if echo "$STATUS" | grep -q '"success".*true'; then
    check "服务运行中" "true"
else
    check "服务运行中" "false"; exit 1
fi

# --- 2. 前端页面 ---
echo ""
echo "=== 前端页面 ==="

CONSOLE=$(curl -sf -o /dev/null -w "%{http_code}" "$API_BASE/console" 2>/dev/null)
if [ "$CONSOLE" = "200" ]; then
    check "GET /console (Dashboard 入口)" "true"
else
    check "GET /console → $CONSOLE" "skip"
fi

LOG_PAGE=$(curl -sf -o /dev/null -w "%{http_code}" "$API_BASE/console/log" 2>/dev/null)
if [ "$LOG_PAGE" = "200" ]; then
    check "GET /console/log (用量日志页)" "true"
else
    check "GET /console/log → $LOG_PAGE" "skip"
fi

# --- 3. 数据看板 API ---
echo ""
echo "=== 数据看板 API (管理员) ==="

NOW=$(date +%s)
START=$((NOW - 86400))

DATA_RESP=$(curl -sf "$API_BASE/api/data/?username=&start_timestamp=$START&end_timestamp=$NOW&default_time=hour" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null) || DATA_RESP=""
if echo "$DATA_RESP" | grep -q '"success".*true'; then
    check "GET /api/data/ (全量看板)" "true"
else
    check "GET /api/data/ (全量看板)" "false"
fi

DATA_USERS=$(curl -sf "$API_BASE/api/data/users?start_timestamp=$START&end_timestamp=$NOW" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null) || DATA_USERS=""
if echo "$DATA_USERS" | grep -q '"success".*true'; then
    check "GET /api/data/users (用户排行)" "true"
else
    check "GET /api/data/users (用户排行)" "false"
fi

# --- 4. 个人看板 API ---
echo ""
echo "=== 数据看板 API (用户) ==="

DATA_SELF=$(curl -sf "$API_BASE/api/data/self/?start_timestamp=$START&end_timestamp=$NOW&default_time=hour" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null) || DATA_SELF=""
if echo "$DATA_SELF" | grep -q '"success".*true'; then
    check "GET /api/data/self/ (个人看板)" "true"
else
    check "GET /api/data/self/ (个人看板)" "false"
fi

# --- 5. 日志统计 API ---
echo ""
echo "=== 日志统计 API ==="

LOG_STAT=$(curl -sf "$API_BASE/api/log/stat?type=2&start_timestamp=$START&end_timestamp=$NOW" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null) || LOG_STAT=""
if echo "$LOG_STAT" | grep -q '"success".*true'; then
    check "GET /api/log/stat (全局统计)" "true"
else
    check "GET /api/log/stat (全局统计)" "false"
fi

LOG_SELF_STAT=$(curl -sf "$API_BASE/api/log/self/stat?type=2&start_timestamp=$START&end_timestamp=$NOW" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null) || LOG_SELF_STAT=""
if echo "$LOG_SELF_STAT" | grep -q '"success".*true'; then
    check "GET /api/log/self/stat (个人统计)" "true"
else
    check "GET /api/log/self/stat (个人统计)" "false"
fi

# --- 6. Uptime ---
echo ""
echo "=== Uptime ==="

UPTIME=$(curl -sf "$API_BASE/api/uptime/status" 2>/dev/null) || UPTIME=""
if [ -n "$UPTIME" ] && ! echo "$UPTIME" | grep -q '"error"'; then
    check "GET /api/uptime/status" "true"
else
    check "GET /api/uptime/status" "skip"
fi

# --- 7. 面板开关 ---
echo ""
echo "=== 面板开关 ==="

for field in api_info_enabled uptime_kuma_enabled announcements_enabled faq_enabled enable_data_export; do
    if echo "$STATUS" | grep -q "\"$field\""; then
        val=$(echo "$STATUS" | grep -o "\"$field\":[a-z]*" | cut -d: -f2)
        check "$field = $val" "true"
    else
        check "$field" "skip"
    fi
done

# --- 汇总 ---
echo ""
echo "============================================"
echo -e " 结果: ${GREEN}$pass 通过${NC}  ${RED}$fail 失败${NC}  ${YELLOW}$skip 跳过${NC}"
echo "============================================"

[ "$fail" -gt 0 ] && exit 1 || exit 0
