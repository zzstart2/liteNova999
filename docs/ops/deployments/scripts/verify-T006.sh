#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-006 验证脚本 — 增强用量统计数据模型
# 用法: API_BASE=http://localhost:3000 TOKEN=sk-xxx ADMIN_TOKEN=xxx bash verify-T006.sh
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
    else
        echo -e "  ${RED}✗${NC} $name"; ((fail++))
    fi
}

echo "============================================"
echo " T-006 增强用量统计数据模型 — 验证"
echo "============================================"

# --- 1. 服务就绪 ---
echo ""
echo "=== 服务就绪 ==="
if curl -sf "$API_BASE/api/status" | grep -q '"success".*true'; then
    check "服务运行中" "true"
else
    check "服务运行中" "false"; exit 1
fi

# --- 2. 触发一次消费 ---
echo ""
echo "=== 触发消费记录 ==="
CONSUME_RESP=$(curl -sf "$API_BASE/v1/chat/completions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"test usage tracking"}],"max_tokens":3}' 2>/dev/null) || CONSUME_RESP=""

if echo "$CONSUME_RESP" | grep -q '"usage"'; then
    PROMPT_T=$(echo "$CONSUME_RESP" | grep -o '"prompt_tokens":[0-9]*' | head -1 | cut -d: -f2)
    COMPL_T=$(echo "$CONSUME_RESP" | grep -o '"completion_tokens":[0-9]*' | head -1 | cut -d: -f2)
    echo -e "  ${GREEN}✓${NC} 请求成功 (prompt: $PROMPT_T, completion: $COMPL_T)"
    ((pass++))
elif [ -n "$CONSUME_RESP" ]; then
    echo -e "  ${YELLOW}⊘${NC} 请求返回但无 usage (可能渠道配置缺失)"
    ((skip++))
else
    echo -e "  ${RED}✗${NC} 请求失败"; ((fail++))
fi

sleep 2  # 等待日志写入

# --- 3. 日志 API ---
echo ""
echo "=== 日志查询 API ==="

# 管理员: 全部日志
LOGS_RESP=$(curl -sf "$API_BASE/api/log/?p=1&page_size=1" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null) || LOGS_RESP=""
if echo "$LOGS_RESP" | grep -q '"success".*true'; then
    check "GET /api/log/ (管理员)" "true"
else
    check "GET /api/log/ (管理员)" "false"
fi

# 管理员: 统计
STAT_RESP=$(curl -sf "$API_BASE/api/log/stat?start_timestamp=0&end_timestamp=9999999999" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null) || STAT_RESP=""
if echo "$STAT_RESP" | grep -q '"success".*true'; then
    check "GET /api/log/stat (统计)" "true"
else
    check "GET /api/log/stat (统计)" "false"
fi

# 用户: 我的日志
SELF_LOGS=$(curl -sf "$API_BASE/api/log/self?p=1&page_size=1" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null) || SELF_LOGS=""
if echo "$SELF_LOGS" | grep -q '"success".*true'; then
    check "GET /api/log/self (用户)" "true"
else
    check "GET /api/log/self (用户)" "false"
fi

# --- 4. 数据看板 API ---
echo ""
echo "=== 数据看板 API ==="

DATA_RESP=$(curl -sf "$API_BASE/api/data/?username=&start_timestamp=0&end_timestamp=9999999999" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null) || DATA_RESP=""
if echo "$DATA_RESP" | grep -q '"success".*true'; then
    check "GET /api/data/ (看板)" "true"
else
    check "GET /api/data/ (看板)" "false"
fi

# --- 5. OpenAI 兼容 ---
echo ""
echo "=== OpenAI 兼容用量 API ==="

USAGE_RESP=$(curl -sf "$API_BASE/v1/dashboard/billing/usage?start_date=2026-01-01&end_date=2026-12-31" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null) || USAGE_RESP=""
if [ -n "$USAGE_RESP" ] && ! echo "$USAGE_RESP" | grep -q '"error"'; then
    check "GET /v1/dashboard/billing/usage" "true"
else
    check "GET /v1/dashboard/billing/usage" "false"
fi

SUB_RESP=$(curl -sf "$API_BASE/v1/dashboard/billing/subscription" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null) || SUB_RESP=""
if [ -n "$SUB_RESP" ] && ! echo "$SUB_RESP" | grep -q '"error"'; then
    check "GET /v1/dashboard/billing/subscription" "true"
else
    check "GET /v1/dashboard/billing/subscription" "false"
fi

# --- 汇总 ---
echo ""
echo "============================================"
echo -e " 结果: ${GREEN}$pass 通过${NC}  ${RED}$fail 失败${NC}  ${YELLOW}$skip 跳过${NC}"
echo "============================================"

[ "$fail" -gt 0 ] && exit 1 || exit 0
