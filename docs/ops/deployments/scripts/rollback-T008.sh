#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-008 回滚脚本
# =============================================================================
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/new-api}"
API_BASE="${API_BASE:-http://localhost:3000}"
ADMIN_TOKEN="${ADMIN_TOKEN:?请设置 ADMIN_TOKEN 环境变量}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }

cd "$DEPLOY_DIR"

echo -e "${YELLOW}"
echo "========================================"
echo " T-008 回滚操作"
echo "========================================"
echo -e "${NC}"

# Step 1: 关闭自动禁用/恢复
info "Step 1: 关闭自动禁用和自动恢复"
curl -sf -X PUT "$API_BASE/api/option/" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"key":"AutomaticDisableChannelEnabled","value":"false"}' >/dev/null && info "  AutomaticDisableChannelEnabled = false ✓" || warn "  关闭自动禁用失败"

curl -sf -X PUT "$API_BASE/api/option/" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"key":"AutomaticEnableChannelEnabled","value":"false"}' >/dev/null && info "  AutomaticEnableChannelEnabled = false ✓" || warn "  关闭自动恢复失败"

# Step 2: 恢复被自动禁用的渠道
info "Step 2: 恢复被自动禁用的渠道"
DISABLED_COUNT=$(docker compose exec -T postgres psql -U root -d new-api -t -A -c \
    "SELECT COUNT(*) FROM channels WHERE status = 3;" 2>/dev/null | tr -d '[:space:]')

if [ "${DISABLED_COUNT:-0}" -gt 0 ]; then
    warn "  发现 $DISABLED_COUNT 个自动禁用的渠道"
    read -rp "  确认恢复? [y/N] " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        docker compose exec -T postgres psql -U root -d new-api -c \
            "UPDATE channels SET status = 1 WHERE status = 3;"
        info "  已恢复 $DISABLED_COUNT 个渠道 ✓"
    else
        info "  跳过渠道恢复"
    fi
else
    info "  无自动禁用的渠道，跳过"
fi

# Step 3: 可选 — 回退镜像版本
echo ""
read -rp "是否需要回退到上一版本镜像? [y/N] " rollback_image
if [[ "$rollback_image" =~ ^[Yy]$ ]]; then
    info "Step 3: 回退镜像"

    # 列出可用备份
    echo "  可用备份:"
    ls -lh "$DEPLOY_DIR/backups/" 2>/dev/null | grep "pre-T008" || warn "  未找到 T-008 备份"

    read -rp "  请输入要恢复的备份文件名 (留空跳过): " backup_file
    if [ -n "$backup_file" ]; then
        info "  恢复数据库: $backup_file"
        docker compose exec -T postgres pg_restore -U root -d new-api --clean \
            "$DEPLOY_DIR/backups/$backup_file" || warn "  数据库恢复可能有部分错误 (通常可忽略)"
    fi

    warn "  请手动编辑 docker-compose.yml 指定上一版本 image tag，然后运行:"
    echo "    docker compose up -d --remove-orphans"
fi

echo ""
info "回滚完成"
