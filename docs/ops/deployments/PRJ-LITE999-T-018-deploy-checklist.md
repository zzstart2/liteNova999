# 部署清单 — PRJ-LITE999-T-018 安全加固与备份策略

> **任务:** PRJ-LITE999-T-018 — 安全加固与备份策略 (HTTPS / 防火墙 / 数据备份 / 灾难恢复)
> **日期:** 2026-04-11
> **状态:** 待部署

---

## 一、安全现状评估

### 1.1 现有安全机制 (已有)

| 层 | 机制 | 状态 |
|----|------|------|
| 应用 | Session Auth + Access Token | ✅ middleware/auth.go (402L) |
| 应用 | Rate Limiting (Redis-backed) | ✅ middleware/rate-limit.go (205L) |
| 应用 | Secure Verification (5min TTL) | ✅ middleware/secure_verification.go (131L) |
| 应用 | Turnstile CAPTCHA | ✅ middleware/turnstile-check.go (81L) |
| 应用 | 2FA (TOTP) + Passkey (WebAuthn) | ✅ controller/passkey.go |
| 应用 | bcrypt 密码哈希 + HMAC 签名 | ✅ common/crypto.go |
| 应用 | Request ID 追踪 | ✅ middleware/request-id.go |
| Nginx | X-Content-Type-Options, X-Frame-Options | ✅ 部分 Security Headers |
| Nginx | Rate Limit (30r/s, burst 50) | ✅ limit_req_zone |
| Docker | PG/Redis 端口仅内网暴露 | ✅ 无外部端口映射 |
| 备份 | PG 日备份 (pg_dump, 7天保留) | ✅ cron 每日 02:00 |
| 应用 | Performance Monitor (过载保护) | ✅ CPU/Mem/Disk 阈值 |

### 1.2 安全缺陷 (需修复)

| # | 缺陷 | 风险 | 优先级 |
|---|------|------|--------|
| S1 | **无 HTTPS** — 明文传输 API Key 和密码 | 🔴 高 | P0 |
| S2 | **SSH: PermitRootLogin yes + PasswordAuth yes** | 🔴 高 | P0 |
| S3 | **无防火墙** — iptables 空规则 | 🔴 高 | P0 |
| S4 | **公网端口暴露**: 3088(nginx), 18060(mcp), 443, 7000, 3000 | 🟡 中 | P1 |
| S5 | **.env 权限 644** (world-readable) | 🟡 中 | P1 |
| S6 | **CORS AllowAllOrigins** + AllowCredentials | 🟡 中 | P1 |
| S7 | **缺少 Security Headers**: CSP, HSTS, Referrer-Policy | 🟡 中 | P1 |
| S8 | **无 fail2ban** — SSH 暴力破解无保护 | 🟡 中 | P1 |
| S9 | **Redis 无 TLS** (内网可接受但备注) | 🟢 低 | P2 |
| S10 | **备份无加密，无异地** | 🟡 中 | P1 |
| S11 | **无 Redis 备份** | 🟡 中 | P1 |
| S12 | **PG 无 SSL** (内网 Docker，风险低) | 🟢 低 | P2 |

---

## 二、HTTPS 配置 (S1)

### 2.1 方案: Certbot + Nginx (Docker)

```
用户 ──HTTPS:443──▶ [Nginx Container] ──HTTP──▶ [new-api :3000]
                         │
                    Let's Encrypt
                    证书自动续期
```

### 2.2 前提条件

- [ ] 域名已注册并解析到 47.237.167.8
- [ ] 阿里云安全组放行 80/443

### 2.3 配置变更

**Nginx 容器需要额外挂载:**
- 证书目录: `/etc/letsencrypt:/etc/letsencrypt:ro`
- Webroot: `/var/www/certbot:/var/www/certbot:ro`

**Nginx 配置增加:**
```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name your-domain.com;
    
    # Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # Modern TLS (TLS 1.2+)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS (6 months)
    add_header Strict-Transport-Security "max-age=15768000; includeSubDomains" always;
    
    # ... (existing proxy config)
}
```

### 2.4 证书自动续期

```bash
# Certbot renew cron (host)
0 3 * * * certbot renew --quiet --deploy-hook "docker exec new-api-nginx nginx -s reload"
```

---

## 三、SSH 加固 (S2)

### 3.1 配置变更 (/etc/ssh/sshd_config)

