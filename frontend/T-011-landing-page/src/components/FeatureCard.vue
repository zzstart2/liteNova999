<script setup lang="ts">
/**
 * FeatureCard - 功能亮点卡片
 */
import type { FeatureItem } from '../types/landing';

defineProps<{
  feature: FeatureItem;
}>();
</script>

<template>
  <div class="feature-card" data-animate>
    <div class="feature-card__icon">{{ feature.icon }}</div>
    <h3 class="feature-card__title">{{ feature.title }}</h3>
    <p class="feature-card__desc">{{ feature.description }}</p>
    <a v-if="feature.link" :href="feature.link" class="feature-card__link">
      Learn more →
    </a>
  </div>
</template>

<style scoped>
.feature-card {
  padding: 28px 24px;
  background: var(--brand-bg, #ffffff);
  border: 1px solid var(--brand-border, #e5e7eb);
  border-radius: var(--brand-radius-lg, 12px);
  transition: all 0.25s ease;
}

.feature-card:hover {
  border-color: var(--brand-primary-200, #bfdbfe);
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.08);
  transform: translateY(-2px);
}

.feature-card__icon {
  font-size: 32px;
  line-height: 1;
  margin-bottom: 16px;
}

.feature-card__title {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 700;
  color: var(--brand-text-primary, #111827);
}

.feature-card__desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--brand-text-secondary, #6b7280);
}

.feature-card__link {
  display: inline-block;
  margin-top: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--brand-primary, #3b82f6);
  text-decoration: none;
}

.feature-card__link:hover {
  text-decoration: underline;
}
</style>
