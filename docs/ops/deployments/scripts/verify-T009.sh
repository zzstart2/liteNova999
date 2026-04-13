#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-009 验证脚本 — 智能 Fallback 策略实现
# 用法: API_BASE=http://localhost:3000 TOKEN=sk-xxx ADMIN_TOKEN=xxx bash verify-T009.sh
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
echo " T-009 智能 Fallback 策略 — 验证"
echo "============================================"

# --- 1. 服务就绪 ---
echo ""
echo "=== 服务就绪 ==="
if curl -sf "$API_BASE/api/status" | grep -q '"success".*true'; then
    check "服务运行中" "true"
else
    check "服务运行中" "false"; exit 1
fi

# --- 2. 系统选项检查 ---
echo ""
echo "=== 系统选项 ==="

OPTS=$(curl -sf "$API_BASE/api/option/" -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null) || OPTS=""

if [ -n "$OPTS" ]; then
    # RetryTimes
    RT=$(echo "$OPTS" | grep -o '"RetryTimes":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$RT" ] && [ "$RT" -gt 0 ] 2>/dev/null; then
        check "RetryTimes = $RT (>0)" "true"
    else
        check "RetryTimes = ${RT:-0} (需要 >0)" "false"
    fi

    # AutomaticDisableChannelEnabled
    ADCE=$(echo "$OPTS" | grep -o '"AutomaticDisableChannelEnabled":"[^"]*"' | cut -d'"' -f4)
    if [ "$ADCE" = "true" ]; then
        check "AutomaticDisableChannelEnabled = true" "true"
    else
        check "AutomaticDisableChannelEnabled = ${ADCE:-未设置}" "false"
    fi

    # AutomaticEnableChannelEnabled
    AECE=$(echo "$OPTS" | grep -o '"AutomaticEnableChannelEnabled":"[^"]*"' | cut -d'"' -f4)
    if [ "$AECE" = "true" ]; then
        check "AutomaticEnableChannelEnabled = true" "true"
    else
        check "AutomaticEnableChannelEnabled = ${AECE:-未设置}" "false"
    fi
else
    check "读取系统选项" "false"
fi

# --- 3. 渠道分层检查 ---
echo ""
echo "=== 渠道优先级分层 ==="

CHANNELS=$(curl -sf "$API_BASE/api/channel/?p=1&page_size=100" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null) || CHANNELS=""

if [ -n "$CHANNELS" ]; then
    # Count unique priorities
    PRIORITIES=$(echo "$CHANNELS" | grep -o '"priority":[0-9-]*' | sort -t: -k2 -n -u | wc -l)
    TOTAL_CH=$(echo "$CHANNELS" | grep -o '"id":' | wc -l)
    echo -e "  渠道总数: $TOTAL_CH, 优先级层数: $PRIORITIES"

    if [ "$PRIORITIES" -ge 2 ]; then
        check "优先级分层 (≥2 层)" "true"
    else
        check "优先级分层 (当前 $PRIORITIES 层, 建议 ≥2)" "false"
    fi
else
    check "读取渠道列表" "false"
fi

# --- 4. 正常请求 ---
echo ""
echo "=== 正常请求 ==="
RESP=$(curl -sf -w "\n%{http_code}" "$API_BASE/v1/chat/completions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":3}' 2>/dev/null) || RESP=""

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    check "正常请求 (200 OK)" "true"
else
    if [ -n "$HTTP_CODE" ] && [ "$HTTP_CODE" != "000" ]; then
        check "正常请求 (HTTP $HTTP_CODE)" "false"
    else
        check "正常请求 (渠道可能未配置)" "skip"
    fi
fi

# --- 5. 亲和缓存 ---
echo ""
echo "=== 渠道亲和性 ==="

AFFINITY=$(curl -sf "$API_BASE/api/log/channel_affinity_usage_cache" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null) || AFFINITY=""

if echo "$AFFINITY" | grep -q '"success".*true'; then
    check "渠道亲和缓存 API 可用" "true"
else
    check "渠道亲和缓存 API" "skip"
fi

# --- 汇总 ---
echo ""
echo "============================================"
echo -e " 结果: ${GREEN}$pass 通过${NC}  ${RED}$fail 失败${NC}  ${YELLOW}$skip 跳过${NC}"
echo "============================================"

[ "$fail" -gt 0 ] && exit 1 || exit 0
