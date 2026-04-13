<script setup lang="ts">
/**
 * FeaturesSection - 功能亮点
 */
import { ref } from 'vue';
import type { FeatureItem } from '../types/landing';
import { useScrollAnimation } from '../composables/use-scroll-animation';
import SectionHeading from '../components/SectionHeading.vue';
import FeatureCard from '../components/FeatureCard.vue';

defineProps<{
  heading: string;
  subheading?: string;
  items: FeatureItem[];
}>();

const sectionRef = ref<HTMLElement>();
useScrollAnimation(sectionRef, {
  childSelector: '.feature-card',
  staggerDelay: 80,
});
</script>

<template>
  <section ref="sectionRef" id="features" class="features-section">
    <div class="features-section__inner">
      <SectionHeading :heading="heading" :subheading="subheading" />

      <div class="features-grid">
        <FeatureCard
          v-for="item in items"
          :key="item.title"
          :feature="item"
          class="feature-card"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.features-section {
  padding: 96px 24px;
  background: var(--brand-surface, #f9fafb);
}

.features-section__inner {
  max-width: 1200px;
  margin: 0 auto;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
}

@media (min-width: 1024px) {
  .features-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 640px) {
  .features-section {
    padding: 64px 20px;
  }
  .features-grid {
    grid-template-columns: 1fr;
  }
}
</style>
