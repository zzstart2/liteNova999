# 千问 API 中转平台 — 项目状态

## 当前阶段
Phase 1：MVP 上线

## 整体进度
- 后端：5/5 任务完成 ✅
- 前端：0/3 任务完成
- 测试：0/4 任务完成

## 最近更新
- 2026-04-09 12:18: BE-005 完成 — healthcheck.sh + alert.sh + cron 每5分钟
- 2026-04-09 12:17: BE-004 完成 — Nginx 反代:80 + rate_limit + fail2ban + 安全头 + 审计日志
- 2026-04-09 12:15: BE-003 完成 — 分组限流 + Token 级计费 + 配额耗尽自动拒绝
- 2026-04-09 10:43: BE-002 完成 — 千问渠道全链路调通（turbo/max ✅, plus 免费额度耗尽）
- 2026-04-09 09:57: BE-001 完成 — Docker + One-API + PG14 + Redis7 部署

## 服务信息
- One-API 直连: http://47.236.224.62:3000
- Nginx 反代: http://47.236.224.62 (:80)
- 管理员: root / Qw3n@Pr0xy#2026!

## 用户分组
| 分组 | 用户 | 渠道 | 配额 |
|------|------|------|------|
| basic | test_basic | qwen-turbo/plus/max | 500k quota |
| standard | teststandard | 同上 | 999M quota |
| premium | test_premium | 同上 | 999M quota |
| default(admin) | root | 同上 | 无限 |

## 阻塞
- qwen-plus: 阿哲需在 DashScope 关闭"仅免费额度"
- 域名未提供（当前 IP 直连）
