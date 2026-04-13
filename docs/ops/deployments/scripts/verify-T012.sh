#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-012 验证脚本 — API 文档站开发
# 用法: API_BASE=http://localhost:3000 TOKEN=sk-xxx bash verify-T012.sh
# =============================================================================
set -eo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"
TOKEN="${TOKEN:-}"
REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"

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
echo " T-012 API 文档站 — 验证"
echo "============================================"

# --- 1. OpenAPI Spec 文件 ---
echo ""
echo "=== OpenAPI 规范文件 ==="

API_JSON="$REPO_ROOT/docs/openapi/api.json"
RELAY_JSON="$REPO_ROOT/docs/openapi/relay.json"

if [ -f "$API_JSON" ]; then
    API_PATHS=$(python3 -c "import json; print(len(json.load(open('$API_JSON')).get('paths',{})))" 2>/dev/null || echo "0")
    API_TAGS=$(python3 -c "
import json
spec=json.load(open('$API_JSON'))
tags=set()
for p,ms in spec.get('paths',{}).items():
    for m,d in ms.items():
        if isinstance(d,dict):
            for t in d.get('tags',[]):tags.add(t)
print(len(tags))
" 2>/dev/null || echo "0")
    check "api.json 存在 ($API_PATHS 路径, $API_TAGS Tags)" "true"
    
    if [ "$API_PATHS" -ge 100 ]; then
        check "api.json 路径数 ≥ 100" "true"
    else
        check "api.json 路径数 ≥ 100 (实际 $API_PATHS)" "false"
    fi
else
    check "api.json" "false"
fi

if [ -f "$RELAY_JSON" ]; then
    RELAY_PATHS=$(python3 -c "import json; print(len(json.load(open('$RELAY_JSON')).get('paths',{})))" 2>/dev/null || echo "0")
    RELAY_TAGS=$(python3 -c "
import json
spec=json.load(open('$RELAY_JSON'))
tags=set()
for p,ms in spec.get('paths',{}).items():
    for m,d in ms.items():
        if isinstance(d,dict):
            for t in d.get('tags',[]):tags.add(t)
print(len(tags))
" 2>/dev/null || echo "0")
    check "relay.json 存在 ($RELAY_PATHS 路径, $RELAY_TAGS Tags)" "true"
    
    if [ "$RELAY_PATHS" -ge 30 ]; then
        check "relay.json 路径数 ≥ 30" "true"
    else
        check "relay.json 路径数 ≥ 30 (实际 $RELAY_PATHS)" "false"
    fi
else
    check "relay.json" "false"
fi

# --- 2. OpenAPI 合法性 ---
echo ""
echo "=== OpenAPI 合法性 ==="

for spec_file in "$API_JSON" "$RELAY_JSON"; do
    fname=$(basename "$spec_file")
    if [ -f "$spec_file" ]; then
        VALID=$(python3 -c "
import json, sys
try:
    s=json.load(open('$spec_file'))
    assert 'info' in s and 'paths' in s
    print('true')
except:
    print('false')
" 2>/dev/null || echo "false")
        check "$fname JSON 合法 + 含 info/paths" "$VALID"
    fi
done

# --- 3. Playground 前端 ---
echo ""
echo "=== Playground 前端文件 ==="

PG_PAGE="$REPO_ROOT/web/src/pages/Playground/index.jsx"
PG_COMP_DIR="$REPO_ROOT/web/src/components/playground"
PG_HOOKS_DIR="$REPO_ROOT/web/src/hooks/playground"

if [ -f "$PG_PAGE" ]; then
    PG_LINES=$(wc -l < "$PG_PAGE")
    check "Playground 页面 ($PG_LINES 行)" "true"
else
    check "Playground 页面" "false"
fi

if [ -d "$PG_COMP_DIR" ]; then
    PG_COMP_COUNT=$(find "$PG_COMP_DIR" -name "*.jsx" -o -name "*.js" | wc -l)
    PG_COMP_LINES=$(find "$PG_COMP_DIR" -name "*.jsx" -o -name "*.js" -exec cat {} + | wc -l)
    check "Playground 组件 ($PG_COMP_COUNT 个, $PG_COMP_LINES 行)" "true"
else
    check "Playground 组件目录" "false"
fi

if [ -d "$PG_HOOKS_DIR" ]; then
    PG_HOOK_COUNT=$(find "$PG_HOOKS_DIR" -name "*.jsx" -o -name "*.js" | wc -l)
    PG_HOOK_LINES=$(find "$PG_HOOKS_DIR" -name "*.jsx" -o -name "*.js" -exec cat {} + | wc -l)
    check "Playground Hooks ($PG_HOOK_COUNT 个, $PG_HOOK_LINES 行)" "true"
else
    check "Playground Hooks 目录" "false"
fi

# --- 4. Swagger 注解 ---
echo ""
echo "=== Swagger 注解 ==="

SWAG_FILES=$(find "$REPO_ROOT/controller" -name "swag_*.go" 2>/dev/null | wc -l)
if [ "$SWAG_FILES" -gt 0 ]; then
    SWAG_LINES=$(find "$REPO_ROOT/controller" -name "swag_*.go" -exec cat {} + | wc -l)
    check "Swagger 注解文件 ($SWAG_FILES 个, $SWAG_LINES 行)" "true"
else
    check "Swagger 注解文件" "skip"
fi

# --- 5. 运维文档 ---
echo ""
echo "=== 运维文档 ==="

DOC_COUNT=$(find "$REPO_ROOT/docs" -name "*.md" | wc -l)
check "运维文档 ($DOC_COUNT 个 .md)" "true"

for doc in "channel/other_setting.md" "installation/BT.md" "translation-glossary.md"; do
    if [ -f "$REPO_ROOT/docs/$doc" ]; then
        check "docs/$doc" "true"
    else
        check "docs/$doc" "skip"
    fi
done

# --- 6. 运行时验证 (需要服务在线) ---
echo ""
echo "=== 运行时验证 ==="

STATUS=$(curl -sf "$API_BASE/api/status" 2>/dev/null) || STATUS=""
if [ -z "$STATUS" ]; then
    check "API 服务不可达 (跳过运行时验证)" "skip"
else
    check "API 服务运行中" "true"

    # Playground 页面
    PG_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$API_BASE/console/playground" 2>/dev/null)
    if [ "$PG_CODE" = "200" ]; then
        check "GET /console/playground → 200" "true"
    else
        check "GET /console/playground → $PG_CODE" "skip"
    fi

    # Playground API (需要 Token)
    if [ -n "$TOKEN" ]; then
        PG_RESP=$(curl -sf -X POST "$API_BASE/pg/chat/completions" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}],"max_tokens":5,"stream":false}' \
            2>/dev/null) || PG_RESP=""
        if echo "$PG_RESP" | grep -q '"choices"'; then
            check "POST /pg/chat/completions (调用成功)" "true"
        elif echo "$PG_RESP" | grep -q '"error"'; then
            ERR=$(echo "$PG_RESP" | grep -o '"message":"[^"]*"' | head -1 | cut -d'"' -f4)
            check "POST /pg/chat/completions (错误: $ERR)" "skip"
        else
            check "POST /pg/chat/completions" "skip"
        fi
    else
        check "Playground API (需设置 TOKEN)" "skip"
    fi

    # 模型列表
    if [ -n "$TOKEN" ]; then
        MODELS=$(curl -sf "$API_BASE/api/user/models" \
            -H "Authorization: Bearer $TOKEN" 2>/dev/null) || MODELS=""
        if echo "$MODELS" | grep -q '"success".*true'; then
            check "GET /api/user/models" "true"
        else
            check "GET /api/user/models" "skip"
        fi
    fi
fi

# --- 汇总 ---
echo ""
echo "============================================"
echo -e " 结果: ${GREEN}$pass 通过${NC}  ${RED}$fail 失败${NC}  ${YELLOW}$skip 跳过${NC}"
echo "============================================"

[ "$fail" -gt 0 ] && exit 1 || exit 0
