<script setup lang="ts">
/**
 * TestimonialsSection - 用户评价
 *
 * 横向滚动卡片布局
 */
import type { TestimonialItem } from '../types/landing';
import SectionHeading from '../components/SectionHeading.vue';
import TestimonialCard from '../components/TestimonialCard.vue';

defineProps<{
  heading: string;
  subheading?: string;
  items: TestimonialItem[];
}>();
</script>

<template>
  <section id="testimonials" class="testimonials-section">
    <div class="testimonials-section__inner">
      <SectionHeading :heading="heading" :subheading="subheading" />
    </div>

    <!-- 横向滚动容器 -->
    <div class="testimonials-scroll">
      <div class="testimonials-track">
        <TestimonialCard
          v-for="(item, idx) in items"
          :key="idx"
          :item="item"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.testimonials-section {
  padding: 96px 0;
  overflow: hidden;
}

.testimonials-section__inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.testimonials-scroll {
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 0 24px;
}

.testimonials-scroll::-webkit-scrollbar {
  display: none;
}

.testimonials-track {
  display: flex;
  gap: 20px;
  padding-bottom: 8px;
  /* Center when content fits, scroll when it doesn't */
  width: max-content;
  margin: 0 auto;
}

@media (max-width: 640px) {
  .testimonials-section {
    padding: 64px 0;
  }
}
</style>
