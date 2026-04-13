<script setup lang="ts">
/**
 * FaqSection - 常见问题
 */
import type { FaqItem as FaqItemType } from '../types/landing';
import SectionHeading from '../components/SectionHeading.vue';
import FaqItem from '../components/FaqItem.vue';

defineProps<{
  heading: string;
  subheading?: string;
  items: FaqItemType[];
}>();
</script>

<template>
  <section id="faq" class="faq-section">
    <div class="faq-section__inner">
      <SectionHeading :heading="heading" :subheading="subheading" />

      <div class="faq-list">
        <FaqItem
          v-for="(item, idx) in items"
          :key="idx"
          :item="item"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.faq-section {
  padding: 96px 24px;
}

.faq-section__inner {
  max-width: 720px;
  margin: 0 auto;
}

.faq-list {
  border-top: 1px solid var(--brand-border, #e5e7eb);
}

@media (max-width: 640px) {
  .faq-section {
    padding: 64px 20px;
  }
}
</style>
