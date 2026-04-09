#!/bin/bash
# 千问 API 中转平台 — 告警脚本
# 由 cron 每 5 分钟执行

HEALTH=$(bash /root/qwen-proxy/scripts/healthcheck.sh 2>/dev/null)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    # 发送告警（飞书 webhook 或写日志）
    echo "[ALERT $(date -Iseconds)] 千问 API 中转平台异常: $HEALTH" >> /var/log/qwen-proxy-alert.log
    
    # 尝试自动恢复
    docker compose -f /root/qwen-proxy/docker-compose.yml up -d 2>/dev/null
    systemctl restart nginx 2>/dev/null
    
    echo "[RECOVERY $(date -Iseconds)] 已尝试自动恢复" >> /var/log/qwen-proxy-alert.log
fi
