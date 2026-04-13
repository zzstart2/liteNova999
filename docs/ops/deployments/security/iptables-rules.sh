#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-018 — iptables Firewall Rules
# Usage: bash iptables-rules.sh [--apply]
#   Without --apply: dry-run (prints rules only)
#   With --apply: applies rules and persists
# =============================================================================
set -eo pipefail

APPLY=false
[ "${1:-}" = "--apply" ] && APPLY=true

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

apply_rules() {
    # === Flush existing rules ===
    iptables -F INPUT
    iptables -F OUTPUT

    # === Default policies ===
    iptables -P INPUT DROP
    iptables -P FORWARD DROP   # Docker manages FORWARD via DOCKER-USER
    iptables -P OUTPUT ACCEPT

    # === Loopback ===
    iptables -A INPUT -i lo -j ACCEPT

    # === Established/Related connections ===
    iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

    # === SSH (port 22) with rate limiting ===
    # Max 3 new connections per minute per source IP
    iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW -m recent --name SSH --set
    iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW -m recent --name SSH --update --seconds 60 --hitcount 4 -j DROP
    iptables -A INPUT -p tcp --dport 22 -j ACCEPT

    # === HTTP (port 80) — for Let's Encrypt + redirect ===
    iptables -A INPUT -p tcp --dport 80 -j ACCEPT

    # === HTTPS (port 443) ===
    iptables -A INPUT -p tcp --dport 443 -j ACCEPT

    # === New-API via Nginx (port 3088) ===
    # TODO: Remove this rule once HTTPS is configured (redirect 3088 → 443)
    iptables -A INPUT -p tcp --dport 3088 -j ACCEPT

    # === ICMP (ping) ===
    iptables -A INPUT -p icmp --icmp-type echo-request -m limit --limit 1/s --limit-burst 4 -j ACCEPT

    # === Docker internal ===
    # Docker manages its own chains; we don't touch DOCKER-USER here
    # to avoid breaking container networking

    # === Log dropped packets (rate limited) ===
    iptables -A INPUT -m limit --limit 5/min -j LOG --log-prefix "iptables-dropped: " --log-level 4
}

echo "============================================"
echo " T-018 Firewall Rules"
echo "============================================"
echo ""

if [ "$APPLY" = true ]; then
    warn "Applying iptables rules..."
    warn "Make sure you have an active SSH session that won't be interrupted!"
    echo ""
    read -p "Continue? [y/N] " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]] || exit 0

    apply_rules
    ok "Rules applied"

    # Persist rules
    if command -v netfilter-persistent >/dev/null 2>&1; then
        netfilter-persistent save
        ok "Rules persisted via netfilter-persistent"
    elif command -v iptables-save >/dev/null 2>&1; then
        iptables-save > /etc/iptables.rules
        ok "Rules saved to /etc/iptables.rules"
        # Add to rc.local or create systemd unit for restore on boot
        if [ ! -f /etc/network/if-pre-up.d/iptables ]; then
            cat > /etc/network/if-pre-up.d/iptables << 'EOF'
#!/bin/sh
/sbin/iptables-restore < /etc/iptables.rules
EOF
            chmod +x /etc/network/if-pre-up.d/iptables
            ok "Created boot-time restore hook"
        fi
    else
        warn "Could not persist rules automatically. Save manually:"
        warn "  iptables-save > /etc/iptables.rules"
    fi

    echo ""
    info "Current rules:"
    iptables -L INPUT -n --line-numbers
else
    info "Dry-run mode — rules that would be applied:"
    echo ""
    echo "  Policy: INPUT DROP, FORWARD DROP, OUTPUT ACCEPT"
    echo ""
    echo "  ACCEPT  lo interface"
    echo "  ACCEPT  ESTABLISHED,RELATED"
    echo "  ACCEPT  tcp :22 (SSH, rate limit 3/min)"
    echo "  ACCEPT  tcp :80 (HTTP / Let's Encrypt)"
    echo "  ACCEPT  tcp :443 (HTTPS)"
    echo "  ACCEPT  tcp :3088 (Nginx proxy, temporary)"
    echo "  ACCEPT  icmp echo-request (1/s)"
    echo "  LOG     dropped packets (5/min)"
    echo "  DROP    everything else"
    echo ""
    echo "  Blocked ports: 3000, 5355, 7000, 18060, and all others"
    echo ""
    info "To apply: bash $0 --apply"
fi
