#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-018 验证脚本 — 安全加固与备份策略
# Usage: bash verify-T018.sh [DOMAIN]
# =============================================================================
set -eo pipefail

DOMAIN="${1:-}"

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
echo " T-018 安全加固 — 验证"
echo "============================================"

# --- 1. SSH Hardening ---
echo ""
echo "=== SSH 加固 ==="

SSHD_CONF="/etc/ssh/sshd_config"
if [ -f "$SSHD_CONF" ]; then
    ROOT_LOGIN=$(grep "^PermitRootLogin" "$SSHD_CONF" | awk '{print $2}')
    if [ "$ROOT_LOGIN" = "prohibit-password" ] || [ "$ROOT_LOGIN" = "no" ]; then
        check "PermitRootLogin = $ROOT_LOGIN" "true"
    else
        check "PermitRootLogin = ${ROOT_LOGIN:-not set}" "false"
    fi

    PASS_AUTH=$(grep "^PasswordAuthentication" "$SSHD_CONF" | awk '{print $2}')
    if [ "$PASS_AUTH" = "no" ]; then
        check "PasswordAuthentication = no" "true"
    else
        check "PasswordAuthentication = ${PASS_AUTH:-not set}" "false"
    fi

    grep -q "^MaxAuthTries" "$SSHD_CONF" && check "MaxAuthTries configured" "true" || check "MaxAuthTries" "false"
else
    check "sshd_config" "skip"
fi

# --- 2. Firewall ---
echo ""
echo "=== 防火墙 ==="

if command -v iptables >/dev/null 2>&1; then
    DEFAULT_POLICY=$(iptables -L INPUT -n 2>/dev/null | head -1 | grep -o "DROP\|REJECT" || echo "ACCEPT")
    if [ "$DEFAULT_POLICY" = "DROP" ] || [ "$DEFAULT_POLICY" = "REJECT" ]; then
        check "INPUT default policy: $DEFAULT_POLICY" "true"
    else
        check "INPUT default policy: $DEFAULT_POLICY (should be DROP)" "false"
    fi

    RULE_COUNT=$(iptables -L INPUT -n 2>/dev/null | tail -n +3 | wc -l)
    if [ "$RULE_COUNT" -gt 3 ]; then
        check "iptables rules active ($RULE_COUNT rules)" "true"
    else
        check "iptables rules ($RULE_COUNT — too few)" "false"
    fi
else
    check "iptables" "skip"
fi

# --- 3. File Permissions ---
echo ""
echo "=== 文件权限 ==="

ENV_FILE="/opt/new-api/.env"
if [ -f "$ENV_FILE" ]; then
    PERM=$(stat -c %a "$ENV_FILE" 2>/dev/null)
    if [ "$PERM" = "600" ]; then
        check ".env permissions = 600" "true"
    else
        check ".env permissions = $PERM (should be 600)" "false"
    fi
else
    check ".env file" "skip"
fi

BACKUP_DIR="/opt/new-api/backups"
if [ -d "$BACKUP_DIR" ]; then
    BPERM=$(stat -c %a "$BACKUP_DIR" 2>/dev/null)
    if [ "$BPERM" = "700" ]; then
        check "backups/ permissions = 700" "true"
    else
        check "backups/ permissions = $BPERM (should be 700)" "false"
    fi
fi

# --- 4. fail2ban ---
echo ""
echo "=== fail2ban ==="

if command -v fail2ban-client >/dev/null 2>&1; then
    check "fail2ban installed" "true"
    if fail2ban-client status sshd >/dev/null 2>&1; then
        BANNED=$(fail2ban-client status sshd 2>/dev/null | grep "Currently banned" | awk '{print $NF}')
        check "sshd jail active (banned: $BANNED)" "true"
    else
        check "sshd jail" "false"
    fi
else
    check "fail2ban" "false"
fi

# --- 5. HTTPS ---
echo ""
echo "=== HTTPS ==="

