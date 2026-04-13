<script setup lang="ts">
/**
 * LandingPage - 产品首页主组件
 *
 * 组装所有 section，管理全局状态
 * 集成 T-010 品牌系统（如果在 BrandProvider 内使用）
 */

import { computed, type PropType } from 'vue';
import type { LandingPageData } from './types/landing';
import { useLandingData } from './composables/use-landing-data';
import { useSmoothScroll } from './composables/use-smooth-scroll';

import NavbarSection from './sections/NavbarSection.vue';
import HeroSection from './sections/HeroSection.vue';
import FeaturesSection from './sections/FeaturesSection.vue';
import HowItWorksSection from './sections/HowItWorksSection.vue';
import PricingSection from './sections/PricingSection.vue';
import TestimonialsSection from './sections/TestimonialsSection.vue';
import FaqSection from './sections/FaqSection.vue';
import CtaSection from './sections/CtaSection.vue';
import FooterSection from './sections/FooterSection.vue';

const props = defineProps({
  /** 数据覆盖 */
  overrides: {
    type: Object as PropType<Partial<LandingPageData>>,
    default: undefined,
  },
  /** 品牌名（如果不在 BrandProvider 内，可直接传入） */
  brandName: {
    type: String,
    default: undefined,
  },
  /** 版权文案 */
  copyright: {
    type: String,
    default: undefined,
  },
});

// 数据管理
const { data, billingCycle, setBilling } = useLandingData(props.overrides);

// 平滑滚动
useSmoothScroll({ offset: 72 });

const effectiveBrandName = computed(() => props.brandName || data.value.hero.title.split(' ')[0]);
</script>

<template>
  <div class="landing-page">
    <!-- 导航栏 -->
    <NavbarSection
      :links="data.nav.links"
      :cta="data.nav.cta"
      :brand-name="effectiveBrandName"
    />

    <!-- 主视觉 -->
    <HeroSection :data="data.hero">
      <template #trust>
        <slot name="hero-trust" />
      </template>
    </HeroSection>

    <!-- 功能亮点 -->
    <FeaturesSection
      :heading="data.features.heading"
      :subheading="data.features.subheading"
      :items="data.features.items"
    />

    <!-- 使用流程 -->
    <HowItWorksSection
      :heading="data.howItWorks.heading"
      :subheading="data.howItWorks.subheading"
      :steps="data.howItWorks.steps"
    />

    <!-- 价格方案 -->
    <PricingSection
      :heading="data.pricing.heading"
      :subheading="data.pricing.subheading"
      :tiers="data.pricing.tiers"
      :yearly-discount="data.pricing.yearlyDiscount"
      :billing-cycle="billingCycle"
      @update:billing-cycle="setBilling"
    />

    <!-- 用户评价 -->
    <TestimonialsSection
      :heading="data.testimonials.heading"
      :subheading="data.testimonials.subheading"
      :items="data.testimonials.items"
    />

    <!-- FAQ -->
    <FaqSection
      :heading="data.faq.heading"
      :subheading="data.faq.subheading"
      :items="data.faq.items"
    />

    <!-- 行动号召 -->
    <CtaSection
      :heading="data.cta.heading"
      :subheading="data.cta.subheading"
      :button="data.cta.button"
    />

    <!-- 页脚 -->
    <FooterSection
      :groups="data.footer.groups"
      :socials="data.footer.socials"
      :brand-name="effectiveBrandName"
      :copyright="copyright"
    />
  </div>
</template>

<style>
/* 全局滚动动画（需在 App 级别引入） */
[data-animate] {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
[data-animate].animate-in {
  opacity: 1;
  transform: translateY(0);
}
</style>

<style scoped>
.landing-page {
  min-height: 100vh;
  background: var(--brand-bg, #ffffff);
  color: var(--brand-text-primary, #111827);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
