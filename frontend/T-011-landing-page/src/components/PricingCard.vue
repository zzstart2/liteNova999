<script setup lang="ts">
/**
 * PricingCard - 价格方案卡片
 */
import { computed } from 'vue';
import type { PricingTier, BillingCycle } from '../types/landing';
import { getDisplayPrice, getYearlyDiscount, formatPrice } from '../composables/use-landing-data';
import CtaButton from './CtaButton.vue';

const props = defineProps<{
  tier: PricingTier;
  billingCycle: BillingCycle;
}>();

const price = computed(() => getDisplayPrice(props.tier, props.billingCycle));
const discount = computed(() => getYearlyDiscount(props.tier));
</script>

<template>
  <div
    class="pricing-card"
    :class="{ 'pricing-card--highlighted': tier.highlighted }"
    data-animate
  >
    <!-- 徽章 -->
    <div v-if="tier.badge" class="pricing-card__badge">{{ tier.badge }}</div>

    <!-- 方案名 -->
    <h3 class="pricing-card__name">{{ tier.name }}</h3>
    <p class="pricing-card__desc">{{ tier.description }}</p>

    <!-- 价格 -->
    <div class="pricing-card__price">
      <template v-if="tier.customPrice">
        <span class="price-custom">{{ tier.customPriceLabel || 'Custom' }}</span>
      </template>
      <template v-else>
        <span class="price-amount">{{ formatPrice(price, tier.currency) }}</span>
        <span v-if="price > 0" class="price-period">/mo</span>
      </template>
    </div>

    <!-- 年付折扣 -->
    <div
      v-if="billingCycle === 'yearly' && discount > 0 && !tier.customPrice"
      class="pricing-card__discount"
    >
      Save {{ discount }}% vs monthly
    </div>

    <!-- CTA -->
    <CtaButton
      :label="tier.ctaLabel"
      :href="tier.ctaHref"
      :variant="tier.highlighted ? 'primary' : 'outline'"
      size="md"
      block
    />

    <!-- 功能列表 -->
    <ul class="pricing-card__features">
      <li
        v-for="(f, idx) in tier.features"
        :key="idx"
        class="feature-item"
        :class="{ 'feature-item--disabled': !f.included }"
      >
        <span class="feature-icon">{{ f.included ? '✓' : '—' }}</span>
        <span class="feature-text" :title="f.tooltip">{{ f.text }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.pricing-card {
  position: relative;
  padding: 32px 28px;
  background: var(--brand-bg, #ffffff);
  border: 1px solid var(--brand-border, #e5e7eb);
  border-radius: var(--brand-radius-xl, 16px);
  display: flex;
  flex-direction: column;
  transition: all 0.25s ease;
}

.pricing-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}

.pricing-card--highlighted {
  border-color: var(--brand-primary, #3b82f6);
  box-shadow: 0 0 0 1px var(--brand-primary, #3b82f6),
              0 8px 32px rgba(59, 130, 246, 0.12);
}

.pricing-card__badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 16px;
  font-size: 12px;
  font-weight: 700;
  color: #ffffff;
  background: var(--brand-primary, #3b82f6);
  border-radius: var(--brand-radius-full, 9999px);
  white-space: nowrap;
}

.pricing-card__name {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: var(--brand-text-primary, #111827);
}

.pricing-card__desc {
  margin: 0 0 20px;
  font-size: 14px;
  color: var(--brand-text-secondary, #6b7280);
  line-height: 1.5;
}

.pricing-card__price {
  margin-bottom: 8px;
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.price-amount {
  font-size: 40px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--brand-text-primary, #111827);
  line-height: 1;
}

.price-period {
  font-size: 15px;
  color: var(--brand-text-secondary, #6b7280);
  font-weight: 500;
}

.price-custom {
  font-size: 28px;
  font-weight: 700;
  color: var(--brand-text-primary, #111827);
}

.pricing-card__discount {
  margin-bottom: 20px;
  font-size: 12px;
  font-weight: 600;
  color: var(--brand-success, #22c55e);
}

.pricing-card__features {
  margin: 24px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
  color: var(--brand-text-primary, #111827);
}

.feature-item--disabled {
  color: var(--brand-text-disabled, #d1d5db);
}

.feature-icon {
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
}

.feature-item:not(.feature-item--disabled) .feature-icon {
  color: var(--brand-success, #22c55e);
}

.feature-text {
  line-height: 1.5;
}
</style>
