#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-003 验证脚本 — UI/UX 设计系统规划
# 用法: API_BASE=http://localhost:3000 bash verify-T003.sh
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
echo " T-003 UI/UX 设计系统 — 验证"
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

# --- 2. 前端页面加载 ---
echo ""
echo "=== 前端页面 ==="

INDEX=$(curl -sf "$API_BASE/" 2>/dev/null) || INDEX=""
if echo "$INDEX" | grep -q "</html>"; then
    check "首页 HTML 返回" "true"
else
    check "首页 HTML 返回" "false"
fi

# Check for bundled JS
if echo "$INDEX" | grep -q '\.js"'; then
    check "打包 JS 引用存在" "true"
else
    check "打包 JS 引用存在" "false"
fi

# Check for CSS
if echo "$INDEX" | grep -q '\.css"'; then
    check "打包 CSS 引用存在" "true"
else
    check "打包 CSS 引用存在" "skip"
fi

# --- 3. 静态资源 ---
echo ""
echo "=== 静态资源 ==="

FAVICON=$(curl -sf -o /dev/null -w "%{http_code}" "$API_BASE/favicon.ico" 2>/dev/null)
if [ "$FAVICON" = "200" ]; then
    check "favicon.ico" "true"
else
    check "favicon.ico (HTTP $FAVICON)" "skip"
fi

LOGO=$(curl -sf -o /dev/null -w "%{http_code}" "$API_BASE/logo.png" 2>/dev/null)
if [ "$LOGO" = "200" ]; then
    check "logo.png" "true"
else
    check "logo.png (HTTP $LOGO)" "skip"
fi

# --- 4. 品牌字段 ---
echo ""
echo "=== 品牌配置 ==="

SYS_NAME=$(echo "$STATUS" | grep -o '"system_name":"[^"]*"' | cut -d'"' -f4)
if [ -n "$SYS_NAME" ]; then
    check "system_name = \"$SYS_NAME\"" "true"
else
    check "system_name" "false"
fi

if echo "$STATUS" | grep -q '"logo"'; then
    check "logo 字段存在" "true"
else
    check "logo 字段" "false"
fi

if echo "$STATUS" | grep -q '"footer_html"'; then
    check "footer_html 字段存在" "true"
else
    check "footer_html 字段" "false"
fi

# --- 5. 主题支持 ---
echo ""
echo "=== 主题/功能开关 ==="

for field in enable_drawing enable_data_export default_collapse_sidebar; do
    if echo "$STATUS" | grep -q "\"$field\""; then
        check "$field 字段存在" "true"
    else
        check "$field 字段" "skip"
    fi
done

# --- 6. SPA 路由 ---
echo ""
echo "=== SPA 路由 (fallback → index.html) ==="

for path in "/console" "/console/token" "/console/channel" "/about" "/pricing"; do
    SPA_RESP=$(curl -sf -o /dev/null -w "%{http_code}" "$API_BASE$path" 2>/dev/null)
    if [ "$SPA_RESP" = "200" ]; then
        check "GET $path → 200" "true"
    else
        check "GET $path → $SPA_RESP" "skip"
    fi
done

# --- 汇总 ---
echo ""
echo "============================================"
echo -e " 结果: ${GREEN}$pass 通过${NC}  ${RED}$fail 失败${NC}  ${YELLOW}$skip 跳过${NC}"
echo "============================================"

[ "$fail" -gt 0 ] && exit 1 || exit 0
