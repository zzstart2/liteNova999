<script setup lang="ts">
/**
 * HowItWorksSection - 使用流程
 */
import { ref } from 'vue';
import type { StepItem } from '../types/landing';
import { useScrollAnimation } from '../composables/use-scroll-animation';
import SectionHeading from '../components/SectionHeading.vue';

defineProps<{
  heading: string;
  subheading?: string;
  steps: StepItem[];
}>();

const sectionRef = ref<HTMLElement>();
useScrollAnimation(sectionRef, {
  childSelector: '.step-item',
  staggerDelay: 150,
});
</script>

<template>
  <section ref="sectionRef" id="how-it-works" class="how-section">
    <div class="how-section__inner">
      <SectionHeading :heading="heading" :subheading="subheading" />

      <div class="steps-row">
        <div
          v-for="(step, idx) in steps"
          :key="idx"
          class="step-item"
          data-animate
        >
          <!-- 连线 -->
          <div v-if="idx < steps.length - 1" class="step-connector" aria-hidden="true" />

          <div class="step-number">{{ step.step || idx + 1 }}</div>
          <div v-if="step.icon" class="step-icon">{{ step.icon }}</div>
          <h3 class="step-title">{{ step.title }}</h3>
          <p class="step-desc">{{ step.description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.how-section {
  padding: 96px 24px;
}

.how-section__inner {
  max-width: 900px;
  margin: 0 auto;
}

.steps-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 32px;
  position: relative;
}

.step-item {
  position: relative;
  text-align: center;
  padding: 0 8px;
}

.step-connector {
  display: none;
}

@media (min-width: 768px) {
  .step-connector {
    display: block;
    position: absolute;
    top: 24px;
    left: calc(50% + 28px);
    width: calc(100% - 56px);
    height: 2px;
    background: repeating-linear-gradient(
      90deg,
      var(--brand-border, #e5e7eb),
      var(--brand-border, #e5e7eb) 6px,
      transparent 6px,
      transparent 12px
    );
    z-index: 0;
  }
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  font-size: 18px;
  font-weight: 800;
  color: var(--brand-primary, #3b82f6);
  background: var(--brand-primary-50, #eff6ff);
  border: 2px solid var(--brand-primary-200, #bfdbfe);
  border-radius: 50%;
  position: relative;
  z-index: 1;
}

.step-icon {
  font-size: 36px;
  margin-bottom: 12px;
}

.step-title {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 700;
  color: var(--brand-text-primary, #111827);
}

.step-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--brand-text-secondary, #6b7280);
}

@media (max-width: 640px) {
  .how-section {
    padding: 64px 20px;
  }
  .steps-row {
    grid-template-columns: 1fr;
    gap: 40px;
  }
}
</style>
