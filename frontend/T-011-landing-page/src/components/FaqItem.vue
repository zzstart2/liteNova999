<script setup lang="ts">
/**
 * FaqItem - 手风琴折叠项
 */
import { ref } from 'vue';
import type { FaqItem as FaqItemType } from '../types/landing';

const props = defineProps<{
  item: FaqItemType;
  /** 初始展开 */
  defaultOpen?: boolean;
}>();

const isOpen = ref(props.defaultOpen ?? false);

function toggle() {
  isOpen.value = !isOpen.value;
}
</script>

<template>
  <div class="faq-item" :class="{ 'faq-item--open': isOpen }">
    <button
      class="faq-item__trigger"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <span class="faq-item__question">{{ item.question }}</span>
      <span class="faq-item__chevron" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </button>
    <div class="faq-item__panel" :aria-hidden="!isOpen">
      <div class="faq-item__answer" v-html="item.answer" />
    </div>
  </div>
</template>

<style scoped>
.faq-item {
  border-bottom: 1px solid var(--brand-border, #e5e7eb);
}

.faq-item__trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 0;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}

.faq-item__question {
  font-size: 16px;
  font-weight: 600;
  color: var(--brand-text-primary, #111827);
  line-height: 1.4;
}

.faq-item__chevron {
  flex-shrink: 0;
  color: var(--brand-text-secondary, #6b7280);
  transition: transform 0.25s ease;
}

.faq-item--open .faq-item__chevron {
  transform: rotate(180deg);
}

.faq-item__panel {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s ease;
}

.faq-item--open .faq-item__panel {
  grid-template-rows: 1fr;
}

.faq-item__answer {
  overflow: hidden;
  font-size: 15px;
  line-height: 1.7;
  color: var(--brand-text-secondary, #6b7280);
}

.faq-item--open .faq-item__answer {
  padding-bottom: 20px;
}
</style>
