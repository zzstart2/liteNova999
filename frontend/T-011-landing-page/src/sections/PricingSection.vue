<script setup lang="ts">
/**
 * PricingSection - 价格方案
 */
import { ref } from 'vue';
import type { PricingTier, BillingCycle } from '../types/landing';
import { useScrollAnimation } from '../composables/use-scroll-animation';
import SectionHeading from '../components/SectionHeading.vue';
import PricingCard from '../components/PricingCard.vue';

const props = defineProps<{
  heading: string;
  subheading?: string;
  tiers: PricingTier[];
  yearlyDiscount?: string;
  billingCycle: BillingCycle;
}>();

const emit = defineEmits<{
  (e: 'update:billingCycle', value: BillingCycle): void;
}>();

function setBilling(cycle: BillingCycle) {
  emit('update:billingCycle', cycle);
}

const sectionRef = ref<HTMLElement>();
useScrollAnimation(sectionRef, {
  childSelector: '.pricing-card',
  staggerDelay: 120,
});
</script>

<template>
  <section ref="sectionRef" id="pricing" class="pricing-section">
    <div class="pricing-section__inner">
      <SectionHeading :heading="heading" :subheading="subheading" />

      <!-- 月/年切换 -->
      <div class="billing-toggle">
        <button
          :class="['toggle-btn', { active: billingCycle === 'monthly' }]"
          @click="setBilling('monthly')"
        >
          Monthly
        </button>
        <button
          :class="['toggle-btn', { active: billingCycle === 'yearly' }]"
          @click="setBilling('yearly')"
        >
          Yearly
          <span v-if="yearlyDiscount" class="toggle-discount">{{ yearlyDiscount }}</span>
        </button>
      </div>

      <!-- 价格卡片 -->
      <div class="pricing-grid">
        <PricingCard
          v-for="tier in tiers"
          :key="tier.id"
          :tier="tier"
          :billing-cycle="billingCycle"
          class="pricing-card"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.pricing-section {
  padding: 96px 24px;
  background: var(--brand-surface, #f9fafb);
}

.pricing-section__inner {
  max-width: 1100px;
  margin: 0 auto;
}

.billing-toggle {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-bottom: 48px;
  padding: 3px;
  background: var(--brand-bg, #ffffff);
  border: 1px solid var(--brand-border, #e5e7eb);
  border-radius: var(--brand-radius, 8px);
  display: inline-flex;
  /* center the toggle itself */
  margin-left: auto;
  margin-right: auto;
  /* use a wrapper to center */
}

/* Centering wrapper hack */
.pricing-section__inner > .billing-toggle {
  display: flex;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
}

.toggle-btn {
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  background: transparent;
  border: none;
  border-radius: calc(var(--brand-radius, 8px) - 2px);
  cursor: pointer;
  color: var(--brand-text-secondary, #6b7280);
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.toggle-btn:hover {
  color: var(--brand-text-primary, #111827);
}

.toggle-btn.active {
  background: var(--brand-primary, #3b82f6);
  color: #ffffff;
  font-weight: 600;
}

.toggle-discount {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.25);
}

.toggle-btn:not(.active) .toggle-discount {
  background: var(--brand-success, #22c55e);
  color: #ffffff;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  align-items: start;
}

@media (max-width: 640px) {
  .pricing-section {
    padding: 64px 20px;
  }
  .pricing-grid {
    grid-template-columns: 1fr;
  }
}
</style>
