# 部署清单 — PRJ-LITE999-T-010 品牌定制化配置系统

> **任务:** PRJ-LITE999-T-010 — 品牌定制化配置系统
> **日期:** 2026-04-10
> **状态:** 已验证

---

## 一、功能概述

品牌定制化配置系统让运营者在**不修改代码**的情况下，通过管理后台完全定制平台的外观、品牌、认证、法律文本、模块布局和运营策略。

```
管理后台 → PUT /api/option/ → model/option.go → 数据库 (options 表)
                                     │
                                     ▼
                            GlobalConfig 配置管理器
                            ┌─────────────────────────┐
                            │ console_setting          │ → API 信息/公告/FAQ/Uptime
                            │ general_setting          │ → 额度展示/货币/文档链接
                            │ operation_setting        │ → 签到/支付/配额/监控
                            │ performance_setting      │ → 磁盘缓存/性能监控
                            │ system_setting           │ → OAuth/Passkey/Legal
                            │ model_setting            │ → 模型专属配置
                            │ ratio_setting            │ → 模型倍率/分组倍率
                            └─────────────────────────┘
                                     │
                                     ▼
                            GET /api/status → 前端消费
                            ┌─────────────────────────┐
                            │ system_name / logo       │
                            │ footer_html / top_up_link│
                            │ OAuth 开关 + Client ID   │
                            │ 模块开关 + 面板配置       │
                            │ 额度展示 + 货币符号       │
                            │ 法律文本 + 签到开关       │
                            └─────────────────────────┘
```

---

## 二、配置体系全景

### 2.1 品牌标识

| 选项 | 默认值 | 说明 | 配置路径 |
|------|--------|------|----------|
| `SystemName` | `"New API"` | 系统名称 (导航栏/标题) | 系统选项 |
| `Logo` | `""` | Logo URL (导航栏) | 系统选项 |
| `Footer` | `""` | 页脚 HTML (支持链接) | 系统选项 |
| `HomePageContent` | `""` | 首页内容 (Markdown/HTML) | 系统选项 |
| `About` | `""` | 关于页面 | 系统选项 |

### 2.2 控制台面板 (ConsoleSetting)

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `api_info_enabled` | `true` | API 信息面板开关 |
| `api_info` | `""` | API 信息内容 (JSON 数组) |
| `uptime_kuma_enabled` | `true` | Uptime Kuma 状态面板开关 |
| `uptime_kuma_groups` | `""` | Uptime Kuma 分组配置 (JSON) |
| `announcements_enabled` | `true` | 公告面板开关 |
| `announcements` | `""` | 公告内容 (JSON 数组) |
| `faq_enabled` | `true` | FAQ 面板开关 |
| `faq` | `""` | FAQ 内容 (JSON 数组) |

### 2.3 导航与模块布局

| 选项 | 说明 |
|------|------|
| `HeaderNavModules` | 顶部导航模块配置 (JSON) |
| `SidebarModulesAdmin` | 管理员侧边栏模块配置 (JSON) |
| `DefaultCollapseSidebar` | 默认折叠侧边栏 |
| 用户级 `sidebar_modules` | 用户个人侧边栏配置 |

### 2.4 额度展示 (GeneralSetting)

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `quota_display_type` | `"USD"` | 额度展示类型: USD / CNY / TOKENS / CUSTOM |
| `custom_currency_symbol` | `"¤"` | 自定义货币符号 (CUSTOM 模式) |
| `custom_currency_exchange_rate` | `1.0` | 自定义汇率 (1 USD = X Custom) |
| `QuotaPerUnit` | `500000` | 每单位配额 ($0.002/1K tokens) |
| `DisplayInCurrencyEnabled` | `true` | 以货币形式展示 (旧兼容) |
| `DisplayTokenStatEnabled` | `true` | 显示 Token 统计 |

### 2.5 认证系统

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `PasswordLoginEnabled` | `true` | 密码登录 |
| `PasswordRegisterEnabled` | `true` | 密码注册 |
| `RegisterEnabled` | `true` | 注册总开关 |
| `EmailVerificationEnabled` | `false` | 邮箱验证 |
| `GitHubOAuthEnabled` | `false` | GitHub OAuth |
| `WeChatAuthEnabled` | `false` | 微信认证 |
| `LinuxDOOAuthEnabled` | `false` | Linux.do OAuth |
| `TelegramOAuthEnabled` | `false` | Telegram OAuth |
| `TurnstileCheckEnabled` | `false` | Cloudflare Turnstile 人机验证 |
| OIDC (system_setting) | 关闭 | 通用 OIDC 提供商 |
| Discord (system_setting) | 关闭 | Discord OAuth |
| Passkey (system_setting) | 关闭 | WebAuthn/Passkey 登录 |
| Custom OAuth | 关闭 | 自定义 OAuth 提供商 (数据库配置) |

