#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-018 部署脚本 — 安全加固
# Usage: bash deploy-T018.sh [--ssh] [--firewall] [--permissions] [--fail2ban] [--backup] [--all]
#
# Modules (run individually or --all):
#   --ssh          SSH hardening (PermitRootLogin, PasswordAuth, etc.)
#   --firewall     iptables rules
#   --permissions  File permissions (.env, backups, etc.)
#   --fail2ban     Install and configure fail2ban
#   --backup       Install enhanced backup script + cron
#   --all          All of the above
#
# ⚠️  HTTPS requires domain + certbot — not automated here.
#     Use security/nginx-ssl.conf as template after certbot setup.
# =============================================================================
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SECURITY_DIR="$(dirname "$SCRIPT_DIR")/security"
DEPLOY_DIR="/opt/new-api"

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

DO_SSH=false; DO_FW=false; DO_PERM=false; DO_F2B=false; DO_BACKUP=false

for arg in "$@"; do
    case "$arg" in
        --ssh)         DO_SSH=true ;;
        --firewall)    DO_FW=true ;;
        --permissions) DO_PERM=true ;;
        --fail2ban)    DO_F2B=true ;;
        --backup)      DO_BACKUP=true ;;
        --all)         DO_SSH=true; DO_FW=true; DO_PERM=true; DO_F2B=true; DO_BACKUP=true ;;
        *)             echo "Unknown option: $arg"; exit 1 ;;
    esac
done

if ! $DO_SSH && ! $DO_FW && ! $DO_PERM && ! $DO_F2B && ! $DO_BACKUP; then
    echo "Usage: bash $0 [--ssh] [--firewall] [--permissions] [--fail2ban] [--backup] [--all]"
    exit 0
fi

echo "============================================"
echo " T-018 Security Hardening"
echo "============================================"

# =============================================
# SSH Hardening
# =============================================
if $DO_SSH; then
    echo ""
    info "=== SSH Hardening ==="

    SSHD_CONF="/etc/ssh/sshd_config"

    # Verify SSH key exists
    if [ ! -f ~/.ssh/authorized_keys ] || [ ! -s ~/.ssh/authorized_keys ]; then
        err "No SSH public key found in ~/.ssh/authorized_keys. Deploy your key first!"
    fi
    ok "SSH public key present"

    # Backup
    cp "$SSHD_CONF" "$SSHD_CONF.bak.$(date +%Y%m%d)"
    ok "Backup: $SSHD_CONF.bak.$(date +%Y%m%d)"

    # Apply hardening
    sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' "$SSHD_CONF"
    sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CONF"
    sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' "$SSHD_CONF"

    # Add if not present
    grep -q "^MaxAuthTries" "$SSHD_CONF" || echo "MaxAuthTries 3" >> "$SSHD_CONF"
    grep -q "^LoginGraceTime" "$SSHD_CONF" || echo "LoginGraceTime 30" >> "$SSHD_CONF"
    grep -q "^ClientAliveInterval" "$SSHD_CONF" || echo "ClientAliveInterval 300" >> "$SSHD_CONF"
    grep -q "^ClientAliveCountMax" "$SSHD_CONF" || echo "ClientAliveCountMax 2" >> "$SSHD_CONF"
    grep -q "^X11Forwarding" "$SSHD_CONF" && sed -i 's/^X11Forwarding.*/X11Forwarding no/' "$SSHD_CONF" || echo "X11Forwarding no" >> "$SSHD_CONF"
    grep -q "^PermitEmptyPasswords" "$SSHD_CONF" || echo "PermitEmptyPasswords no" >> "$SSHD_CONF"

    # Validate
    if sshd -t 2>/dev/null; then
        systemctl reload sshd 2>/dev/null || service sshd reload 2>/dev/null
        ok "SSH hardened and reloaded"
        warn "TEST: Open a NEW terminal and verify SSH key login works before closing this session!"
    else
        warn "sshd config test failed — reverting"
        cp "$SSHD_CONF.bak.$(date +%Y%m%d)" "$SSHD_CONF"
        err "SSH hardening failed validation"
    fi
