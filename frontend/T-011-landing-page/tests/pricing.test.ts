/**
 * 价格计算测试
 */

import { describe, it, expect } from 'vitest';
import {
  getDisplayPrice,
  getYearlyDiscount,
  formatPrice,
} from '../src/composables/use-landing-data';
import type { PricingTier } from '../src/types/landing';

// ============================================================
// 测试数据
// ============================================================

const freeTier: PricingTier = {
  id: 'free',
  name: 'Free',
  description: 'Free plan',
  priceMonthly: 0,
  priceYearly: 0,
  currency: '$',
  features: [],
  ctaLabel: 'Get Started',
  ctaHref: '/register',
};

const proTier: PricingTier = {
  id: 'pro',
  name: 'Pro',
  description: 'Pro plan',
  priceMonthly: 49,
  priceYearly: 470,
  currency: '$',
  highlighted: true,
  features: [],
  ctaLabel: 'Start Trial',
  ctaHref: '/register?plan=pro',
};

const enterpriseTier: PricingTier = {
  id: 'enterprise',
  name: 'Enterprise',
  description: 'Enterprise plan',
  priceMonthly: 0,
  priceYearly: 0,
  currency: '$',
  customPrice: true,
  customPriceLabel: 'Contact Us',
  features: [],
  ctaLabel: 'Talk to Sales',
  ctaHref: '/contact',
};

// ============================================================
// getDisplayPrice
// ============================================================

describe('getDisplayPrice', () => {
  it('should return 0 for free tier (monthly)', () => {
    expect(getDisplayPrice(freeTier, 'monthly')).toBe(0);
  });

  it('should return 0 for free tier (yearly)', () => {
    expect(getDisplayPrice(freeTier, 'yearly')).toBe(0);
  });

  it('should return monthly price for monthly billing', () => {
    expect(getDisplayPrice(proTier, 'monthly')).toBe(49);
  });

  it('should return yearly/12 for yearly billing', () => {
    const yearlyPerMonth = getDisplayPrice(proTier, 'yearly');
    expect(yearlyPerMonth).toBeCloseTo(39.17, 2);
  });

  it('should return 0 for custom price tier', () => {
    expect(getDisplayPrice(enterpriseTier, 'monthly')).toBe(0);
    expect(getDisplayPrice(enterpriseTier, 'yearly')).toBe(0);
  });
});

// ============================================================
// getYearlyDiscount
// ============================================================

describe('getYearlyDiscount', () => {
  it('should return 0 for free tier', () => {
    expect(getYearlyDiscount(freeTier)).toBe(0);
  });

  it('should calculate discount percentage for pro tier', () => {
    const discount = getYearlyDiscount(proTier);
    // 49*12 = 588, 588-470 = 118, 118/588 ≈ 20%
    expect(discount).toBe(20);
  });

  it('should return 0 for custom price tier', () => {
    expect(getYearlyDiscount(enterpriseTier)).toBe(0);
  });
});

// ============================================================
// formatPrice
// ============================================================

describe('formatPrice', () => {
  it('should return "Free" for 0', () => {
    expect(formatPrice(0)).toBe('Free');
  });

  it('should format integer without decimals', () => {
    expect(formatPrice(49)).toBe('$49');
  });

  it('should format decimal with 2 places', () => {
    expect(formatPrice(39.17)).toBe('$39.17');
  });

  it('should use custom currency', () => {
    expect(formatPrice(99, '¥')).toBe('¥99');
  });

  it('should handle large numbers', () => {
    expect(formatPrice(1299)).toBe('$1299');
  });
});
