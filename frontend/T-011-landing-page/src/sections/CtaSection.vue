<script setup lang="ts">
/**
 * CtaSection - 行动号召
 *
 * 醒目的品牌色背景 + 注册 CTA
 */
import type { CtaConfig } from '../types/landing';
import CtaButton from '../components/CtaButton.vue';

defineProps<{
  heading: string;
  subheading?: string;
  button: CtaConfig;
}>();
</script>

<template>
  <section class="cta-section">
    <div class="cta-section__inner">
      <h2 class="cta-section__heading">{{ heading }}</h2>
      <p v-if="subheading" class="cta-section__sub">{{ subheading }}</p>
      <div class="cta-section__action">
        <CtaButton
          :label="button.label"
          :href="button.href"
          :external="button.external"
          variant="outline"
          size="lg"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.cta-section {
  padding: 96px 24px;
  background: var(--brand-primary, #3b82f6);
  position: relative;
  overflow: hidden;
}

/* 装饰 */
.cta-section::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 500px;
  height: 500px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  pointer-events: none;
}

.cta-section::after {
  content: '';
  position: absolute;
  bottom: -30%;
  left: -10%;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.04);
  pointer-events: none;
}

.cta-section__inner {
  max-width: 700px;
  margin: 0 auto;
  text-align: center;
  position: relative;
  z-index: 1;
}

.cta-section__heading {
  margin: 0;
  font-size: 36px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.cta-section__sub {
  margin: 16px 0 0;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.5;
}

.cta-section__action {
  margin-top: 32px;
}

/* Override outline button for dark bg */
.cta-section :deep(.cta-btn--outline) {
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.5);
}
.cta-section :deep(.cta-btn--outline:hover) {
  background: #ffffff;
  color: var(--brand-primary, #3b82f6);
  border-color: #ffffff;
}

@media (max-width: 640px) {
  .cta-section {
    padding: 64px 20px;
  }
  .cta-section__heading {
    font-size: 28px;
  }
}
</style>