### 2.6 SMTP 邮件

| 选项 | 说明 |
|------|------|
| `SMTPServer` | SMTP 服务器地址 |
| `SMTPPort` | 端口 (默认 587) |
| `SMTPAccount` | 账号 |
| `SMTPToken` | 密码/Token |
| `SMTPFrom` | 发件人地址 |
| `EmailDomainRestrictionEnabled` | 邮箱域名限制 |
| `EmailDomainWhitelist` | 白名单域名列表 |

### 2.7 运营功能开关

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `DrawingEnabled` | `true` | 绘图功能 |
| `TaskEnabled` | - | 异步任务功能 |
| `DataExportEnabled` | `true` | 数据导出/看板 |
| `MjNotifyEnabled` | - | Midjourney 通知 |
| `MjForwardUrlEnabled` | - | Midjourney URL 转发 |
| `DemoSiteEnabled` | - | 演示模式 |
| `SelfUseModeEnabled` | - | 自用模式 |
| `CheckinEnabled` | 关闭 | 签到功能 |

### 2.8 法律合规 (LegalSettings)

| 选项 | 说明 |
|------|------|
| `user_agreement` | 用户协议 (HTML/Markdown) |
| `privacy_policy` | 隐私政策 (HTML/Markdown) |

### 2.9 支付集成 (PaymentSetting)

| 提供商 | 配置文件 |
|--------|----------|
| Stripe | `setting/payment_stripe.go` |
| Creem | `setting/payment_creem.go` |
| Waffo | `setting/payment_waffo.go` |

### 2.10 国际化 (i18n)

| 语言 | 文件 |
|------|------|
| 英文 | `i18n/locales/en.yaml` |
| 简体中文 | `i18n/locales/zh-CN.yaml` |
| 繁体中文 | `i18n/locales/zh-TW.yaml` |
| 键定义 | `i18n/keys.go` (317 行) |

---

## 三、核心代码路径

### 3.1 配置管理器 (GlobalConfig)

| 文件 | 职责 |
|------|------|
| `setting/config/config.go` | 统一配置管理: Register/LoadFromDB/SaveToDB/ExportAllConfigs |
| `model/option.go` | 系统选项 CRUD: InitOptionMap/UpdateOption/LoadFromDB |

### 3.2 已注册的配置模块

| 模块名 | 文件 | 字段数 |
|--------|------|--------|
| `console_setting` | `setting/console_setting/config.go` | 8 |
| `general_setting` | `setting/operation_setting/general_setting.go` | 6 |
| `checkin_setting` | `setting/operation_setting/checkin_setting.go` | 2 |
| `performance_setting` | `setting/performance_setting/config.go` | 8 |
| `legal` | `setting/system_setting/legal.go` | 2 |
| `passkey` | `setting/system_setting/passkey.go` | 6+ |
| `discord` | `setting/system_setting/discord.go` | 3+ |
| `oidc` | `setting/system_setting/oidc.go` | 5+ |

### 3.3 公开 API

| 端点 | 方法 | 权限 | 用途 |
|------|------|------|------|
| `/api/status` | GET | 公开 | 前端消费的所有品牌/功能配置 |
| `/api/option/` | GET | Root | 读取全部系统选项 |
| `/api/option/` | PUT | Root | 更新单个系统选项 |
| `/api/user/self/setting` | PUT | User | 用户个人设置 (含侧边栏) |

---

## 四、部署配置清单

### 4.1 最小品牌配置 (必须)

```bash
API_BASE="http://localhost:3000"
ADMIN_TOKEN="<admin-session-token>"

# 1. 系统名称
curl -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"SystemName","value":"LiteNova API"}'

# 2. Logo
curl -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"Logo","value":"https://your-domain.com/logo.png"}'

# 3. 页脚
curl -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"Footer","value":"<p>© 2026 LiteNova. All rights reserved.</p>"}'
```

### 4.2 额度展示配置

```bash
# 人民币展示
curl -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"general_setting.quota_display_type","value":"CNY"}'

# 或自定义货币
curl -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"general_setting.quota_display_type","value":"CUSTOM"}'

curl -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"general_setting.custom_currency_symbol","value":"积分"}'
```

### 4.3 认证配置

```bash
# 关闭注册 (自用模式)
curl -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"RegisterEnabled","value":"false"}'

# 启用 GitHub OAuth
curl -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"GitHubOAuthEnabled","value":"true"}'

curl -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"GitHubClientId","value":"your-client-id"}'

curl -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"GitHubClientSecret","value":"your-client-secret"}'
```

---

## 五、部署前检查

