#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-018 — Enhanced Backup Script
# Usage: bash backup-enhanced.sh [--no-encrypt] [--upload]
#
# Features:
#   - PostgreSQL full dump (pg_dump -Fc)
#   - Redis RDB snapshot
#   - Application data volume
#   - Configuration files
#   - GPG encryption (optional)
#   - Remote upload (optional, needs ossutil/aws/rclone)
#   - Retention: local 7d, remote 30d
#
# Cron: 0 2 * * * /opt/new-api/scripts/backup-enhanced.sh >> /opt/new-api/backups/backup.log 2>&1
# =============================================================================
set -eo pipefail

BACKUP_DIR="/opt/new-api/backups"
DEPLOY_DIR="/opt/new-api"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE=$(date +%Y-%m-%d)
ENCRYPT=true
UPLOAD=false
GPG_RECIPIENT="${GPG_RECIPIENT:-}"  # Set to GPG key ID for asymmetric, or leave empty for passphrase

[ "${1:-}" = "--no-encrypt" ] && ENCRYPT=false
[ "${1:-}" = "--upload" ] || [ "${2:-}" = "--upload" ] && UPLOAD=true

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

mkdir -p "$BACKUP_DIR/daily"
DAILY_DIR="$BACKUP_DIR/daily/$DATE"
mkdir -p "$DAILY_DIR"

# =============================================================================
# 1. PostgreSQL Backup
# =============================================================================
log "Starting PostgreSQL backup..."

PG_DUMP="$DAILY_DIR/pg_${TIMESTAMP}.dump"
if docker exec new-api-pg pg_dump -U newapi -Fc newapi > "$PG_DUMP" 2>/dev/null; then
    PG_SIZE=$(du -sh "$PG_DUMP" | cut -f1)
    log "PostgreSQL backup OK: $PG_DUMP ($PG_SIZE)"
else
    log "ERROR: PostgreSQL backup FAILED"
    rm -f "$PG_DUMP"
fi

# =============================================================================
# 2. Redis Backup
# =============================================================================
log "Starting Redis backup..."

# Trigger BGSAVE
source "$DEPLOY_DIR/.env" 2>/dev/null || true
docker exec new-api-redis redis-cli -a "$REDIS_PASSWORD" BGSAVE 2>/dev/null || true
sleep 3  # Wait for BGSAVE to complete

REDIS_DUMP="$DAILY_DIR/redis_${TIMESTAMP}.rdb"
docker cp new-api-redis:/data/dump.rdb "$REDIS_DUMP" 2>/dev/null
if [ -f "$REDIS_DUMP" ] && [ -s "$REDIS_DUMP" ]; then
    REDIS_SIZE=$(du -sh "$REDIS_DUMP" | cut -f1)
    log "Redis backup OK: $REDIS_DUMP ($REDIS_SIZE)"
else
    log "WARN: Redis backup empty or failed (may not have data yet)"
    rm -f "$REDIS_DUMP"
fi

# =============================================================================
# 3. Application Data Volume
# =============================================================================
log "Starting app data backup..."

APP_TAR="$DAILY_DIR/appdata_${TIMESTAMP}.tar.gz"
docker run --rm -v new-api_app_data:/data -v "$DAILY_DIR":/backup \
    alpine tar czf "/backup/appdata_${TIMESTAMP}.tar.gz" -C /data . 2>/dev/null
if [ -f "$APP_TAR" ] && [ -s "$APP_TAR" ]; then
    APP_SIZE=$(du -sh "$APP_TAR" | cut -f1)
    log "App data backup OK: $APP_TAR ($APP_SIZE)"
else
    log "WARN: App data backup empty (volume may not exist as 'new-api_app_data')"
fi

# =============================================================================
# 4. Configuration Files
# =============================================================================
log "Starting config backup..."

CONFIG_TAR="$DAILY_DIR/config_${TIMESTAMP}.tar.gz"
tar czf "$CONFIG_TAR" \
    -C "$DEPLOY_DIR" \
    config/ \
    docker-compose.prod.yml \
    docker-compose.monitoring.yml \
    .env \
    2>/dev/null || tar czf "$CONFIG_TAR" -C "$DEPLOY_DIR" config/ .env 2>/dev/null