```diff
- PermitRootLogin yes
+ PermitRootLogin prohibit-password

- PasswordAuthentication yes
+ PasswordAuthentication no

+ PubkeyAuthentication yes
+ MaxAuthTries 3
+ LoginGraceTime 30
+ ClientAliveInterval 300
+ ClientAliveCountMax 2
+ AllowUsers root
```

### 3.2 前提

- [ ] SSH 公钥已部署到 `~/.ssh/authorized_keys`
- [ ] 当前终端保持连接 (测试新配置前不要断开)

---

## 四、防火墙 (S3/S4)

### 4.1 iptables 规则

```bash
# 默认策略
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# 保持已建立连接
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Loopback
iptables -A INPUT -i lo -j ACCEPT

# SSH (限速: 3次/分钟)
iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW -m recent --set
iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW -m recent --update --seconds 60 --hitcount 4 -j DROP
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# HTTP/HTTPS (Nginx)
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# New-API (Nginx proxy port)
iptables -A INPUT -p tcp --dport 3088 -j ACCEPT

# ICMP (ping)
iptables -A INPUT -p icmp --icmp-type echo-request -j ACCEPT

# Docker internal (forward chain managed by Docker)
iptables -A FORWARD -j DOCKER-USER 2>/dev/null || true
```

### 4.2 关闭不必要端口

| 端口 | 服务 | 动作 |
|------|------|------|
| 22 | SSH | ✅ 保留 (限速) |
| 80/443 | HTTP/HTTPS | ✅ 保留 |
| 3088 | Nginx (New-API) | ✅ 保留 |
| 3000 | Python (openclaw?) | ❌ 不应公网暴露 |
| 7000 | Node | ❌ 评估后关闭 |
| 18060 | xiaohongshu-mcp | ❌ 评估后关闭 |

---

## 五、Security Headers (S7)

追加到 Nginx HTTPS server block:

```nginx
# Security Headers
add_header X-Content-Type-Options nosniff always;
add_header X-Frame-Options DENY always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:; font-src 'self' data:;" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

# Hide server version
server_tokens off;
proxy_hide_header X-Powered-By;
proxy_hide_header X-New-Api-Version;
```

---

## 六、fail2ban (S8)

### 6.1 安装

```bash
apt install -y fail2ban
```

### 6.2 配置 (/etc/fail2ban/jail.local)

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
maxretry = 3
bantime = 86400

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
action = iptables-multiport[name=nginx-limit-req, port="http,https"]
logpath = /opt/new-api/logs/nginx_error.log
findtime = 60
maxretry = 10
bantime = 3600
```

---

## 七、文件权限 (S5)

```bash
# .env — 仅 root 可读
chmod 600 /opt/new-api/.env

# 备份目录 — 仅 root
chmod 700 /opt/new-api/backups

# Docker socket — 仅 docker 组
# (已正确: srw-rw---- root:docker)

# SSH 密钥
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

---

## 八、数据备份策略

### 8.1 现有备份 (保留并增强)

| 组件 | 现有 | 增强 |
|------|------|------|
| PostgreSQL | ✅ pg_dump 日备份 | + GPG 加密 + 异地上传 |
| Redis | ❌ 无 | + RDB 快照备份 |
| 应用数据 | ❌ 无 | + /data 卷备份 |
| 配置文件 | ❌ 无 | + /opt/new-api/config/ 备份 |
| 监控数据 | ❌ 无 | 不备份 (可重建) |

### 8.2 增强备份脚本

```
每日 02:00 — 全量备份
├── PostgreSQL (pg_dump -Fc, ~87KB 当前)
├── Redis (BGSAVE → copy dump.rdb)
├── App Data (/data volume → tar)
├── Config (/opt/new-api/config/ → tar)
├── GPG 加密所有备份
├── 上传到对象存储 (OSS/S3)
└── 清理: 本地保留 7 天, 远程保留 30 天
```

### 8.3 备份保留策略

| 位置 | 保留周期 | 频率 |
|------|----------|------|
| 本地 (/opt/new-api/backups/) | 7 天 | 每日 |
| 远程 (对象存储) | 30 天 | 每日 |
| 月度快照 (可选) | 12 个月 | 每月 1 日 |

### 8.4 备份验证

每周自动验证 (可选 cron):
```bash
# 测试 PG 备份可恢复
pg_restore -l /opt/new-api/backups/latest.dump > /dev/null 2>&1
```

---

## 九、灾难恢复方案

### 9.1 RTO/RPO 目标

| 指标 | 目标 | 说明 |
|------|------|------|
| RPO (数据丢失) | ≤ 24h | 日备份粒度 |
| RTO (恢复时间) | ≤ 2h | 全栈恢复 |

