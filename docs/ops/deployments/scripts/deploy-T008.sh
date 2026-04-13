#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-008 部署脚本 — 多服务商健康检查机制
# =============================================================================
set -euo pipefail

# --------------- 配置 ---------------
DEPLOY_DIR="${DEPLOY_DIR:-/opt/new-api}"
BACKUP_DIR="${DEPLOY_DIR}/backups"
API_BASE="${API_BASE:-http://localhost:3000}"
ADMIN_TOKEN="${ADMIN_TOKEN:?请设置 ADMIN_TOKEN 环境变量}"
HEALTH_TIMEOUT=90

# --------------- 颜色 ---------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# --------------- Step 0: 前置检查 ---------------
info "Step 0: 前置检查"
cd "$DEPLOY_DIR" || error "部署目录 $DEPLOY_DIR 不存在"
command -v docker >/dev/null 2>&1 || error "docker 未安装"
docker compose version >/dev/null 2>&1 || error "docker compose 不可用"

# --------------- Step 1: 数据库备份 ---------------
info "Step 1: 备份数据库"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/pre-T008_$(date +%Y%m%d_%H%M%S).dump"
docker compose exec -T postgres pg_dump -U root -Fc new-api > "$BACKUP_FILE"
info "备份完成: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# --------------- Step 2: 拉取并部署 ---------------
info "Step 2: 拉取新镜像"
docker compose pull

info "Step 2: 启动新容器"
docker compose up -d --remove-orphans

# --------------- Step 3: 等待健康检查 ---------------
info "Step 3: 等待服务就绪 (最多 ${HEALTH_TIMEOUT}s)"
elapsed=0
until curl -sf "$API_BASE/api/status" 2>/dev/null | grep -q '"success".*true'; do
    sleep 5
    elapsed=$((elapsed + 5))
    if [ "$elapsed" -ge "$HEALTH_TIMEOUT" ]; then
        error "服务启动超时 (${HEALTH_TIMEOUT}s)，请检查日志: docker compose logs new-api"
    fi
    echo -n "."
done
echo ""
info "服务就绪 (${elapsed}s)"

# --------------- Step 4: 开启健康检查配置 ---------------
info "Step 4: 配置系统选项"

set_option() {
    local key="$1" value="$2"
    local resp
    resp=$(curl -sf -X PUT "$API_BASE/api/option/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"key\":\"$key\",\"value\":\"$value\"}" 2>&1) || {
        warn "设置 $key=$value 失败: $resp"
        return 1
    }
    info "  $key = $value ✓"
}

set_option "AutomaticDisableChannelEnabled" "true"
set_option "AutomaticEnableChannelEnabled"  "true"
set_option "ChannelDisableThreshold"        "10"

# --------------- Step 5: 功能验证 ---------------
info "Step 5: 功能验证"

# 5a: 单渠道测试（取第一个启用的渠道）
CHANNEL_ID=$(docker compose exec -T postgres psql -U root -d new-api -t -A -c \
    "SELECT id FROM channels WHERE status = 1 LIMIT 1;" 2>/dev/null | tr -d '[:space:]')

if [ -n "$CHANNEL_ID" ]; then
    info "  测试渠道 #$CHANNEL_ID"
    TEST_RESP=$(curl -sf "$API_BASE/api/channel/test/$CHANNEL_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN" 2>&1) || true

    if echo "$TEST_RESP" | grep -q '"success".*true'; then
        RESP_TIME=$(echo "$TEST_RESP" | grep -o '"time":[0-9.]*' | cut -d: -f2)
        info "  单渠道测试通过 ✓ (响应时间: ${RESP_TIME}s)"
    else
        warn "  单渠道测试未通过 (非致命): $TEST_RESP"
    fi
else
    warn "  无可用渠道，跳过单渠道测试"
fi

# 5b: 检查日志
info "  检查自动测试日志..."
sleep 3
if docker compose logs --tail=30 new-api 2>/dev/null | grep -qi "automatically test\|auto.*test.*channel"; then
    info "  自动测试已启动 ✓"
else
    info "  自动测试将在下一个周期启动 (间隔 10 分钟)"
fi

# 5c: 渠道状态分布
info "  渠道状态分布:"
docker compose exec -T postgres psql -U root -d new-api -c \
    "SELECT
        CASE status
            WHEN 0 THEN '未知'
            WHEN 1 THEN '启用'
            WHEN 2 THEN '手动禁用'
            WHEN 3 THEN '自动禁用'
        END AS 状态,
        COUNT(*) AS 数量
     FROM channels GROUP BY status ORDER BY status;" 2>/dev/null || true

# --------------- 完成 ---------------
echo ""
info "========================================="
info " T-008 多服务商健康检查机制 — 部署完成"
info "========================================="
info ""
info "已开启:"
info "  ✓ 自动禁用异常渠道"
info "  ✓ 自动恢复已修复渠道"
info "  ✓ 超时阈值: 10s"
info "  ✓ 定时巡检: 每 10 分钟 (via CHANNEL_TEST_FREQUENCY)"
info ""
info "后续监控:"
info "  docker compose logs -f new-api | grep -i 'channel.*test\|channel.*disable\|channel.*enable'"
info ""
info "回滚命令:"
info "  # 紧急关闭自动禁用"
info "  curl -X PUT $API_BASE/api/option/ -H 'Authorization: Bearer \$TOKEN' -d '{\"key\":\"AutomaticDisableChannelEnabled\",\"value\":\"false\"}'"
info "  # 恢复被误禁用的渠道"
info "  docker compose exec postgres psql -U root -d new-api -c \"UPDATE channels SET status = 1 WHERE status = 3;\""
