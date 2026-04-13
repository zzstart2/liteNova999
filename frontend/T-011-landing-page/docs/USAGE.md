# Landing Page — 使用文档

## 快速开始

### 1. 直接使用完整页面

```vue
<script setup>
import LandingPage from './LandingPage.vue';
</script>

<template>
  <LandingPage />
</template>
```

默认内容来自 `config/landing.default.ts`，无需额外配置即可渲染完整 Landing Page。

### 2. 与品牌系统集成 (T-010)

```vue
<script setup>
import { BrandProvider } from '@lite999/brand';
import LandingPage from './LandingPage.vue';
import brandConfig from './brand-config.json';
</script>

<template>
  <BrandProvider :config="brandConfig" theme="auto">
    <LandingPage :brand-name="brandConfig.text.brandName" />
  </BrandProvider>
</template>
```

Landing Page 的所有颜色通过 CSS 变量 (`--brand-*`) 继承品牌系统，
替换品牌 JSON 即可实现整站换肤。

### 3. 自定义内容

```vue
<script setup>
import LandingPage from './LandingPage.vue';

const overrides = {
  hero: {
    title: 'Your Custom Title',
    subtitle: 'Your custom subtitle here.',
  },
  features: {
    heading: 'Why Choose Us',
    items: [
      { icon: '🔥', title: 'Fast', description: 'Blazing fast performance.' },
      { icon: '🔒', title: 'Secure', description: 'Enterprise-grade security.' },
    ],
  },
  pricing: {
    tiers: [
      // your custom pricing tiers...
    ],
  },
};
</script>

<template>
  <LandingPage :overrides="overrides" />
</template>
```

只需传入差异部分，其余自动使用默认内容。

## 单独使用 Section 组件

每个 section 都可以独立使用：

```vue
<script setup>
import PricingSection from './sections/PricingSection.vue';
import { useLandingData } from './composables/use-landing-data';
import { DEFAULT_LANDING_DATA } from '../config/landing.default';

const { billingCycle, setBilling } = useLandingData();
</script>

<template>
  <PricingSection
    heading="Our Plans"
    :tiers="DEFAULT_LANDING_DATA.pricing.tiers"
    :billing-cycle="billingCycle"
    @update:billing-cycle="setBilling"
  />
</template>
```

## 滚动动画

### 自动（在 LandingPage 内）

LandingPage.vue 已注入全局滚动动画 CSS。给任何元素添加 `data-animate` 属性即可：

```html
<div data-animate>This will fade up on scroll</div>
<div data-animate="fade">Fade only (no translate)</div>
<div data-animate="scale">Scale up on scroll</div>
```

### 手动（单独使用）

```vue
<script setup>
import { ref } from 'vue';
import { useScrollAnimation } from './composables/use-scroll-animation';

const container = ref();
useScrollAnimation(container, {
  childSelector: '.card',
  staggerDelay: 100,
});
</script>

<template>
  <div ref="container">
    <div class="card" data-animate>Card 1</div>
    <div class="card" data-animate>Card 2</div>
    <div class="card" data-animate>Card 3</div>
  </div>
</template>
```

## 价格计算

```ts
import { getDisplayPrice, getYearlyDiscount, formatPrice } from './composables/use-landing-data';

// 月付显示价格
getDisplayPrice(proTier, 'monthly'); // 49

// 年付按月显示
getDisplayPrice(proTier, 'yearly'); // 39.17

// 年付折扣
getYearlyDiscount(proTier); // 20 (%)

// 格式化
formatPrice(0);     // 'Free'
formatPrice(49);    // '$49'
formatPrice(39.17); // '$39.17'
```

## 白标定制清单

替换品牌 JSON 后，以下元素自动更新：

| 元素 | 来源 |
|------|------|
| 导航栏 Logo 文字 | `brandName` prop 或品牌系统 |
| 所有按钮/链接/卡片颜色 | CSS 变量 `--brand-primary` 等 |
| 背景/表面/文字色 | CSS 变量 `--brand-bg` / `--brand-surface` 等 |
| 圆角 | CSS 变量 `--brand-radius` |
| 页脚版权 | `copyright` prop 或品牌文案 |

需要修改内容（文案/功能/价格）时，修改 `config/landing.default.ts` 或通过 `overrides` prop 覆盖。

## 组件清单

### 页面
| 组件 | 用途 |
|------|------|
| `LandingPage.vue` | 完整页面（组装所有 sections） |

### Sections (9 个)
| 组件 | 用途 |
|------|------|
| `NavbarSection` | 粘性导航栏 + 移动端汉堡菜单 |
| `HeroSection` | 主视觉区 + CTA |
| `FeaturesSection` | 功能亮点网格 |
| `HowItWorksSection` | 分步使用流程 |
| `PricingSection` | 价格方案 + 月/年切换 |
| `TestimonialsSection` | 用户评价横向滚动 |
| `FaqSection` | FAQ 手风琴 |
| `CtaSection` | 行动号召（品牌色背景） |
| `FooterSection` | 页脚（链接列 + 社交 + 版权） |

### Base Components (6 个)
| 组件 | 用途 |
|------|------|
| `CtaButton` | CTA 按钮（4 种风格 × 3 种尺寸） |
| `FeatureCard` | 功能亮点卡片 |
| `PricingCard` | 价格方案卡片 |
| `FaqItem` | FAQ 折叠项 |
| `TestimonialCard` | 用户评价卡片 |
| `SectionHeading` | 区块标题 |

### Composables (3 个)
| Hook | 用途 |
|------|------|
| `useLandingData()` | 数据管理 + 价格计算 |
| `useScrollAnimation()` | IntersectionObserver 滚动动画 |
| `useSmoothScroll()` | 锚点平滑滚动 |

## 响应式断点

| 断点 | 行为 |
|------|------|
| ≤ 480px | 单列布局，Hero CTA 堆叠 |
| ≤ 640px | 功能/价格单列，缩小间距 |
| ≤ 768px | 导航栏切换汉堡菜单，Footer 两列 |
| ≥ 1024px | 功能 4 列网格 |
