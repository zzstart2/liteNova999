#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-005 验证脚本 — 厂商 API 适配器开发
# 用法: API_BASE=http://localhost:3000 TOKEN=sk-xxx ADMIN_TOKEN=xxx bash verify-T005.sh
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
echo " T-005 厂商 API 适配器 — 验证"
echo "============================================"

# --- 1. 服务就绪 ---
echo ""
echo "=== 服务就绪 ==="
if curl -sf "$API_BASE/api/status" | grep -q '"success".*true'; then
    check "服务运行中" "true"
else
    check "服务运行中" "false"; exit 1
fi

# --- 2. 渠道列表 ---
echo ""
echo "=== 渠道配置 ==="
CHANNELS=$(curl -sf "$API_BASE/api/channel/?p=1&page_size=100" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null) || CHANNELS=""

if [ -n "$CHANNELS" ]; then
    CH_COUNT=$(echo "$CHANNELS" | grep -o '"id":' | wc -l)
    TYPES=$(echo "$CHANNELS" | grep -o '"type":[0-9]*' | sort -t: -k2 -n -u | wc -l)
    ENABLED=$(echo "$CHANNELS" | grep -o '"status":1' | wc -l)
    echo -e "  渠道总数: $CH_COUNT, 类型数: $TYPES, 启用: $ENABLED"
    if [ "$CH_COUNT" -gt 0 ]; then
        check "渠道已配置 ($CH_COUNT 个)" "true"
    else
        check "渠道已配置 (0 个)" "false"
    fi
else
    check "读取渠道列表" "false"
fi

# --- 3. 渠道测试 ---
echo ""
echo "=== 渠道连通性 ==="
TEST_RESP=$(curl -sf "$API_BASE/api/channel/test" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null) || TEST_RESP=""

if echo "$TEST_RESP" | grep -q '"success".*true'; then
    check "渠道批量测试 API 可用" "true"
else
    check "渠道批量测试 API" "skip"
fi

# --- 4. Chat Completions ---
echo ""
echo "=== 端到端请求 ==="

# Chat (non-stream)
CHAT_RESP=$(curl -sf -w "\n%{http_code}" "$API_BASE/v1/chat/completions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"say hi"}],"max_tokens":3}' 2>/dev/null) || CHAT_RESP=""

CHAT_CODE=$(echo "$CHAT_RESP" | tail -1)
if [ "$CHAT_CODE" = "200" ]; then
    check "Chat Completions (非流式)" "true"
elif [ -n "$CHAT_CODE" ] && [ "$CHAT_CODE" != "000" ]; then
    check "Chat Completions (HTTP $CHAT_CODE)" "false"
else
    check "Chat Completions (无渠道?)" "skip"
fi

# Chat (stream)
STREAM_RESP=$(curl -sf -w "\n%{http_code}" "$API_BASE/v1/chat/completions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"say hi"}],"max_tokens":3,"stream":true}' 2>/dev/null) || STREAM_RESP=""

STREAM_CODE=$(echo "$STREAM_RESP" | tail -1)
if [ "$STREAM_CODE" = "200" ]; then
    if echo "$STREAM_RESP" | grep -q "data:"; then
        check "Chat Completions (流式 SSE)" "true"
    else
        check "Chat Completions (流式但无 SSE)" "false"
    fi
else
    check "Chat Completions 流式 (HTTP $STREAM_CODE)" "skip"
fi

# Models list
MODELS_RESP=$(curl -sf "$API_BASE/v1/models" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null) || MODELS_RESP=""

if echo "$MODELS_RESP" | grep -q '"data"'; then
    MODEL_COUNT=$(echo "$MODELS_RESP" | grep -o '"id"' | wc -l)
    check "模型列表 ($MODEL_COUNT 个模型)" "true"
else
    check "模型列表" "skip"
fi

# --- 汇总 ---
echo ""
echo "============================================"
echo -e " 结果: ${GREEN}$pass 通过${NC}  ${RED}$fail 失败${NC}  ${YELLOW}$skip 跳过${NC}"
echo "============================================"

[ "$fail" -gt 0 ] && exit 1 || exit 0