- [ ] 管理员账号已创建，可登录管理后台
- [ ] Logo 图片已上传到 CDN 或可访问 URL
- [ ] 品牌名称、页脚文本已确定
- [ ] 额度展示模式已确定 (USD / CNY / Token / 自定义)
- [ ] 认证方式已确定 (密码 / OAuth / 混合)
- [ ] 如启用 OAuth: Client ID/Secret 已获取
- [ ] 如启用邮件: SMTP 服务器信息就绪
- [ ] 如启用 Turnstile: Site Key + Secret Key 就绪
- [ ] 法律文本已准备 (用户协议/隐私政策)

---

## 六、部署后验证矩阵

| # | 验证项 | 方法 | 预期 | 通过 |
|---|--------|------|------|------|
| 1 | 系统名称显示 | 浏览器访问首页 | 显示自定义名称 | [ ] |
| 2 | Logo 显示 | 导航栏 | 显示自定义 Logo | [ ] |
| 3 | 页脚显示 | 页面底部 | 显示自定义页脚 | [ ] |
| 4 | `/api/status` 返回品牌信息 | curl | system_name/logo/footer 正确 | [ ] |
| 5 | 额度展示正确 | 用户面板 | 货币符号/格式正确 | [ ] |
| 6 | 登录方式正确 | 登录页 | 仅显示启用的登录方式 | [ ] |
| 7 | 注册开关生效 | 注册页 | 关闭则无注册入口 | [ ] |
| 8 | OAuth 登录 | 点击 OAuth 按钮 | 跳转到 OAuth 提供商 | [ ] |
| 9 | 公告面板 | 控制台 | 显示配置的公告 | [ ] |
| 10 | FAQ 面板 | 控制台 | 显示配置的 FAQ | [ ] |
| 11 | 侧边栏模块 | 管理后台 | 模块按配置显示/隐藏 | [ ] |
| 12 | 法律文本 | 注册/登录页 | 用户协议/隐私政策链接 | [ ] |
| 13 | i18n 语言切换 | 前端 | 中/英/繁体切换正常 | [ ] |
| 14 | 选项持久化 | 重启服务 | 配置仍然生效 | [ ] |

---

## 七、回滚方案

所有品牌配置通过系统选项存储在数据库中，回滚即恢复选项：

```bash
# 恢复默认系统名称
curl -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"SystemName","value":"New API"}'

# 恢复默认额度展示
curl -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"general_setting.quota_display_type","value":"USD"}'

# 重新启用密码注册
curl -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"RegisterEnabled","value":"true"}'
```

或者直接操作数据库：

```sql
-- 恢复所有品牌选项为默认值
DELETE FROM options WHERE key IN ('SystemName','Logo','Footer','HomePageContent','About');
-- 重启服务使默认值生效
```

---

## 八、配置最佳实践

| 场景 | 建议 |
|------|------|
| **自用部署** | 关闭注册 + 关闭 OAuth + 强密码 |
| **团队内部** | 启用 GitHub/OIDC OAuth + 关闭密码注册 |
| **商业运营** | 完整品牌 + 多 OAuth + Turnstile + 法律文本 + 支付 |
| **演示站点** | `DemoSiteEnabled=true` + 限制配额 |
| **国内用户** | `QuotaDisplayType=CNY` + 微信登录 + 中文 i18n |
| **国际用户** | `QuotaDisplayType=USD` + GitHub/Discord/OIDC + 英文 i18n |

---

## 九、执行记录 (2026-04-10)

### 代码验证结果

| 维度 | 结果 |
|------|------|
| 品牌标识选项 (5 个) | ✅ SystemName/Logo/Footer/HomePageContent/About |
| GlobalConfig 配置管理器 | ✅ 8 个模块注册 |
| ConsoleSetting (8 字段) | ✅ API Info/Uptime/公告/FAQ |
| GeneralSetting (6 字段) | ✅ 额度展示 4 种模式 |
| 认证系统 (12+ 选项) | ✅ 密码/GitHub/微信/Telegram/LinuxDo/OIDC/Discord/Passkey/Custom OAuth |
| SMTP 邮件 (5 字段) | ✅ |
| 法律合规 (2 字段) | ✅ 用户协议/隐私政策 |
| 导航/模块布局 | ✅ HeaderNav/Sidebar/Collapse |
| 运营开关 (7+) | ✅ Drawing/Task/DataExport/Mj/Demo/SelfUse/Checkin |
| i18n (3 语言) | ✅ en/zh-CN/zh-TW |
| `/api/status` 公开字段 | ✅ 60+ 字段输出 |
| 配置持久化 | ✅ options 表 + GlobalConfig 反射加载 |

---

*清单编制: ops-prjlite999 | 日期: 2026-04-10*
