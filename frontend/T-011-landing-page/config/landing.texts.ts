/**
 * 品牌文案扩展 — 注入品牌系统的 Landing Page 文案
 *
 * 使用方式：
 *   import { LANDING_TEXTS } from '../config/landing.texts';
 *   import { useBrandText } from '@/brand/hooks/use-brand-text';
 *   const { t } = useBrandText();
 *   // 品牌系统会合并这些文案，页面内通过 t('landing.hero.title') 读取
 *
 * 支持 {{brandName}} 等模板变量，由品牌引擎 TextResolver 自动插值。
 */

export const LANDING_TEXTS = {
  landing: {
    // ---- Navbar ----
    nav: {
      features: '功能',
      pricing: '价格',
      docs: '文档',
      login: '登录',
      getStarted: '免费开始',
    },

    // ---- Hero ----
    hero: {
      badge: '🚀 现已公测',
      title: '一个 API，所有模型',
      subtitle:
        '{{brandName}} 提供统一的 OpenAI 兼容接口，聚合主流大模型。' +
        '一次对接，随时切换，成本透明。',
      primaryCta: '免费注册',
      secondaryCta: '查看文档',
    },

    // ---- Features ----
    features: {
      heading: '为什么选择 {{brandName}}',
      subheading: '我们为开发者和团队提供最简单的大模型接入方案',
      unifiedApi: {
        title: '统一 API 接口',
        description: 'OpenAI 兼容格式，对接一次即可调用所有主流模型。',
      },
      smartRouting: {
        title: '智能路由',
        description: '按延迟、价格、能力自动选择最优模型，无需手动切换。',
      },
      costControl: {
        title: '成本透明',
        description: '实时用量仪表盘，按模型/按 Key 维度的费用明细。',
      },
      highAvailability: {
        title: '高可用',
        description: '多 Provider 故障转移，99.9% SLA 保障。',
      },
      streamingSupport: {
        title: '流式响应',
        description: '原生 SSE 流式支持，逐 Token 返回，体验丝滑。',
      },
      teamManagement: {
        title: '团队管理',
        description: '多 API Key、用量配额、权限隔离，企业级管控。',
      },
    },

    // ---- How It Works ----
    howItWorks: {
      heading: '三步开始',
      subheading: '从注册到上线，只需几分钟',
      step1: {
        title: '注册账号',
        description: '填写邮箱即可创建免费账号，无需信用卡。',
      },
      step2: {
        title: '获取 API Key',
        description: '在控制台创建 API Key，复制到你的项目中。',
      },
      step3: {
        title: '开始调用',
        description: '用 OpenAI SDK 直接调用，只需修改 base_url。',
      },
    },

    // ---- Pricing ----
    pricing: {
      heading: '简单透明的价格',
      subheading: '按量付费，用多少算多少',
      yearlyDiscount: '年付省 20%',
      free: {
        name: '免费版',
        description: '个人探索，无需信用卡',
        cta: '免费开始',
      },
      pro: {
        name: '专业版',
        description: '适合个人开发者和小团队',
        cta: '升级专业版',
        badge: '最受欢迎',
      },
      team: {
        name: '团队版',
        description: '适合成长期团队',
        cta: '选择团队版',
      },
      enterprise: {
        name: '企业版',
        description: '定制方案，专属支持',
        cta: '联系我们',
        customPriceLabel: '联系销售',
      },
    },

    // ---- Testimonials ----
    testimonials: {
      heading: '用户怎么说',
      subheading: '来自真实开发者的反馈',
    },

    // ---- FAQ ----
    faq: {
      heading: '常见问题',
      subheading: '还有疑问？直接联系我们',
      q1: {
        question: '{{brandName}} 和直接用 OpenAI 有什么区别？',
        answer:
          '{{brandName}} 聚合了多家模型提供商，一个 API 即可调用 GPT-4o、Claude、Gemini 等。' +
          '你获得统一的接口、智能路由、成本监控和高可用保障。',
      },
      q2: {
        question: '支持哪些模型？',
        answer:
          '目前支持 OpenAI (GPT-4o, GPT-4o-mini)、Anthropic (Claude 3.5 Sonnet)、' +
          'Google (Gemini 1.5 Pro)、DeepSeek 等。持续扩展中。',
      },
      q3: {
        question: '价格怎么算？',
        answer:
          '按实际 Token 用量计费，价格与原始模型提供商相当。免费版每月赠送一定额度。',
      },
      q4: {
        question: '数据安全吗？',
        answer:
          '请求透传至模型提供商，{{brandName}} 不存储对话内容。支持 TLS 加密和 VPC 部署。',
      },
      q5: {
        question: '能用 OpenAI SDK 直接调用吗？',
        answer:
          '完全兼容。只需把 base_url 改为 {{brandName}} 的地址，其他代码不用改。',
      },
    },

    // ---- CTA ----
    cta: {
      heading: '准备好了吗？',
      subheading: '免费注册，几分钟内开始调用所有主流大模型。',
      button: '免费开始 →',
    },

    // ---- Footer ----
    footer: {
      copyright: '© {{year}} {{brandName}}. All rights reserved.',
      productGroup: '产品',
      resourceGroup: '资源',
      companyGroup: '公司',
    },
  },
};