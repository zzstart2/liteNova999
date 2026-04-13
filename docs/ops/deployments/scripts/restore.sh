#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-018 — Disaster Recovery Script
# Usage: bash restore.sh <backup-dir> [--decrypt]
#
# Example:
#   bash restore.sh /opt/new-api/backups/daily/2026-04-11 --decrypt
#
# Prerequisites:
#   - Docker + Docker Compose installed
#   - /opt/new-api/docker-compose.prod.yml in place
#   - /opt/new-api/.env configured
#   - If encrypted: passphrase file or GPG key available
# =============================================================================
set -eo pipefail

BACKUP_DIR="${1:?Usage: bash restore.sh <backup-dir> [--decrypt]}"
DECRYPT=false
[ "${2:-}" = "--decrypt" ] && DECRYPT=true

DEPLOY_DIR="/opt/new-api"

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

[ -d "$BACKUP_DIR" ] || err "Backup directory not found: $BACKUP_DIR"

echo "============================================"
echo " PRJ-LITE999 Disaster Recovery"
echo " Source: $BACKUP_DIR"
echo "============================================"
echo ""

# =============================================================================
# 1. Decrypt (if needed)
# =============================================================================
if [ "$DECRYPT" = true ]; then
    log "Decrypting backup files..."
    PASSPHRASE_FILE="$DEPLOY_DIR/.backup-passphrase"

    for f in "$BACKUP_DIR"/*.gpg; do
        [ -f "$f" ] || continue
        OUT="${f%.gpg}"
        if [ -f "$PASSPHRASE_FILE" ]; then
            gpg --batch --yes --decrypt --passphrase-file "$PASSPHRASE_FILE" -o "$OUT" "$f"
        else
            gpg --batch --yes --decrypt -o "$OUT" "$f"
        fi
        ok "Decrypted: $(basename "$OUT")"
    done
fi

# =============================================================================
# 2. Find backup files
# =============================================================================
PG_DUMP=$(ls -t "$BACKUP_DIR"/pg_*.dump 2>/dev/null | head -1)
REDIS_RDB=$(ls -t "$BACKUP_DIR"/redis_*.rdb 2>/dev/null | head -1)
APP_TAR=$(ls -t "$BACKUP_DIR"/appdata_*.tar.gz 2>/dev/null | head -1)
CONFIG_TAR=$(ls -t "$BACKUP_DIR"/config_*.tar.gz 2>/dev/null | head -1)

echo ""
log "Found backup files:"
[ -n "$PG_DUMP" ]    && echo "  PostgreSQL: $(basename "$PG_DUMP") ($(du -sh "$PG_DUMP" | cut -f1))" || warn "  PostgreSQL: NOT FOUND"
[ -n "$REDIS_RDB" ]  && echo "  Redis:      $(basename "$REDIS_RDB") ($(du -sh "$REDIS_RDB" | cut -f1))" || warn "  Redis:      NOT FOUND"
[ -n "$APP_TAR" ]    && echo "  App Data:   $(basename "$APP_TAR") ($(du -sh "$APP_TAR" | cut -f1))" || warn "  App Data:   NOT FOUND"
[ -n "$CONFIG_TAR" ] && echo "  Config:     $(basename "$CONFIG_TAR") ($(du -sh "$CONFIG_TAR" | cut -f1))" || warn "  Config:     NOT FOUND"

echo ""
warn "This will OVERWRITE existing data. Proceed?"
read -p "[y/N] " -n 1 -r
echo
[[ $REPLY =~ ^[Yy]$ ]] || exit 0

# =============================================================================
# 3. Restore Configuration
# =============================================================================
if [ -n "$CONFIG_TAR" ]; then
    log "Restoring configuration..."
    tar xzf "$CONFIG_TAR" -C "$DEPLOY_DIR"
    chmod 600 "$DEPLOY_DIR/.env"
    ok "Configuration restored"
fi

# =============================================================================
# 4. Start infrastructure (PG + Redis only)
# =============================================================================
log "Starting PostgreSQL and Redis..."
cd "$DEPLOY_DIR"
source .env

docker compose -f docker-compose.prod.yml up -d postgres redis 2>&1
log "Waiting for PG/Redis to be ready (20s)..."
sleep 20

# Verify PG is ready
for i in $(seq 1 10); do
    if docker exec new-api-pg pg_isready -U newapi 2>/dev/null; then
        ok "PostgreSQL is ready"
        break
    fi
    sleep 3
done

# =============================================================================
# 5. Restore PostgreSQL
# =============================================================================
if [ -n "$PG_DUMP" ]; then
    log "Restoring PostgreSQL..."

    # Drop and recreate database
    docker exec new-api-pg psql -U newapi -d postgres -c "DROP DATABASE IF EXISTS newapi;" 2>/dev/null || true
    docker exec new-api-pg psql -U newapi -d postgres -c "CREATE DATABASE newapi OWNER newapi;" 2>/dev/null

    # Restore
    docker cp "$PG_DUMP" new-api-pg:/tmp/restore.dump
    docker exec new-api-pg pg_restore -U newapi -d newapi -Fc /tmp/restore.dump 2>/dev/null || true
    docker exec new-api-pg rm /tmp/restore.dump

    # Verify
    TABLE_COUNT=$(docker exec new-api-pg psql -U newapi -d newapi -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
    ok "PostgreSQL restored ($TABLE_COUNT tables)"
fi

# =============================================================================
# 6. Restore Redis
# =============================================================================
if [ -n "$REDIS_RDB" ]; then
    log "Restoring Redis..."

    docker exec new-api-redis redis-cli -a "$REDIS_PASSWORD" SHUTDOWN NOSAVE 2>/dev/null || true
    sleep 2
    docker cp "$REDIS_RDB" new-api-redis:/data/dump.rdb 2>/dev/null || true
    docker start new-api-redis 2>/dev/null || docker compose -f docker-compose.prod.yml up -d redis
    sleep 5

    if docker exec new-api-redis redis-cli -a "$REDIS_PASSWORD" PING 2>/dev/null | grep -q PONG; then
        ok "Redis restored"
    else
        warn "Redis may need manual intervention"
    fi
fi

# =============================================================================
# 7. Restore Application Data
# =============================================================================
if [ -n "$APP_TAR" ]; then
    log "Restoring application data..."
    docker run --rm -v new-api_app_data:/data -v "$(dirname "$APP_TAR")":/backup \
        alpine sh -c "rm -rf /data/* && tar xzf /backup/$(basename "$APP_TAR") -C /data"
    ok "Application data restored"
fi

# =============================================================================
# 8. Start full stack
# =============================================================================
log "Starting full application stack..."
docker compose -f docker-compose.prod.yml up -d 2>&1

log "Waiting for services to initialize (30s)..."
sleep 30

# =============================================================================
# 9. Verification
# =============================================================================
echo ""
echo "============================================"
echo " Restore Verification"
echo "============================================"

pass=0; fail=0

verify() {
    local name="$1" cmd="$2"
    if eval "$cmd" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $name"
        pass=$((pass+1))
    else
        echo -e "  ${RED}✗${NC} $name"
        fail=$((fail+1))
    fi
}

verify "PostgreSQL running" "docker exec new-api-pg pg_isready -U newapi"
verify "Redis running" "docker exec new-api-redis redis-cli -a '$REDIS_PASSWORD' PING | grep PONG"
verify "New-API healthy" "curl -sf http://127.0.0.1:3001/api/status | grep success"
verify "Nginx running" "docker ps --format '{{.Names}}' | grep new-api-nginx"

if [ -n "$PG_DUMP" ]; then
    verify "PG data present" "docker exec new-api-pg psql -U newapi -d newapi -t -c 'SELECT 1 FROM users LIMIT 1'"
fi

echo ""
echo "============================================"
echo -e " Results: ${GREEN}$pass passed${NC}  ${RED}$fail failed${NC}"
echo "============================================"

if [ "$fail" -gt 0 ]; then
    warn "Some checks failed. Review container logs."
else
    ok "Disaster recovery complete!"
    echo ""
    log "Next steps:"
    echo "  1. DNS: Point your domain to this server's IP"
    echo "  2. HTTPS: Run certbot to obtain new certificates"
    echo "  3. Test: Login as admin and verify channels"
fi
