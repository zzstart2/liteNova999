#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-019 压力测试套件
# Usage: bash stress-test-T019.sh [--install|--baseline|--light|--medium|--heavy|--extreme|--endurance|--all]
# =============================================================================
set -eo pipefail

TARGET_HOST="${TARGET_HOST:-http://127.0.0.1:3001}"
RESULTS_DIR="/opt/new-api/stress-test-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

mkdir -p "$RESULTS_DIR"

# =============================================
# 安装压测工具
# =============================================
install_tools() {
    info "安装压力测试工具..."
    
    # wrk
    if ! command -v wrk >/dev/null 2>&1; then
        apt-get update -qq
        apt-get install -y -qq build-essential libssl-dev git
        git clone https://github.com/wg/wrk.git /tmp/wrk
        cd /tmp/wrk && make && cp wrk /usr/local/bin/
        rm -rf /tmp/wrk
        ok "wrk 已安装"
    else
        ok "wrk 已存在"
    fi
    
    # Apache Bench
    if ! command -v ab >/dev/null 2>&1; then
        apt-get install -y -qq apache2-utils
        ok "Apache Bench (ab) 已安装"
    else
        ok "ab 已存在"
    fi
    
    # jq (结果解析)
    if ! command -v jq >/dev/null 2>&1; then
        apt-get install -y -qq jq
        ok "jq 已安装"
    else
        ok "jq 已存在"
    fi
}

# =============================================
# 基准性能测试 (获取优化前数据)
# =============================================
baseline_test() {
    info "基准性能测试 (优化前)..."
    
    OUTPUT="$RESULTS_DIR/baseline_$TIMESTAMP.txt"
    
    {
        echo "===== PRJ-LITE999-T-019 Baseline Test ====="
        echo "Time: $(date)"
        echo "Target: $TARGET_HOST"
        echo "System: $(uname -a)"
        echo "Load: $(uptime)"
        echo ""
        
        echo "=== Container Resources ==="
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep new-api
        echo ""
        
        echo "=== Health Check (5次平均) ==="
        for i in {1..5}; do
            time curl -sf "$TARGET_HOST/api/status" > /dev/null 2>&1
        done
        echo ""
        
        echo "=== Light Load (10 concurrent, 60s) ==="
        wrk -t2 -c10 -d60s --latency "$TARGET_HOST/api/status"
        
    } | tee "$OUTPUT"
    
    ok "基准测试完成: $OUTPUT"
}

# =============================================
# 轻负载测试
# =============================================
light_load() {
    info "轻负载测试 (10 并发, 60s)..."
    
    OUTPUT="$RESULTS_DIR/light_load_$TIMESTAMP.txt"
    
    {
        echo "===== PRJ-LITE999-T-019 Light Load Test ====="
        echo "Time: $(date)"
        echo "Concurrent: 10, Duration: 60s"
        echo ""
        
        wrk -t2 -c10 -d60s --latency "$TARGET_HOST/api/status"
        
    } | tee "$OUTPUT"
    
    ok "轻负载测试完成: $OUTPUT"
}

# =============================================
# 中等负载测试
# =============================================
medium_load() {
    info "中等负载测试 (50 并发, 5min)..."
    
    OUTPUT="$RESULTS_DIR/medium_load_$TIMESTAMP.txt"
    
    {
        echo "===== PRJ-LITE999-T-019 Medium Load Test ====="
        echo "Time: $(date)"
        echo "Concurrent: 50, Duration: 300s"
        echo ""
        
        # 健康检查端点 (主要)
        wrk -t4 -c40 -d300s --latency "$TARGET_HOST/api/status" &
        WRK1_PID=$!
        
        # 混合端点测试 (轻量)
        ab -n 3000 -c 10 -k "$TARGET_HOST/api/status" &
        AB_PID=$!
        
        wait $WRK1_PID
        wait $AB_PID
        
    } | tee "$OUTPUT"
    
    ok "中等负载测试完成: $OUTPUT"
}

