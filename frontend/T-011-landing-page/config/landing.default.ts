/**
 * Landing Page 默认内容配置
 *
 * 所有文案集中管理，白标替换只需修改此文件（或通过品牌系统覆盖）
 */

import type { LandingPageData } from '../src/types/landing';

export const DEFAULT_LANDING_DATA: LandingPageData = {
  // ────────────────────────────────────────
  // 导航
  // ────────────────────────────────────────
  nav: {
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
      { label: 'Docs', href: '/docs', external: true },
    ],
    cta: { label: 'Get Started', href: '/register' },
  },

  // ────────────────────────────────────────
  // Hero
  // ────────────────────────────────────────
  hero: {
    badge: '🚀 Now in Public Beta',
    title: 'Unified API Gateway for Every LLM',
    subtitle:
      'One endpoint, all models. Route requests across OpenAI, Anthropic, Google, and 50+ providers with built-in cost tracking, rate limiting, and failover.',
    primaryCta: { label: 'Start Free', href: '/register' },
    secondaryCta: { label: 'View Docs', href: '/docs', external: true },
  },

  // ────────────────────────────────────────
  // 功能亮点
  // ────────────────────────────────────────
  features: {
    heading: 'Everything You Need',
    subheading: 'A complete platform for managing LLM usage at scale',
    items: [
      {
        icon: '🔀',
        title: 'Universal Router',
        description:
          'Single API endpoint that routes to 50+ LLM providers. Compatible with OpenAI SDK — zero code changes.',
      },
      {
        icon: '💰',
        title: 'Cost Intelligence',
        description:
          'Real-time cost tracking per model, per key, per project. Set budgets, get alerts, never overspend.',
      },
      {
        icon: '⚡',
        title: 'Smart Failover',
        description:
          'Automatic fallback across providers. If one is down, your requests seamlessly route to the next.',
      },
      {
        icon: '🔑',
        title: 'API Key Management',
        description:
          'Virtual keys with per-key rate limits, budgets, and model access controls. Audit every request.',
      },
      {
        icon: '📊',
        title: 'Usage Analytics',
        description:
          'Rich dashboards with token usage, latency, success rate, and model comparison — all in real time.',
      },
      {
        icon: '🛡️',
        title: 'Enterprise Security',
        description:
          'SOC 2 compliant. Data never stored. End-to-end encryption. SSO, RBAC, and audit logs.',
      },
      {
        icon: '🌍',
        title: 'Global Edge',
        description:
          'Deployed across 30+ regions. Sub-50ms overhead. Your requests take the fastest path.',
      },
      {
        icon: '🔌',
        title: 'Extensible Plugins',
        description:
          'Content moderation, PII redaction, prompt caching, semantic dedup — add capabilities without code.',
      },
    ],
  },

  // ────────────────────────────────────────
  // 使用流程
  // ────────────────────────────────────────
  howItWorks: {
    heading: 'Up and Running in 3 Minutes',
    subheading: 'No infrastructure to manage. No SDKs to learn.',
    steps: [
      {
        title: 'Create an Account',
        description: 'Sign up for free. No credit card required. Get your API key instantly.',
        icon: '📝',
      },
      {
        title: 'Add Your Providers',
        description: 'Bring your own API keys for OpenAI, Anthropic, etc. We never see your data.',
        icon: '🔗',
      },
      {
        title: 'Send Requests',
        description: 'Point your OpenAI SDK to our endpoint. That\'s it — everything just works.',
        icon: '🚀',
      },
    ],
  },

  // ────────────────────────────────────────
  // 价格方案
  // ────────────────────────────────────────
  pricing: {
    heading: 'Simple, Transparent Pricing',
    subheading: 'Start free. Scale as you grow. No hidden fees.',
    yearlyDiscount: 'Save 20%',
    tiers: [
      {
        id: 'free',
        name: 'Free',
        description: 'Perfect for side projects and experimentation',
        priceMonthly: 0,
        priceYearly: 0,
        currency: '$',
        ctaLabel: 'Get Started',
        ctaHref: '/register?plan=free',
        features: [
          { text: '1,000 requests/day', included: true },
          { text: '3 API keys', included: true },
          { text: '5 models', included: true },
          { text: 'Basic analytics', included: true },
          { text: 'Community support', included: true },
          { text: 'Custom routing rules', included: false },
          { text: 'Team collaboration', included: false },
          { text: 'SSO / RBAC', included: false },
        ],
      },
      {
        id: 'pro',
        name: 'Pro',
        description: 'For teams shipping AI products',
        priceMonthly: 49,
        priceYearly: 470,
        currency: '$',
        highlighted: true,
        badge: 'Most Popular',
        ctaLabel: 'Start Free Trial',
        ctaHref: '/register?plan=pro',
        features: [
          { text: 'Unlimited requests', included: true },
          { text: '50 API keys', included: true },
          { text: 'All models', included: true },
          { text: 'Advanced analytics', included: true },
          { text: 'Priority support', included: true },
          { text: 'Custom routing rules', included: true },
          { text: 'Team collaboration (5 seats)', included: true },
          { text: 'SSO / RBAC', included: false },
        ],
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'For organizations with advanced needs',
        priceMonthly: 0,
        priceYearly: 0,
        currency: '$',
        customPrice: true,
        customPriceLabel: 'Contact Us',
        ctaLabel: 'Talk to Sales',
        ctaHref: '/contact-sales',
        features: [
          { text: 'Unlimited everything', included: true },
          { text: 'Unlimited API keys', included: true },
          { text: 'All models + custom', included: true },
          { text: 'Full analytics + export', included: true },
          { text: 'Dedicated support + SLA', included: true },
          { text: 'Custom routing rules', included: true },
          { text: 'Unlimited team seats', included: true },
          { text: 'SSO / RBAC / Audit', included: true },
        ],
      },
    ],
  },

  // ────────────────────────────────────────
  // 用户评价
  // ────────────────────────────────────────
  testimonials: {
    heading: 'Loved by Developers',
    subheading: 'Join thousands of teams building with Lite999',
    items: [
      {
        name: 'Sarah Chen',
        role: 'CTO at Nexus AI',
        quote:
          'Lite999 saved us months of gateway infrastructure work. We switched from our custom proxy and cut costs by 30%.',
        rating: 5,
      },
      {
        name: 'Marcus Rodriguez',
        role: 'Lead Engineer at Dataflow',
        quote:
          'The failover alone is worth it. We had zero downtime during the last OpenAI outage — requests just routed to Claude.',
        rating: 5,
      },
      {
        name: 'Emily Tanaka',
        role: 'Founder at PromptLab',
        quote:
          'Finally, proper cost tracking. I can see exactly which features burn tokens and optimize accordingly.',
        rating: 5,
      },
      {
        name: 'David Kim',
        role: 'VP Engineering at ScaleUp',
        quote:
          'Enterprise-grade controls without enterprise-grade complexity. RBAC setup took 10 minutes.',
        rating: 5,
      },
    ],
  },

  // ────────────────────────────────────────
  // FAQ
  // ────────────────────────────────────────
  faq: {
    heading: 'Frequently Asked Questions',
    items: [
      {
        question: 'Do you store my prompts or completions?',
        answer:
          'No. We process requests in real time and never persist your prompt data. Logs only contain metadata (timestamps, token counts, latency) — never content.',
      },
      {
        question: 'Is it compatible with the OpenAI SDK?',
        answer:
          'Yes! Just change the base URL. Our API is fully compatible with the OpenAI chat completions format, so any SDK that supports OpenAI works out of the box.',
      },
      {
        question: 'How does failover work?',
        answer:
          'You configure priority-ordered providers. If a request fails (timeout, rate limit, server error), we automatically retry with the next provider. Your application never sees the failure.',
      },
      {
        question: 'What happens if I exceed the free tier?',
        answer:
          'Requests beyond your daily limit receive a 429 response. You can upgrade anytime — no data loss, no disruption. Pro plans have no request limits.',
      },
      {
        question: 'Can I use my own API keys?',
        answer:
          'Absolutely. Bring your own keys for OpenAI, Anthropic, Google, Azure, and 50+ other providers. We never access your keys outside of forwarding requests.',
      },
      {
        question: 'Do you offer an SLA?',
        answer:
          'Enterprise plans include a 99.99% uptime SLA with financial credits. Pro plans target 99.9% uptime. Free tier is best-effort.',
      },
    ],
  },

  // ────────────────────────────────────────
  // CTA
  // ────────────────────────────────────────
  cta: {
    heading: 'Ready to Simplify Your LLM Stack?',
    subheading: 'Start free today. No credit card required.',
    button: { label: 'Create Free Account', href: '/register' },
  },

  // ────────────────────────────────────────
  // Footer
  // ────────────────────────────────────────
  footer: {
    groups: [
      {
        title: 'Product',
        links: [
          { label: 'Features', href: '#features' },
          { label: 'Pricing', href: '#pricing' },
          { label: 'Changelog', href: '/changelog' },
          { label: 'Roadmap', href: '/roadmap' },
        ],
      },
      {
        title: 'Resources',
        links: [
          { label: 'Documentation', href: '/docs', external: true },
          { label: 'API Reference', href: '/docs/api', external: true },
          { label: 'Status', href: '/status', external: true },
          { label: 'Blog', href: '/blog' },
        ],
      },
      {
        title: 'Company',
        links: [
          { label: 'About', href: '/about' },
          { label: 'Contact', href: '/contact' },
          { label: 'Privacy', href: '/privacy' },
          { label: 'Terms', href: '/terms' },
        ],
      },
    ],
    socials: [
      { platform: 'GitHub', href: 'https://github.com', icon: '🐙' },
      { platform: 'Twitter', href: 'https://twitter.com', icon: '🐦' },
      { platform: 'Discord', href: 'https://discord.com', icon: '💬' },
    ],
  },
};
