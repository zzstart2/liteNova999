# PRJ-LITE999-T-011 Landing Page 开发 — 工作计划

## 任务概述

开发产品 Landing Page（首页），包含功能介绍、价格展示、注册引导，
全面集成 T-010 品牌定制化系统，实现白标 Landing Page 能力。

## 依赖关系

| 依赖 | 集成方式 |
|------|----------|
| **T-010** (品牌系统) | `useBrand()` / `useBrandText()` / CSS 变量 / `<BrandLogo>` |

## 页面结构

```
┌─────────────────────────────────────────────┐
│  Navbar（导航栏 · 粘性置顶）                  │
│  Logo + Nav Links + CTA + Theme Toggle       │
├─────────────────────────────────────────────┤
│  Hero Section（主视觉区）                     │
│  大标题 + 副标题 + CTA 双按钮 + 背景装饰      │
├─────────────────────────────────────────────┤
│  Features Section（功能亮点）                 │
│  图标 + 标题 + 描述 · 三列/四列网格           │
├─────────────────────────────────────────────┤
│  How It Works（使用流程）                     │
│  分步骤引导 · 编号 + 图示 + 说明              │
├─────────────────────────────────────────────┤
│  Pricing Section（价格方案）                  │
│  月付/年付切换 · 方案卡片 · 推荐标记 · CTA    │
├─────────────────────────────────────────────┤
│  Testimonials（用户评价）                     │
│  头像 + 引言 + 姓名/公司 · 横向滚动           │
├─────────────────────────────────────────────┤
│  FAQ（常见问题）                              │
│  手风琴折叠 · 问答对                          │
├─────────────────────────────────────────────┤
│  CTA Section（行动号召）                      │
│  醒目背景 + 大标题 + 注册按钮                 │
├─────────────────────────────────────────────┤
│  Footer（页脚）                               │
│  Logo + 链接列 + 版权 + 社交图标              │
└─────────────────────────────────────────────┘
```

## 设计原则

- **品牌驱动**: 所有色彩、文案、Logo 通过品牌系统注入，零硬编码
- **响应式**: Mobile-first，断点 640 / 768 / 1024 / 1280px
- **性能**: 纯 CSS 动画，无运行时动画库；图片懒加载
- **可访问性**: 语义 HTML、ARIA 标签、键盘导航、对比度达标
- **白标就绪**: 替换品牌配置 JSON 即可换肤

## 产出文件清单

### 类型 & 配置
- `src/types/landing.ts` — 页面数据类型（功能、价格、FAQ 等）
- `config/landing.default.ts` — 默认页面内容配置
- `config/landing.texts.ts` — 品牌文案扩展（注入品牌系统）

### 组合式函数
- `src/composables/use-landing-data.ts` — 页面数据管理
- `src/composables/use-scroll-animation.ts` — 滚动动画（IntersectionObserver）
- `src/composables/use-smooth-scroll.ts` — 平滑滚动到锚点

### 区块组件 (Sections)
- `src/sections/NavbarSection.vue` — 导航栏
- `src/sections/HeroSection.vue` — 主视觉
- `src/sections/FeaturesSection.vue` — 功能亮点
- `src/sections/HowItWorksSection.vue` — 使用流程
- `src/sections/PricingSection.vue` — 价格方案
- `src/sections/TestimonialsSection.vue` — 用户评价
- `src/sections/FaqSection.vue` — 常见问题
- `src/sections/CtaSection.vue` — 行动号召
- `src/sections/FooterSection.vue` — 页脚

### 基础组件
- `src/components/PricingCard.vue` — 价格卡片
- `src/components/FeatureCard.vue` — 功能卡片
- `src/components/FaqItem.vue` — FAQ 折叠项
- `src/components/TestimonialCard.vue` — 评价卡片
- `src/components/SectionHeading.vue` — 区块标题（统一样式）
- `src/components/CtaButton.vue` — CTA 按钮

### 页面入口
- `src/LandingPage.vue` — 页面主组件（组装所有 sections）

### 文档 & 测试
- `docs/USAGE.md` — 使用文档
- `tests/landing-data.test.ts` — 数据层测试
- `tests/pricing.test.ts` — 价格计算测试

## 技术选型

- **Vue 3** `<script setup>` + Composition API
- **TypeScript** 严格模式
- **CSS Custom Properties** 全面使用品牌 CSS 变量
- **IntersectionObserver** 滚动入场动画
- **零 JS 动画依赖** 纯 CSS transition/animation
