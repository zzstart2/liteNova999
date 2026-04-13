/**
 * useLandingData - 页面数据管理
 *
 * 合并默认配置与外部覆盖，提供响应式的页面数据访问
 * 价格方案按计费周期计算实际展示价格
 */

import { ref, computed, type Ref } from 'vue';
import type {
  LandingPageData,
  BillingCycle,
  PricingTier,
} from '../types/landing';
import { DEFAULT_LANDING_DATA } from '../../config/landing.default';

// ============================================================
// 深度合并工具（与 T-010 brand config-loader 同逻辑）
// ============================================================

function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T> | undefined
): T {
  if (!source) return { ...target };
  const result = { ...target } as Record<string, unknown>;

  for (const key of Object.keys(source)) {
    const sv = (source as Record<string, unknown>)[key];
    const tv = result[key];
    if (sv === undefined) continue;
    if (
      sv !== null && typeof sv === 'object' && !Array.isArray(sv) &&
      tv !== null && typeof tv === 'object' && !Array.isArray(tv)
    ) {
      result[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      result[key] = sv;
    }
  }
  return result as T;
}

// ============================================================
// 价格计算
// ============================================================

/**
 * 获取指定计费周期下的展示价格
 */
export function getDisplayPrice(tier: PricingTier, cycle: BillingCycle): number {
  if (tier.customPrice) return 0;
  if (cycle === 'yearly') {
    // 年付按月展示 = 年价 / 12
    return tier.priceYearly > 0
      ? Math.round((tier.priceYearly / 12) * 100) / 100
      : 0;
  }
  return tier.priceMonthly;
}

/**
 * 计算年付折扣百分比
 */
export function getYearlyDiscount(tier: PricingTier): number {
  if (tier.priceMonthly === 0 || tier.customPrice) return 0;
  const monthlyTotal = tier.priceMonthly * 12;
  if (monthlyTotal === 0) return 0;
  return Math.round(((monthlyTotal - tier.priceYearly) / monthlyTotal) * 100);
}

/**
 * 格式化价格显示
 */
export function formatPrice(amount: number, currency = '$'): string {
  if (amount === 0) return 'Free';
  // 整数不显示小数
  if (amount % 1 === 0) return `${currency}${amount}`;
  return `${currency}${amount.toFixed(2)}`;
}

// ============================================================
// Hook
// ============================================================

export interface UseLandingDataReturn {
  /** 完整页面数据 */
  data: Ref<LandingPageData>;
  /** 当前计费周期 */
  billingCycle: Ref<BillingCycle>;
  /** 切换计费周期 */
  toggleBilling: () => void;
  /** 设置计费周期 */
  setBilling: (cycle: BillingCycle) => void;
  /** 获取展示价格 */
  getDisplayPrice: (tier: PricingTier) => number;
  /** 格式化价格 */
  formatPrice: (amount: number, currency?: string) => string;
  /** 获取折扣 */
  getYearlyDiscount: (tier: PricingTier) => number;
  /** 更新数据（运行时覆盖） */
  updateData: (overrides: Partial<LandingPageData>) => void;
}

export function useLandingData(
  overrides?: Partial<LandingPageData>
): UseLandingDataReturn {
  const data = ref<LandingPageData>(
    deepMerge(DEFAULT_LANDING_DATA, overrides as any)
  );

  const billingCycle = ref<BillingCycle>('monthly');

  function toggleBilling() {
    billingCycle.value = billingCycle.value === 'monthly' ? 'yearly' : 'monthly';
  }

  function setBilling(cycle: BillingCycle) {
    billingCycle.value = cycle;
  }

  function _getDisplayPrice(tier: PricingTier): number {
    return getDisplayPrice(tier, billingCycle.value);
  }

  function updateData(overrides: Partial<LandingPageData>) {
    data.value = deepMerge(data.value, overrides as any);
  }

  return {
    data,
    billingCycle,
    toggleBilling,
    setBilling,
    getDisplayPrice: _getDisplayPrice,
    formatPrice,
    getYearlyDiscount,
    updateData,
  };
}