if [ -f "$CONFIG_TAR" ] && [ -s "$CONFIG_TAR" ]; then
    CFG_SIZE=$(du -sh "$CONFIG_TAR" | cut -f1)
    log "Config backup OK: $CONFIG_TAR ($CFG_SIZE)"
else
    log "WARN: Config backup failed"
fi

# =============================================================================
# 5. GPG Encryption
# =============================================================================
if [ "$ENCRYPT" = true ]; then
    log "Encrypting backups..."

    PASSPHRASE_FILE="$DEPLOY_DIR/.backup-passphrase"
    if [ ! -f "$PASSPHRASE_FILE" ]; then
        log "WARN: No passphrase file at $PASSPHRASE_FILE — generating one"
        openssl rand -base64 32 > "$PASSPHRASE_FILE"
        chmod 600 "$PASSPHRASE_FILE"
        log "Generated passphrase file (SAVE THIS SECURELY!): $PASSPHRASE_FILE"
    fi

    for f in "$DAILY_DIR"/*.{dump,rdb,tar.gz} 2>/dev/null; do
        [ -f "$f" ] || continue
        if [ -n "$GPG_RECIPIENT" ]; then
            gpg --batch --yes --recipient "$GPG_RECIPIENT" --encrypt "$f" && rm -f "$f"
        else
            gpg --batch --yes --symmetric --cipher-algo AES256 \
                --passphrase-file "$PASSPHRASE_FILE" "$f" && rm -f "$f"
        fi
    done
    log "Encryption complete (*.gpg files)"
fi

# =============================================================================
# 6. Create manifest
# =============================================================================
MANIFEST="$DAILY_DIR/MANIFEST.txt"
cat > "$MANIFEST" << EOF
Backup Manifest
Date: $DATE
Time: $TIMESTAMP
Host: $(hostname)
Encrypted: $ENCRYPT

Files:
$(ls -lh "$DAILY_DIR/" | grep -v MANIFEST | tail -n +2)

Sizes:
$(du -sh "$DAILY_DIR/")
EOF
log "Manifest written: $MANIFEST"

# =============================================================================
# 7. Remote Upload (optional)
# =============================================================================
if [ "$UPLOAD" = true ]; then
    log "Starting remote upload..."

    if command -v ossutil >/dev/null 2>&1; then
        # Aliyun OSS
        OSS_BUCKET="${OSS_BUCKET:-oss://your-backup-bucket}"
        ossutil cp -r "$DAILY_DIR" "$OSS_BUCKET/new-api/$DATE/" --force
        log "Uploaded to $OSS_BUCKET/new-api/$DATE/"
    elif command -v aws >/dev/null 2>&1; then
        # AWS S3
        S3_BUCKET="${S3_BUCKET:-s3://your-backup-bucket}"
        aws s3 sync "$DAILY_DIR" "$S3_BUCKET/new-api/$DATE/"
        log "Uploaded to $S3_BUCKET/new-api/$DATE/"
    elif command -v rclone >/dev/null 2>&1; then
        # rclone (any backend)
        RCLONE_REMOTE="${RCLONE_REMOTE:-backup:new-api-backups}"
        rclone copy "$DAILY_DIR" "$RCLONE_REMOTE/$DATE/"
        log "Uploaded to $RCLONE_REMOTE/$DATE/"
    else
        log "WARN: No upload tool found (ossutil/aws/rclone). Skipping upload."
    fi
fi

# =============================================================================
# 8. Retention — Clean old backups
# =============================================================================
log "Cleaning old backups..."

# Local: 7 days
find "$BACKUP_DIR/daily" -maxdepth 1 -type d -mtime +7 -exec rm -rf {} + 2>/dev/null
LOCAL_COUNT=$(ls -d "$BACKUP_DIR/daily/"*/ 2>/dev/null | wc -l)
log "Local retention: $LOCAL_COUNT daily backups (7d policy)"

# Legacy format cleanup (from old backup.sh)
find "$BACKUP_DIR" -maxdepth 1 -name "newapi_*.dump" -mtime +7 -delete 2>/dev/null

# =============================================================================
# Summary
# =============================================================================
TOTAL_SIZE=$(du -sh "$DAILY_DIR" | cut -f1)
log "=== Backup complete: $DAILY_DIR ($TOTAL_SIZE) ==="
