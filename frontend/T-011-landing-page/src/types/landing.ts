/**
 * PRJ-LITE999-T-011 Landing Page — 类型定义
 */

// ============================================================
// 导航
// ============================================================

export interface NavLink {
  /** 显示文本（或品牌文案 key） */
  label: string;
  /** 链接地址（锚点 #xxx 或外部 URL） */
  href: string;
  /** 是否为外部链接 */
  external?: boolean;
}

// ============================================================
// Hero
// ============================================================

export interface HeroData {
  /** 大标题（支持品牌插值） */
  title: string;
  /** 副标题 */
  subtitle: string;
  /** 主 CTA */
  primaryCta: CtaConfig;
  /** 次 CTA */
  secondaryCta?: CtaConfig;
  /** 标签/徽章文案（如 "🚀 Now in Public Beta"） */
  badge?: string;
}

export interface CtaConfig {
  label: string;
  href: string;
  external?: boolean;
}

// ============================================================
// 功能亮点
// ============================================================

export interface FeatureItem {
  /** 图标（emoji 或图标类名） */
  icon: string;
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 可选跳转链接 */
  link?: string;
}

// ============================================================
// 使用流程
// ============================================================

export interface StepItem {
  /** 步骤编号（自动生成或手动） */
  step?: number;
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 图标或插图 */
  icon?: string;
}

// ============================================================
// 价格方案
// ============================================================

export type BillingCycle = 'monthly' | 'yearly';

export interface PricingTier {
  /** 方案 ID */
  id: string;
  /** 方案名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 月价格 (数字, 0 = 免费) */
  priceMonthly: number;
  /** 年价格 (数字, 通常有折扣) */
  priceYearly: number;
  /** 货币符号 */
  currency?: string;
  /** 功能列表 */
  features: PricingFeature[];
  /** 是否推荐/高亮 */
  highlighted?: boolean;
  /** CTA 按钮文案 */
  ctaLabel: string;
  /** CTA 链接 */
  ctaHref: string;
  /** 标签（如 "Most Popular"） */
  badge?: string;
  /** 是否自定义价格（Enterprise） */
  customPrice?: boolean;
  /** 自定义价格文案（如 "Contact Us"） */
  customPriceLabel?: string;
}

export interface PricingFeature {
  /** 功能描述 */
  text: string;
  /** 是否包含 */
  included: boolean;
  /** tooltip 补充说明 */
  tooltip?: string;
}

// ============================================================
// 用户评价
// ============================================================

export interface TestimonialItem {
  /** 用户头像 URL */
  avatar?: string;
  /** 用户姓名 */
  name: string;
  /** 职位/公司 */
  role: string;
  /** 评价内容 */
  quote: string;
  /** 评分 (1-5) */
  rating?: number;
}

// ============================================================
// FAQ
// ============================================================

export interface FaqItem {
  /** 问题 */
  question: string;
  /** 答案（支持 HTML 片段） */
  answer: string;
}

// ============================================================
// Footer
// ============================================================

export interface FooterLinkGroup {
  /** 组标题 */
  title: string;
  /** 链接列表 */
  links: NavLink[];
}

export interface SocialLink {
  /** 平台名 */
  platform: string;
  /** URL */
  href: string;
  /** 图标（emoji 或类名） */
  icon: string;
}

// ============================================================
// 完整页面数据
// ============================================================

export interface LandingPageData {
  nav: {
    links: NavLink[];
    cta: CtaConfig;
  };
  hero: HeroData;
  features: {
    heading: string;
    subheading?: string;
    items: FeatureItem[];
  };
  howItWorks: {
    heading: string;
    subheading?: string;
    steps: StepItem[];
  };
  pricing: {
    heading: string;
    subheading?: string;
    tiers: PricingTier[];
    yearlyDiscount?: string;
  };
  testimonials: {
    heading: string;
    subheading?: string;
    items: TestimonialItem[];
  };
  faq: {
    heading: string;
    subheading?: string;
    items: FaqItem[];
  };
  cta: {
    heading: string;
    subheading?: string;
    button: CtaConfig;
  };
  footer: {
    groups: FooterLinkGroup[];
    socials: SocialLink[];
  };
}