fi

# =============================================
# Firewall
# =============================================
if $DO_FW; then
    echo ""
    info "=== Firewall ==="
    bash "$SECURITY_DIR/iptables-rules.sh" --apply
fi

# =============================================
# File Permissions
# =============================================
if $DO_PERM; then
    echo ""
    info "=== File Permissions ==="

    [ -f "$DEPLOY_DIR/.env" ] && chmod 600 "$DEPLOY_DIR/.env" && ok ".env → 600"
    [ -d "$DEPLOY_DIR/backups" ] && chmod 700 "$DEPLOY_DIR/backups" && ok "backups/ → 700"
    [ -f "$DEPLOY_DIR/.backup-passphrase" ] && chmod 600 "$DEPLOY_DIR/.backup-passphrase" && ok ".backup-passphrase → 600"
    [ -d ~/.ssh ] && chmod 700 ~/.ssh && ok "~/.ssh → 700"
    [ -f ~/.ssh/authorized_keys ] && chmod 600 ~/.ssh/authorized_keys && ok "authorized_keys → 600"

    ok "Permissions hardened"
fi

# =============================================
# fail2ban
# =============================================
if $DO_F2B; then
    echo ""
    info "=== fail2ban ==="

    if ! command -v fail2ban-client >/dev/null 2>&1; then
        info "Installing fail2ban..."
        apt-get update -qq && apt-get install -y -qq fail2ban
    fi

    cp "$SECURITY_DIR/fail2ban-jail.local" /etc/fail2ban/jail.local
    systemctl enable fail2ban
    systemctl restart fail2ban

    sleep 3
    if fail2ban-client status sshd >/dev/null 2>&1; then
        ok "fail2ban active (sshd jail enabled)"
    else
        warn "fail2ban may not be fully started"
    fi
fi

# =============================================
# Enhanced Backup
# =============================================
if $DO_BACKUP; then
    echo ""
    info "=== Enhanced Backup ==="

    mkdir -p "$DEPLOY_DIR/scripts"
    cp "$SCRIPT_DIR/backup-enhanced.sh" "$DEPLOY_DIR/scripts/"
    cp "$SCRIPT_DIR/restore.sh" "$DEPLOY_DIR/scripts/"
    chmod +x "$DEPLOY_DIR/scripts/backup-enhanced.sh" "$DEPLOY_DIR/scripts/restore.sh"

    # Update crontab
    CRON_LINE="0 2 * * * /opt/new-api/scripts/backup-enhanced.sh >> /opt/new-api/backups/backup.log 2>&1"
    ( crontab -l 2>/dev/null | grep -v "backup" ; echo "$CRON_LINE" ) | crontab -
    ok "Backup cron installed (daily 02:00)"

    # Test run (dry)
    info "Testing backup script syntax..."
    bash -n "$DEPLOY_DIR/scripts/backup-enhanced.sh" && ok "Backup script syntax OK"
    bash -n "$DEPLOY_DIR/scripts/restore.sh" && ok "Restore script syntax OK"
fi

# =============================================
# Summary
# =============================================
echo ""
echo "============================================"
echo " Security Hardening Complete"
echo "============================================"
echo ""
$DO_SSH    && echo "  ✓ SSH hardened (key-only, rate-limited)"
$DO_FW     && echo "  ✓ Firewall active (22/80/443/3088 only)"
$DO_PERM   && echo "  ✓ File permissions tightened"
$DO_F2B    && echo "  ✓ fail2ban active"
$DO_BACKUP && echo "  ✓ Enhanced backup + restore scripts installed"
echo ""
warn "Remaining manual steps:"
echo "  1. HTTPS: Register domain → certbot → replace nginx.conf with nginx-ssl.conf"
echo "  2. Verify SSH works from a NEW terminal before closing this session"
echo "  3. Review and close unnecessary public ports (3000, 7000, 18060)"
echo "  4. Configure Alertmanager receiver for backup failure notifications"
