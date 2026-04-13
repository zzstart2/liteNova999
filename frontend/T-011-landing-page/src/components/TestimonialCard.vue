<script setup lang="ts">
/**
 * TestimonialCard - 用户评价卡片
 */
import type { TestimonialItem } from '../types/landing';

defineProps<{
  item: TestimonialItem;
}>();
</script>

<template>
  <div class="testimonial-card" data-animate>
    <!-- 星级 -->
    <div v-if="item.rating" class="testimonial-card__stars" aria-label="`${item.rating} stars`">
      <span v-for="i in 5" :key="i" :class="{ filled: i <= item.rating! }">★</span>
    </div>

    <!-- 引言 -->
    <blockquote class="testimonial-card__quote">
      "{{ item.quote }}"
    </blockquote>

    <!-- 作者 -->
    <div class="testimonial-card__author">
      <div
        v-if="item.avatar"
        class="author-avatar"
        :style="{ backgroundImage: `url(${item.avatar})` }"
        role="img"
        :aria-label="item.name"
      />
      <div v-else class="author-avatar author-avatar--placeholder">
        {{ item.name.charAt(0) }}
      </div>
      <div class="author-info">
        <div class="author-name">{{ item.name }}</div>
        <div class="author-role">{{ item.role }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.testimonial-card {
  padding: 28px 24px;
  background: var(--brand-bg, #ffffff);
  border: 1px solid var(--brand-border, #e5e7eb);
  border-radius: var(--brand-radius-lg, 12px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 300px;
  max-width: 400px;
  flex-shrink: 0;
  transition: box-shadow 0.2s;
}

.testimonial-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}

.testimonial-card__stars {
  display: flex;
  gap: 2px;
  font-size: 16px;
  color: var(--brand-text-disabled, #d1d5db);
}

.testimonial-card__stars .filled {
  color: var(--brand-warning, #f59e0b);
}

.testimonial-card__quote {
  margin: 0;
  font-size: 15px;
  line-height: 1.7;
  color: var(--brand-text-primary, #111827);
  font-style: italic;
  flex: 1;
}

.testimonial-card__author {
  display: flex;
  align-items: center;
  gap: 12px;
}

.author-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
}

.author-avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  background: var(--brand-primary, #3b82f6);
}

.author-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--brand-text-primary, #111827);
}

.author-role {
  font-size: 12px;
  color: var(--brand-text-secondary, #6b7280);
}
</style>
