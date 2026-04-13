#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-010 验证脚本 — 品牌定制化配置系统
# 用法: API_BASE=http://localhost:3000 ADMIN_TOKEN=xxx bash verify-T010.sh
# =============================================================================
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"
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
echo " T-010 品牌定制化配置系统 — 验证"
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

# --- 2. 品牌字段输出 ---
echo ""
echo "=== 品牌配置 (/api/status) ==="

# system_name
SYS_NAME=$(echo "$STATUS" | grep -o '"system_name":"[^"]*"' | cut -d'"' -f4)
if [ -n "$SYS_NAME" ]; then
    check "system_name = \"$SYS_NAME\"" "true"
else
    check "system_name 存在" "false"
fi

# logo
if echo "$STATUS" | grep -q '"logo"'; then
    LOGO=$(echo "$STATUS" | grep -o '"logo":"[^"]*"' | cut -d'"' -f4)
    check "logo 字段存在 (${LOGO:-(空)})" "true"
else
    check "logo 字段存在" "false"
fi

# footer_html
if echo "$STATUS" | grep -q '"footer_html"'; then
    check "footer_html 字段存在" "true"
else
    check "footer_html 字段存在" "false"
fi

# top_up_link
if echo "$STATUS" | grep -q '"top_up_link"'; then
    check "top_up_link 字段存在" "true"
else
    check "top_up_link 字段存在" "false"
fi

# quota_display_type
QDT=$(echo "$STATUS" | grep -o '"quota_display_type":"[^"]*"' | cut -d'"' -f4)
if [ -n "$QDT" ]; then
    check "quota_display_type = \"$QDT\"" "true"
else
    check "quota_display_type 存在" "false"
fi

# --- 3. 认证配置 ---
echo ""
echo "=== 认证开关 ==="

for key in email_verification github_oauth wechat_login linuxdo_oauth telegram_oauth oidc_enabled passkey_login turnstile_check; do
    val=$(echo "$STATUS" | grep -o "\"$key\":[a-z]*" | cut -d: -f2)
    if [ -n "$val" ]; then
        check "$key = $val" "true"
    else
        check "$key 字段存在" "skip"
    fi
done

# --- 4. 面板开关 ---
echo ""
echo "=== 控制台面板 ==="

for key in api_info_enabled uptime_kuma_enabled announcements_enabled faq_enabled; do
    val=$(echo "$STATUS" | grep -o "\"$key\":[a-z]*" | cut -d: -f2)
    if [ -n "$val" ]; then
        check "$key = $val" "true"
    else
        check "$key 字段存在" "skip"
    fi
done

# --- 5. 功能开关 ---
echo ""
echo "=== 功能开关 ==="

for key in enable_drawing enable_task enable_data_export enable_batch_update; do
    val=$(echo "$STATUS" | grep -o "\"$key\":[a-z]*" | cut -d: -f2)
    if [ -n "$val" ]; then
        check "$key = $val" "true"
    else
        check "$key 字段存在" "skip"
    fi
done

# --- 6. 选项 API (管理员) ---
echo ""
echo "=== 选项管理 API ==="

OPTS_RESP=$(curl -sf "$API_BASE/api/option/" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null) || OPTS_RESP=""

if echo "$OPTS_RESP" | grep -q '"success".*true'; then
    check "GET /api/option/ (管理员)" "true"
    OPT_COUNT=$(echo "$OPTS_RESP" | grep -o '"[A-Za-z_]*":' | wc -l)
    echo -e "    选项数量: ~$OPT_COUNT"
else
    check "GET /api/option/ (管理员)" "false"
fi

# Test update (dry run: set SystemName to current value)
if [ -n "$SYS_NAME" ]; then
    UPDATE_RESP=$(curl -sf -X PUT "$API_BASE/api/option/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"key\":\"SystemName\",\"value\":\"$SYS_NAME\"}" 2>/dev/null) || UPDATE_RESP=""
    if echo "$UPDATE_RESP" | grep -q '"success".*true'; then
        check "PUT /api/option/ (更新选项)" "true"
    else
        check "PUT /api/option/ (更新选项)" "false"
    fi
fi

# --- 7. 配置持久化 ---
echo ""
echo "=== 配置持久化 ==="
if echo "$STATUS" | grep -q '"setup"'; then
    check "setup 标记存在 (数据库初始化)" "true"
else
    check "setup 标记" "skip"
fi

# --- 汇总 ---
echo ""
echo "============================================"
echo -e " 结果: ${GREEN}$pass 通过${NC}  ${RED}$fail 失败${NC}  ${YELLOW}$skip 跳过${NC}"
echo "============================================"

[ "$fail" -gt 0 ] && exit 1 || exit 0
