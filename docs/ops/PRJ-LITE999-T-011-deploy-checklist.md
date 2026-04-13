# 部署清单 — PRJ-LITE999-T-011 Landing Page 开发

> **任务:** PRJ-LITE999-T-011 — Landing Page 开发
> **日期:** 2026-04-11
> **状态:** 已验证

---

## 一、功能概述

Landing Page 是平台的公开门面——为访客展示品牌、服务商支持、API 入口和模型定价，引导用户注册/登录。

```
Landing Page 架构
│
├── 首页 (/)
│   ├── src/pages/Home/index.jsx (356L)
│   │   ├── Banner 区: 标题 + 描述 + Base URL 复制 + CTA 按钮
│   │   ├── 供应商图标: 20 个 @lobehub/icons (30+ 供应商)
│   │   ├── 背景效果: 双色模糊球 (indigo + teal) + 深浅主题适配
│   │   ├── 标题动效: shine-text 流光渐变
│   │   ├── 端点轮播: ScrollList 自动滚动 14 个 API 端点
│   │   └── 自定义模式: HomePageContent (Markdown / HTML / iframe URL)
│   │
│   └── 公告弹窗: NoticeModal (255L) — 每日一次 + Markdown 渲染
│
├── 定价页 (/pricing)
│   └── ModelPricingPage — 模型定价系统
│       ├── 27 个组件 (1,026L)
│       ├── 筛选: 端点/分组/配额类型/标签/厂商
│       ├── 双视图: 卡片 + 表格
│       └── 详情侧滑: 模型基本信息 + 端点 + 价格表
│
├── 关于页 (/about)
│   └── src/pages/About/index.jsx (173L) — 动态内容 (Markdown/HTML/iframe)
│
├── 认证页
│   ├── /login → LoginForm (组件)
│   ├── /register → RegisterForm (805L)
│   ├── /oauth/* → OAuth2Callback
│   ├── 密码重置: PasswordResetForm + PasswordResetConfirm
│   └── 2FA: TwoFAVerification (244L)
│
└── 法律页
    ├── /user-agreement → UserAgreement
    └── /privacy-policy → PrivacyPolicy
```

---

## 二、页面清单

### 2.1 Home 首页 (356L)

| 区域 | 功能 | 技术实现 |
|------|------|----------|
| Hero Banner | 主标题 + 副标题 + 渐变光效 | `.shine-text` CSS 动画 |
| Base URL | 服务地址展示 + 复制 | `Input` + `ScrollList` 轮播端点 |
| CTA 按钮 | "获取密钥" + "文档"/"GitHub" | `Link to /console` + 外链 |
| 供应商展示 | 20 个品牌图标 + "30+" 标识 | `@lobehub/icons` |
| 背景效果 | 双色模糊球 (indigo/teal) | CSS `.blur-ball` + `filter: blur(120px)` |
| 深色适配 | 浅色降低透明度 | CSS `:not(.dark)` 选择器 |
| 自定义内容 | HomePageContent 覆盖默认 | Markdown / HTML / iframe |
| 公告弹窗 | 每日首次访问弹出 | `NoticeModal` + `localStorage` |
| 响应式 | 4 级断点 (sm/md/lg/xl) | Tailwind responsive |
| 国际化 | 中英双语标题 | `useTranslation` + 中文 tracking 调整 |

**API 端点轮播 (14 个):**
```
/v1/chat/completions, /v1/responses, /v1/messages, /v1/embeddings,
/v1/rerank, /v1/images/generations, /v1/audio/speech, ...
```

**供应商图标 (20 个):**
Moonshot, OpenAI, xAI, Zhipu, Volcengine, Cohere, Claude, Gemini, Suno, Minimax, Wenxin, Spark, Qingyan, DeepSeek, Qwen, Midjourney, Grok, AzureAI, Hunyuan, Xinference

### 2.2 Pricing 定价页

| 组件 | 数量 | 用途 |
|------|------|------|
| layout/ | 5 个 | PricingPage/Sidebar/TopSection/Content/View |
| filter/ | 6 个 | 端点类型/分组/配额类型/标签/厂商/显示设置 |
| view/ | 4 个 | 卡片视图/卡片骨架/表格/表格列定义 |
| modal/ | 6 个 | 详情侧滑/筛选弹窗/基本信息/端点/Header/价格表 |
| hooks | 2 个 | useModelPricingData (408L) + usePricingFilterCounts |
| **总计** | **27 组件** | **1,026 行** |

### 2.3 认证组件 (2,552L)

| 组件 | 行数 | 功能 |
|------|------|------|
| LoginForm | ~900 | 密码 + OAuth + Passkey + Turnstile |
| RegisterForm | 805 | 注册 + 邮箱验证 + 邀请码 |
| OAuth2Callback | ~200 | OAuth 回调处理 |
| PasswordResetForm | ~150 | 密码重置请求 |
| PasswordResetConfirm | ~150 | 密码重置确认 |
| TwoFAVerification | 244 | 两步验证 |

---

## 三、后端 API 依赖

| API | 权限 | Landing 用途 |
|-----|------|--------------|
| `GET /api/home_page_content` | 公开 | 首页自定义内容 |
| `GET /api/notice` | 公开 | 公告弹窗 |
| `GET /api/about` | 公开 | 关于页面内容 |
| `GET /api/status` | 公开 | 品牌/功能开关/OAuth 配置 |
| `GET /api/pricing/` | 公开 | 模型定价列表 |
| `POST /api/user/login` | 公开 | 登录 |
| `POST /api/user/register` | 公开 | 注册 |
| `GET /api/oauth/*` | 公开 | OAuth 回调 |

---

## 四、视觉效果 CSS

