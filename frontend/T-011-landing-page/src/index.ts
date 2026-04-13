/**
 * Landing Page 组件库 — 统一导出
 *
 * @module @lite999/landing-page
 */

// Types
export type {
  NavLink,
  HeroData,
  CtaConfig,
  FeatureItem,
  StepItem,
  BillingCycle,
  PricingTier,
  PricingFeature,
  TestimonialItem,
  FaqItem,
  FooterLinkGroup,
  SocialLink,
  LandingPageData,
} from './types/landing';

// Composables
export { useLandingData, getDisplayPrice, getYearlyDiscount, formatPrice } from './composables/use-landing-data';
export type { UseLandingDataReturn } from './composables/use-landing-data';
export { useScrollAnimation, SCROLL_ANIMATION_CSS } from './composables/use-scroll-animation';
export { useSmoothScroll, scrollToAnchor } from './composables/use-smooth-scroll';

// Config
export { DEFAULT_LANDING_DATA } from '../config/landing.default';

// Page Component — import directly:
// import LandingPage from '@lite999/landing-page/LandingPage.vue'

// Section Components — import individually:
// import NavbarSection from '@lite999/landing-page/sections/NavbarSection.vue'
// import HeroSection from '@lite999/landing-page/sections/HeroSection.vue'
// import FeaturesSection from '@lite999/landing-page/sections/FeaturesSection.vue'
// import HowItWorksSection from '@lite999/landing-page/sections/HowItWorksSection.vue'
// import PricingSection from '@lite999/landing-page/sections/PricingSection.vue'
// import TestimonialsSection from '@lite999/landing-page/sections/TestimonialsSection.vue'
// import FaqSection from '@lite999/landing-page/sections/FaqSection.vue'
// import CtaSection from '@lite999/landing-page/sections/CtaSection.vue'
// import FooterSection from '@lite999/landing-page/sections/FooterSection.vue'

// Base Components — import individually:
// import PricingCard from '@lite999/landing-page/components/PricingCard.vue'
// import FeatureCard from '@lite999/landing-page/components/FeatureCard.vue'
// import FaqItem from '@lite999/landing-page/components/FaqItem.vue'
// import TestimonialCard from '@lite999/landing-page/components/TestimonialCard.vue'
// import SectionHeading from '@lite999/landing-page/components/SectionHeading.vue'
// import CtaButton from '@lite999/landing-page/components/CtaButton.vue'