# =============================================
# 高负载测试
# =============================================
heavy_load() {
    info "高负载测试 (100 并发, 2min)..."
    
    OUTPUT="$RESULTS_DIR/heavy_load_$TIMESTAMP.txt"
    
    {
        echo "===== PRJ-LITE999-T-019 Heavy Load Test ====="
        echo "Time: $(date)"
        echo "Concurrent: 100, Duration: 120s"
        echo ""
        
        # 启动监控
        bash "$SCRIPT_DIR/monitor-performance.sh" "$RESULTS_DIR/heavy_monitor_$TIMESTAMP.txt" &
        MONITOR_PID=$!
        
        # 高并发测试
        wrk -t4 -c100 -d120s --latency "$TARGET_HOST/api/status"
        
        # 停止监控
        kill $MONITOR_PID 2>/dev/null || true
        
    } | tee "$OUTPUT"
    
    ok "高负载测试完成: $OUTPUT"
}

# =============================================
# 极限负载测试
# =============================================
extreme_load() {
    info "极限负载测试 (寻找系统边界)..."
    
    OUTPUT="$RESULTS_DIR/extreme_load_$TIMESTAMP.txt"
    
    {
        echo "===== PRJ-LITE999-T-019 Extreme Load Test ====="
        echo "Time: $(date)"
        echo ""
        
        for concurrency in 200 300 400 500; do
            echo "=== Testing $concurrency concurrent connections ==="
            
            # 30秒测试
            RESULT=$(wrk -t4 -c$concurrency -d30s --latency "$TARGET_HOST/api/status" 2>&1)
            echo "$RESULT"
            
            # 检查错误率
            ERROR_RATE=$(echo "$RESULT" | grep "Non-2xx" | awk '{print $(NF-1)}' | tr -d '()%' || echo "0")
            if [ "${ERROR_RATE%.*}" -gt 10 ]; then  # >10% 错误
                warn "错误率达到 $ERROR_RATE% — 系统边界为 $concurrency 并发"
                break
            fi
            
            sleep 10  # 恢复间隔
        done
        
    } | tee "$OUTPUT"
    
    ok "极限测试完成: $OUTPUT"
}

# =============================================
# 持久性测试
# =============================================
endurance_test() {
    info "持久性测试 (30 并发, 30 分钟)..."
    
    OUTPUT="$RESULTS_DIR/endurance_$TIMESTAMP.txt"
    
    {
        echo "===== PRJ-LITE999-T-019 Endurance Test ====="
        echo "Time: $(date)"
        echo "Concurrent: 30, Duration: 1800s (30 min)"
        echo ""
        
        # 启动监控
        bash "$SCRIPT_DIR/monitor-performance.sh" "$RESULTS_DIR/endurance_monitor_$TIMESTAMP.txt" &
        MONITOR_PID=$!
        
        # 30 分钟持续测试
        wrk -t4 -c30 -d1800s --latency "$TARGET_HOST/api/status"
        
        # 停止监控
        kill $MONITOR_PID 2>/dev/null || true
        
        echo ""
        echo "=== Final Container Stats ==="
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep new-api
        
    } | tee "$OUTPUT"
    
    ok "持久性测试完成: $OUTPUT"
}

# =============================================
# 主逻辑
# =============================================
case "${1:-baseline}" in
    --install)
        install_tools
        ;;
    --baseline)
        baseline_test
        ;;
    --light)
        light_load
        ;;
    --medium)
        medium_load
        ;;
    --heavy)
        heavy_load
        ;;
    --extreme)
        extreme_load
        ;;
    --endurance)
        endurance_test
        ;;
    --all)
        install_tools
        baseline_test
        sleep 30
        light_load
        sleep 30
        medium_load
        sleep 60
        heavy_load
        sleep 60
        extreme_load
        warn "持久性测试需单独运行: $0 --endurance"
        ;;
    *)
        echo "Usage: $0 [--install|--baseline|--light|--medium|--heavy|--extreme|--endurance|--all]"
        echo ""
        echo "Test Types:"
        echo "  --baseline   基准性能测试 (优化前)"
        echo "  --light      轻负载 (10并发, 1分钟)"
        echo "  --medium     中等负载 (50并发, 5分钟)"
        echo "  --heavy      高负载 (100并发, 2分钟)"
        echo "  --extreme    极限负载 (200-500并发, 找边界)"
        echo "  --endurance  持久性测试 (30并发, 30分钟)"
        echo "  --all        全部测试 (除 endurance)"
        echo ""
        echo "Results: $RESULTS_DIR/"
        exit 0
        ;;
esac