| 效果 | CSS 类 | 说明 |
|------|--------|------|
| 流光标题 | `.shine-text` | `sweep-shine` 动画, 4s 循环 |
| 深色流光 | `.dark .shine-text` | 金色 (#facc15) 高光 |
| 模糊球 (靛) | `.blur-ball-indigo` | 360px, `filter: blur(120px)`, 50% 透明 |
| 模糊球 (青) | `.blur-ball-teal` | 360px, `filter: blur(120px)`, 40% 透明 |
| 浅色减弱 | `html:not(.dark) .blur-ball-*` | 透明度降至 20-25% |
| 马卡龙球 | `.with-pastel-balls` | 4 色渐变 (粉/紫/薄荷/桃) |

---

## 五、部署配置项

| 选项 | 说明 | 配置方式 |
|------|------|----------|
| `HomePageContent` | 自定义首页 (空=默认Landing) | 系统选项 |
| `About` | 关于页面 (Markdown/HTML/URL) | 系统选项 |
| `SystemName` | 首页品牌名 | 系统选项 |
| `Logo` | 导航栏 Logo | 系统选项 |
| `Footer` | 页脚 HTML | 系统选项 |
| `TopUpLink` | 充值链接 | 系统选项 |
| `general_setting.docs_link` | 文档按钮链接 | 系统选项 |
| `DemoSiteEnabled` | 演示模式 (显示 GitHub 按钮) | 系统选项 |
| `RegisterEnabled` | 注册开关 | 系统选项 |
| 各 OAuth 开关 | 登录页显示的 OAuth 按钮 | 系统选项 |

---

## 六、部署前检查

- [ ] `HomePageContent` 已配置 (或留空使用默认 Landing)
- [ ] `SystemName` / `Logo` 已设置
- [ ] 认证方式已配置 (密码/OAuth)
- [ ] 定价数据有内容 (渠道已添加模型)
- [ ] 如有公告: 通过管理后台发布
- [ ] 如有自定义关于页: `About` 已设置

---

## 七、部署后验证矩阵

| # | 验证项 | 方法 | 预期 | 通过 |
|---|--------|------|------|------|
| 1 | 首页加载 | 访问 / | Banner + 供应商图标 + CTA | [ ] |
| 2 | 流光标题 | 观察标题 | shine-text 动画播放 | [ ] |
| 3 | 模糊球背景 | 观察 Banner 背景 | 双色渐变模糊 | [ ] |
| 4 | 深色主题 | 切换 Dark | 模糊球/流光适配 | [ ] |
| 5 | Base URL 复制 | 点击复制按钮 | 服务地址复制到剪贴板 | [ ] |
| 6 | 端点轮播 | 观察 3 秒 | 自动切换 API 端点 | [ ] |
| 7 | CTA 按钮 | 点击"获取密钥" | 跳转 /console | [ ] |
| 8 | 供应商图标 | 20 个 + "30+" | 图标正常渲染 | [ ] |
| 9 | 移动端 | 窄屏访问 | 响应式布局 | [ ] |
| 10 | 定价页 | /pricing | 模型列表 + 筛选 + 双视图 | [ ] |
| 11 | 关于页 | /about | 内容渲染 | [ ] |
| 12 | 登录页 | /login | 登录表单 + OAuth 按钮 | [ ] |
| 13 | 注册页 | /register | 注册表单 (如开启) | [ ] |
| 14 | 公告弹窗 | 首次访问 | Modal 弹出 + Markdown 渲染 | [ ] |
| 15 | 自定义首页 | 设置 HomePageContent | 覆盖默认 Landing | [ ] |
| 16 | 国际化 | 切换 en/zh | 标题/按钮/描述切换 | [ ] |

---

## 八、回滚方案

前端嵌入 Go 二进制，回滚即回退镜像版本。

如需临时切回默认 Landing (清除自定义首页)：

```bash
curl -X PUT "$API_BASE/api/option/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"key":"HomePageContent","value":""}'
```

---

## 九、代码量统计

| 页面/模块 | 文件数 | 行数 |
|-----------|--------|------|
| Home 首页 | 1 | 356 |
| NoticeModal | 1 | 255 |
| Model Pricing | 27 + 2 hooks | 1,434 |
| About | 1 | 173 |
| Auth (Login/Register/OAuth/2FA) | 6 | 2,552 |
| 法律 (Agreement/Privacy) | 2 | ~100 |
| Landing CSS (.shine-text/.blur-ball) | - | ~130 |
| **合计** | **~40** | **~5,000** |

---

## 十、执行记录 (2026-04-11)

### 代码验证结果

| 维度 | 结果 |
|------|------|
| Home 首页 (356L) | ✅ Banner + 供应商 + CTA + 自定义内容 |
| 供应商图标 (20 个) | ✅ @lobehub/icons |
| API 端点轮播 (14 个) | ✅ ScrollList + 3s 自动循环 |
| 流光 CSS (.shine-text) | ✅ 浅色/深色双模式 |
| 模糊球 CSS (.blur-ball) | ✅ indigo + teal + 主题适配 |
| NoticeModal (255L) | ✅ 每日一次 + Markdown |
| Pricing (27 组件, 1,026L) | ✅ 筛选 + 卡片/表格双视图 + 详情侧滑 |
| About (173L) | ✅ Markdown/HTML/iframe |
| Auth (6 组件, 2,552L) | ✅ Login + Register + OAuth + 2FA + 密码重置 |
| 后端 API (8 端点) | ✅ home_page_content/notice/about/status/pricing/auth |
| 响应式 (4 级) | ✅ sm/md/lg/xl |
| i18n | ✅ 中英双语 |

---

*清单编制: ops-prjlite999 | 日期: 2026-04-11*
