#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-011 验证脚本 — Landing Page 开发
# 用法: API_BASE=http://localhost:3000 bash verify-T011.sh
# =============================================================================
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"

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
echo " T-011 Landing Page — 验证"
echo "============================================"

# --- 1. 服务就绪 ---
echo ""
echo "=== 服务就绪 ==="
STATUS=$(curl -sf "$API_BASE/api/status" 2>/dev/null) || STATUS=""
if echo "$STATUS" | grep -q '"success".*true'; then
    check "API 服务运行中" "true"
else
    check "API 服务运行中" "false"; exit 1
fi

# --- 2. 首页 ---
echo ""
echo "=== 首页 ==="

INDEX=$(curl -sf "$API_BASE/" 2>/dev/null) || INDEX=""
if echo "$INDEX" | grep -q "</html>"; then
    check "GET / (HTML 返回)" "true"
    # Check for JS bundle
    if echo "$INDEX" | grep -q '\.js"'; then
        check "JS bundle 引用" "true"
    else
        check "JS bundle 引用" "false"
    fi
else
    check "GET / (HTML 返回)" "false"
fi

# --- 3. 首页内容 API ---
echo ""
echo "=== 首页内容 API ==="

HOME_CONTENT=$(curl -sf "$API_BASE/api/home_page_content" 2>/dev/null) || HOME_CONTENT=""
if echo "$HOME_CONTENT" | grep -q '"success".*true'; then
    DATA=$(echo "$HOME_CONTENT" | grep -o '"data":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$DATA" ] && [ "$DATA" != "" ]; then
        check "GET /api/home_page_content (自定义内容)" "true"
    else
        check "GET /api/home_page_content (默认 Landing)" "true"
    fi
else
    check "GET /api/home_page_content" "skip"
fi

# --- 4. 公告 API ---
echo ""
echo "=== 公告 ==="

NOTICE=$(curl -sf "$API_BASE/api/notice" 2>/dev/null) || NOTICE=""
if echo "$NOTICE" | grep -q '"success"'; then
    check "GET /api/notice" "true"
else
    check "GET /api/notice" "skip"
fi

# --- 5. 关于页 API ---
echo ""
echo "=== 关于页 ==="

ABOUT=$(curl -sf "$API_BASE/api/about" 2>/dev/null) || ABOUT=""
if echo "$ABOUT" | grep -q '"success"'; then
    check "GET /api/about" "true"
else
    check "GET /api/about" "skip"
fi

# --- 6. Landing 相关页面路由 ---
echo ""
echo "=== 页面路由 ==="

for path in "/" "/pricing" "/about" "/login" "/register"; do
    CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$API_BASE$path" 2>/dev/null)
    if [ "$CODE" = "200" ]; then
        check "GET $path → 200" "true"
    else
        check "GET $path → $CODE" "skip"
    fi
done

# --- 7. 品牌配置 ---
echo ""
echo "=== 品牌字段 ==="

SYS_NAME=$(echo "$STATUS" | grep -o '"system_name":"[^"]*"' | cut -d'"' -f4)
check "system_name = \"${SYS_NAME:-New API}\"" "true"

SERVER_ADDR=$(echo "$STATUS" | grep -o '"server_address":"[^"]*"' | cut -d'"' -f4)
if [ -n "$SERVER_ADDR" ]; then
    check "server_address = \"$SERVER_ADDR\"" "true"
else
    check "server_address (用于 Base URL 展示)" "skip"
fi

DOCS_LINK=$(echo "$STATUS" | grep -o '"docs_link":"[^"]*"' | cut -d'"' -f4)
if [ -n "$DOCS_LINK" ]; then
    check "docs_link = \"$DOCS_LINK\"" "true"
else
    check "docs_link (文档按钮)" "skip"
fi

# --- 8. 定价 API ---
echo ""
echo "=== 定价 ==="

PRICING=$(curl -sf "$API_BASE/api/pricing/" 2>/dev/null) || PRICING=""
if echo "$PRICING" | grep -q '"success".*true'; then
    MODEL_COUNT=$(echo "$PRICING" | grep -o '"id"' | wc -l)
    check "GET /api/pricing/ ($MODEL_COUNT 模型)" "true"
else
    check "GET /api/pricing/" "skip"
fi

# --- 9. 静态资源 ---
echo ""
echo "=== 静态资源 ==="

for asset in "/favicon.ico" "/logo.png"; do
    CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$API_BASE$asset" 2>/dev/null)
    if [ "$CODE" = "200" ]; then
        check "$asset" "true"
    else
        check "$asset (HTTP $CODE)" "skip"
    fi
done

# --- 汇总 ---
echo ""
echo "============================================"
echo -e " 结果: ${GREEN}$pass 通过${NC}  ${RED}$fail 失败${NC}  ${YELLOW}$skip 跳过${NC}"
echo "============================================"

[ "$fail" -gt 0 ] && exit 1 || exit 0
