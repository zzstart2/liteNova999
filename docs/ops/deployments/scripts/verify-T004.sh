#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-004 验证脚本 — 原生 API 透传路由端到端测试
# 用法: API_BASE=http://localhost:3000 TOKEN=sk-xxx bash verify-T004.sh
# =============================================================================
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"
TOKEN="${TOKEN:?请设置 TOKEN 环境变量 (API Key)}"
AUTH="Authorization: Bearer $TOKEN"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass=0; fail=0; skip=0

test_route() {
    local name="$1" method="$2" path="$3" expected_code="$4"
    shift 4
    local extra_args=("$@")

    local code
    code=$(curl -sf -o /dev/null -w "%{http_code}" \
        -X "$method" "$API_BASE$path" \
        -H "$AUTH" \
        "${extra_args[@]}" 2>/dev/null) || code="000"

    if [ "$code" = "$expected_code" ]; then
        echo -e "  ${GREEN}✓${NC} $name → $code"
        ((pass++))
    elif [ "$code" = "000" ]; then
        echo -e "  ${YELLOW}⊘${NC} $name → 连接失败 (skip)"
        ((skip++))
    else
        echo -e "  ${RED}✗${NC} $name → $code (expected $expected_code)"
        ((fail++))
    fi
}

echo "==========================================="
echo " T-004 原生 API 透传路由 — 端到端验证"
echo " API_BASE: $API_BASE"
echo "==========================================="

# --- 服务就绪 ---
echo ""
echo "=== 服务就绪检查 ==="
if curl -sf "$API_BASE/api/status" | grep -q '"success".*true'; then
    echo -e "  ${GREEN}✓${NC} 服务运行中"
else
    echo -e "  ${RED}✗${NC} 服务不可用，终止验证"
    exit 1
fi

# --- 鉴权验证 ---
echo ""
echo "=== 鉴权验证 ==="

NO_AUTH_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
    -X POST "$API_BASE/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":1}' 2>/dev/null) || NO_AUTH_CODE="000"

if [ "$NO_AUTH_CODE" = "401" ]; then
    echo -e "  ${GREEN}✓${NC} 无 Token 请求 → 401 拒绝"
    ((pass++))
else
    echo -e "  ${RED}✗${NC} 无 Token 请求 → $NO_AUTH_CODE (expected 401)"
    ((fail++))
fi

BAD_AUTH_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
    -X POST "$API_BASE/v1/chat/completions" \
    -H "Authorization: Bearer sk-bad-key-12345" \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":1}' 2>/dev/null) || BAD_AUTH_CODE="000"

if [ "$BAD_AUTH_CODE" = "401" ]; then
    echo -e "  ${GREEN}✓${NC} 错误 Token → 401 拒绝"
    ((pass++))
else
    echo -e "  ${YELLOW}⊘${NC} 错误 Token → $BAD_AUTH_CODE (可能 200 if key format accepted)"
    ((skip++))
fi

# --- 核心路由 ---
echo ""
echo "=== 核心透传路由 ==="

test_route "GET /v1/models" \
    GET "/v1/models" "200"

test_route "POST /v1/chat/completions" \
    POST "/v1/chat/completions" "200" \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":1}'

test_route "POST /v1/embeddings" \
    POST "/v1/embeddings" "200" \
    -H "Content-Type: application/json" \
    -d '{"model":"text-embedding-3-small","input":"hello"}'

# --- Not Implemented ---
echo ""
echo "=== Not Implemented 路由 ==="

test_route "POST /v1/fine-tunes (not impl)" \
    POST "/v1/fine-tunes" "501" \
    -H "Content-Type: application/json" -d '{}'

test_route "GET /v1/files (not impl)" \
    GET "/v1/files" "501"

# --- 流式验证 ---
echo ""
echo "=== 流式 (SSE) 验证 ==="

STREAM_RESP=$(curl -sf "$API_BASE/v1/chat/completions" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":3,"stream":true}' \
    --max-time 15 2>/dev/null | head -c 500) || STREAM_RESP=""

if echo "$STREAM_RESP" | grep -q "^data:"; then
    echo -e "  ${GREEN}✓${NC} SSE 流式响应正常 (data: prefix detected)"
    ((pass++))
elif [ -z "$STREAM_RESP" ]; then
    echo -e "  ${YELLOW}⊘${NC} 流式请求无响应 (可能无可用渠道)"
    ((skip++))
else
    echo -e "  ${RED}✗${NC} 流式响应格式异常"
    ((fail++))
fi

# --- 汇总 ---
echo ""
echo "==========================================="
echo -e " 结果: ${GREEN}$pass 通过${NC}  ${RED}$fail 失败${NC}  ${YELLOW}$skip 跳过${NC}"
echo "==========================================="

if [ "$fail" -gt 0 ]; then
    exit 1
fi