### 9.2 恢复流程

```
灾难恢复步骤 (全部丢失场景)

1. [10min] 新建 ECS 实例 (2C/4G+, 阿里云)
2. [10min] 安装 Docker + Docker Compose
3. [5min]  从对象存储下载最新备份
4. [5min]  GPG 解密备份文件
5. [5min]  恢复配置文件 (docker-compose + config/)
6. [5min]  启动 PG + Redis 容器
7. [10min] pg_restore 恢复数据库
8. [5min]  恢复 Redis 数据 (copy dump.rdb → volume)
9. [5min]  恢复应用数据卷
10. [5min] 启动 new-api + nginx
11. [5min] DNS 切换到新 IP
12. [10min] 恢复 HTTPS 证书 (certbot)
13. [5min] 验证所有服务
─────────────────────────────────
总计: ~85min (目标 RTO 2h 内)
```

### 9.3 恢复验证清单

| # | 步骤 | 验证 |
|---|------|------|
| 1 | PG 数据完整 | `SELECT count(*) FROM users, channels, tokens` |
| 2 | Redis 连接 | `redis-cli ping` → PONG |
| 3 | API 健康 | `GET /api/status` → success |
| 4 | 用户登录 | 管理员可登录 |
| 5 | 渠道可用 | 渠道测试通过 |
| 6 | HTTPS 生效 | 证书有效 + HSTS |

---

## 十、配置文件清单

| 文件 | 用途 |
|------|------|
| `security/sshd_config.patch` | SSH 加固补丁 |
| `security/iptables-rules.sh` | 防火墙规则脚本 |
| `security/fail2ban-jail.local` | fail2ban 配置 |
| `security/nginx-ssl.conf` | Nginx HTTPS 配置模板 |
| `security/nginx-security-headers.conf` | Security Headers |
| `scripts/backup-enhanced.sh` | 增强备份脚本 |
| `scripts/restore.sh` | 灾难恢复脚本 |
| `scripts/deploy-T018.sh` | 一键安全加固部署 |
| `scripts/verify-T018.sh` | 验证脚本 |

---

## 十一、部署前检查

- [ ] SSH 公钥已部署 (禁用密码后仍可登录)
- [ ] 域名已解析到服务器 IP (HTTPS 需要)
- [ ] 阿里云安全组已配置 (22/80/443/3088)
- [ ] 当前 SSH 会话保持 (不要在加固过程中断开)
- [ ] 确认 3000/7000/18060 端口的服务是否需要公网访问

---

## 十二、部署后验证矩阵

| # | 验证项 | 方法 | 预期 | 通过 |
|---|--------|------|------|------|
| 1 | SSH 密码禁用 | `ssh -o PasswordAuthentication=yes` | 拒绝 | [ ] |
| 2 | SSH 公钥登录 | `ssh -i key root@host` | 成功 | [ ] |
| 3 | 防火墙生效 | `nmap -p 3000,7000,18060 host` | filtered | [ ] |
| 4 | HTTP→HTTPS 重定向 | `curl -I http://domain` | 301 → https | [ ] |
| 5 | TLS 版本 | `nmap --script ssl-enum-ciphers -p 443` | TLS 1.2+ | [ ] |
| 6 | HSTS Header | `curl -I https://domain` | Strict-Transport-Security | [ ] |
| 7 | Security Headers | `curl -I https://domain` | CSP/X-Frame/Referrer | [ ] |
| 8 | fail2ban 运行 | `fail2ban-client status sshd` | active | [ ] |
| 9 | .env 权限 | `stat -c %a .env` | 600 | [ ] |
| 10 | 备份脚本运行 | `bash backup-enhanced.sh` | 备份文件生成 | [ ] |
| 11 | 备份加密 | `file *.gpg` | GPG encrypted | [ ] |
| 12 | PG 备份可恢复 | `pg_restore -l` | 目录列表输出 | [ ] |
| 13 | Redis 备份存在 | `ls backups/redis_*.rdb` | 文件存在 | [ ] |
| 14 | 恢复脚本语法 | `bash -n restore.sh` | 无错误 | [ ] |
| 15 | New-API 正常 | `curl https://domain/api/status` | success | [ ] |
| 16 | server_tokens 隐藏 | `curl -I` | 无 Server: nginx/x.x | [ ] |

---

*清单编制: ops-prjlite999 | 日期: 2026-04-11*