if [ -n "$DOMAIN" ]; then
    HTTPS_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "https://$DOMAIN/api/status" 2>/dev/null || echo "000")
    if [ "$HTTPS_CODE" = "200" ]; then
        check "HTTPS → $DOMAIN → 200" "true"
    else
        check "HTTPS → $DOMAIN → $HTTPS_CODE" "false"
    fi

    HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "http://$DOMAIN/" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "301" ]; then
        check "HTTP → HTTPS redirect (301)" "true"
    else
        check "HTTP → HTTPS redirect ($HTTP_CODE)" "skip"
    fi

    HSTS=$(curl -sf -I "https://$DOMAIN/" 2>/dev/null | grep -i "strict-transport-security" || echo "")
    if [ -n "$HSTS" ]; then
        check "HSTS header present" "true"
    else
        check "HSTS header" "false"
    fi

    # Security headers
    HEADERS=$(curl -sf -I "https://$DOMAIN/" 2>/dev/null)
    echo "$HEADERS" | grep -qi "x-content-type-options" && check "X-Content-Type-Options" "true" || check "X-Content-Type-Options" "false"
    echo "$HEADERS" | grep -qi "x-frame-options" && check "X-Frame-Options" "true" || check "X-Frame-Options" "false"
    echo "$HEADERS" | grep -qi "content-security-policy" && check "Content-Security-Policy" "true" || check "Content-Security-Policy" "skip"
else
    check "HTTPS (需要传入 DOMAIN 参数)" "skip"
fi

# --- 6. Backup ---
echo ""
echo "=== 备份 ==="

BACKUP_SCRIPT="/opt/new-api/scripts/backup-enhanced.sh"
if [ -f "$BACKUP_SCRIPT" ]; then
    check "Enhanced backup script installed" "true"
    bash -n "$BACKUP_SCRIPT" 2>/dev/null && check "Backup script syntax valid" "true" || check "Backup script syntax" "false"
else
    check "Enhanced backup script" "false"
fi

RESTORE_SCRIPT="/opt/new-api/scripts/restore.sh"
if [ -f "$RESTORE_SCRIPT" ]; then
    check "Restore script installed" "true"
    bash -n "$RESTORE_SCRIPT" 2>/dev/null && check "Restore script syntax valid" "true" || check "Restore script syntax" "false"
else
    check "Restore script" "false"
fi

# Check crontab
if crontab -l 2>/dev/null | grep -q "backup-enhanced"; then
    check "Backup cron configured" "true"
else
    check "Backup cron" "false"
fi

# Check recent backup
LATEST=$(ls -t /opt/new-api/backups/daily/*/pg_*.dump 2>/dev/null | head -1)
if [ -n "$LATEST" ]; then
    AGE_HOURS=$(( ($(date +%s) - $(stat -c %Y "$LATEST")) / 3600 ))
    check "Latest PG backup: $(basename "$LATEST") (${AGE_HOURS}h ago)" "true"
else
    LEGACY=$(ls -t /opt/new-api/backups/newapi_*.dump 2>/dev/null | head -1)
    if [ -n "$LEGACY" ]; then
        check "Legacy PG backup exists" "true"
    else
        check "PG backup" "false"
    fi
fi

# --- 7. Service Health ---
echo ""
echo "=== 服务健康 ==="

API_STATUS=$(curl -sf "http://127.0.0.1:3001/api/status" 2>/dev/null || echo "")
if echo "$API_STATUS" | grep -q '"success".*true'; then
    check "New-API healthy" "true"
else
    check "New-API" "false"
fi

# --- 8. Exposed Ports ---
echo ""
echo "=== 端口暴露 ==="

for port in 3000 7000 18060; do
    if netstat -tlnp 2>/dev/null | grep -q "0.0.0.0:$port "; then
        check "Port $port publicly exposed (should be restricted)" "false"
    else
        check "Port $port not publicly exposed" "true"
    fi
done

# --- Summary ---
echo ""
echo "============================================"
echo -e " 结果: ${GREEN}$pass 通过${NC}  ${RED}$fail 失败${NC}  ${YELLOW}$skip 跳过${NC}"
echo "============================================"

[ "$fail" -gt 0 ] && exit 1 || exit 0
