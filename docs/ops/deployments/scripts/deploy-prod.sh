#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-016 生产环境部署脚本
# 用法: cd /opt/new-api && bash deploy-prod.sh [init|update|rollback|status]
# =============================================================================
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/new-api}"
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="$DEPLOY_DIR/backups"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
header(){ echo -e "\n${CYAN}=== $* ===${NC}"; }

cd "$DEPLOY_DIR" || error "部署目录 $DEPLOY_DIR 不存在"

case "${1:-status}" in

# -----------------------------------------------------------------
init)
    header "首次部署初始化"

    # Check prerequisites
    command -v docker >/dev/null 2>&1 || error "docker 未安装"
    docker compose version >/dev/null 2>&1 || error "docker compose 不可用"

    # Generate secrets if .env doesn't exist
    if [ ! -f .env ]; then
        info "从 .env.example 生成 .env"
        cp .env.example .env
        sed -i "s/SESSION_SECRET=CHANGE_ME/SESSION_SECRET=$(openssl rand -hex 32)/" .env
        sed -i "s/CRYPTO_SECRET=CHANGE_ME/CRYPTO_SECRET=$(openssl rand -hex 32)/" .env
        sed -i "s/PG_PASSWORD=CHANGE_ME/PG_PASSWORD=$(openssl rand -hex 16)/" .env
        sed -i "s/REDIS_PASSWORD=CHANGE_ME/REDIS_PASSWORD=$(openssl rand -hex 16)/" .env
        info "密钥已生成，请检查 .env 并修改域名等配置"
        warn "修改完成后重新运行: bash deploy-prod.sh init"
        exit 0
    fi

    # Verify .env has real secrets
    if grep -q "CHANGE_ME" .env; then
        error ".env 中仍有 CHANGE_ME，请先修改"
    fi

    mkdir -p "$BACKUP_DIR"

    info "启动所有服务"
    docker compose -f "$COMPOSE_FILE" up -d

    info "等待健康检查..."
    sleep 10
    docker compose -f "$COMPOSE_FILE" ps

    info "首次部署完成"
    info "请配置 TLS 证书到 ./certs/ 并修改 nginx.conf 中的域名"
    ;;

# -----------------------------------------------------------------
update)
    header "版本更新"

    # Backup
    info "备份数据库"
    mkdir -p "$BACKUP_DIR"
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
        pg_dump -U newapi -Fc newapi > "$BACKUP_DIR/newapi_$(date +%Y%m%d_%H%M%S).dump"
    info "备份完成: $(ls -t $BACKUP_DIR/*.dump | head -1)"

    # Pull new images
    info "拉取新镜像"
    docker compose -f "$COMPOSE_FILE" pull new-api-master new-api-slave

    # Rolling update: slave first, then master
    info "更新 Slave 节点"
    docker compose -f "$COMPOSE_FILE" up -d --no-deps new-api-slave
    sleep 15

    # Verify slave health
    if docker compose -f "$COMPOSE_FILE" exec -T new-api-slave \
        wget -q -O - http://localhost:3000/api/status 2>/dev/null | grep -q '"success".*true'; then
        info "Slave 健康检查通过"
    else
        warn "Slave 健康检查未通过，等待更长时间..."
        sleep 30
    fi

    info "更新 Master 节点"
    docker compose -f "$COMPOSE_FILE" up -d --no-deps new-api-master
    sleep 15

    # Final health check
    header "最终健康检查"
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    for svc in new-api-master new-api-slave; do
        if docker compose -f "$COMPOSE_FILE" exec -T "$svc" \
            wget -q -O - http://localhost:3000/api/status 2>/dev/null | grep -q '"success".*true'; then
            info "$svc ✓"
        else
            warn "$svc 健康检查未通过"
        fi
    done

    info "更新完成"
    ;;

# -----------------------------------------------------------------
rollback)
    header "回滚"

    # List available backups
    echo "可用备份:"
    ls -lht "$BACKUP_DIR"/*.dump 2>/dev/null | head -5 || warn "无可用备份"

    read -rp "输入备份文件路径 (或留空仅回退镜像): " backup_file

    if [ -n "$backup_file" ]; then
        info "恢复数据库: $backup_file"
        docker compose -f "$COMPOSE_FILE" exec -T postgres \
            pg_restore -U newapi -d newapi --clean "$backup_file" || warn "部分恢复错误 (通常可忽略)"
    fi

    info "重启所有应用节点"
    docker compose -f "$COMPOSE_FILE" up -d --no-deps new-api-master new-api-slave

    info "回滚完成"
    ;;

# -----------------------------------------------------------------
status)
    header "服务状态"
    docker compose -f "$COMPOSE_FILE" ps

    header "健康检查"
    for svc in new-api-master new-api-slave postgres redis nginx; do
        state=$(docker compose -f "$COMPOSE_FILE" ps "$svc" --format json 2>/dev/null \
            | grep -o '"Health":"[^"]*"' | cut -d'"' -f4)
        state=${state:-unknown}
        case "$state" in
            healthy) echo -e "  ${GREEN}✓${NC} $svc ($state)" ;;
            *)       echo -e "  ${YELLOW}?${NC} $svc ($state)" ;;
        esac
    done

    header "资源使用"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
        new-api-master new-api-slave new-api-pg new-api-redis new-api-nginx 2>/dev/null || true

    header "最近备份"
    ls -lht "$BACKUP_DIR"/*.dump 2>/dev/null | head -3 || echo "  无备份"
    ;;

*)
    echo "Usage: $0 {init|update|rollback|status}"
    exit 1
    ;;
esac
