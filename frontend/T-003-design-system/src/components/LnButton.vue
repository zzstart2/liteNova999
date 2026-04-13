<script setup lang="ts">
/**
 * LnButton — liteNova999 Button Component
 *
 * Supports all variants (primary, secondary, outline, ghost, danger),
 * sizes (sm, md, lg), and states (loading, disabled).
 */

import type { ButtonVariant, ButtonSize } from '../types/design-tokens';

export interface LnButtonProps {
  /** Button variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Loading state (shows spinner, disables interaction) */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Render as a different element (e.g., 'a' for links) */
  as?: 'button' | 'a';
  /** Button type attribute */
  type?: 'button' | 'submit' | 'reset';
}

const props = withDefaults(defineProps<LnButtonProps>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  as: 'button',
  type: 'button',
});

defineEmits<{
  click: [event: MouseEvent];
}>();

const isDisabled = computed(() => props.disabled || props.loading);
</script>

<template>
  <component
    :is="as"
    :class="[
      'ln-btn',
      `ln-btn--${variant}`,
      `ln-btn--${size}`,
      { 'ln-btn--loading': loading },
    ]"
    :disabled="isDisabled"
    :type="as === 'button' ? type : undefined"
    :aria-disabled="isDisabled || undefined"
    :aria-busy="loading || undefined"
    :tabindex="isDisabled ? -1 : undefined"
  >
    <span class="ln-btn__content" :class="{ 'ln-btn__content--hidden': loading }">
      <slot />
    </span>
    <span v-if="loading" class="ln-btn__spinner" aria-hidden="true" />
  </component>
</template>

<script lang="ts">
import { computed } from 'vue';
</script>

<style scoped>
.ln-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: none;
  cursor: pointer;
  font-family: var(--font-sans);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--ease-out);
  white-space: nowrap;
  user-select: none;
  position: relative;
  text-decoration: none;
}

/* Sizes */
.ln-btn--sm {
  height: 32px;
  padding: 0 var(--space-3);
  font-size: var(--text-sm);
  border-radius: 6px;
}

.ln-btn--md {
  height: 40px;
  padding: 0 var(--space-4);
  font-size: var(--text-sm);
  border-radius: var(--radius-md);
}

.ln-btn--lg {
  height: 48px;
  padding: 0 var(--space-5);
  font-size: var(--text-base);
  border-radius: var(--radius-md);
}

/* Variants */
.ln-btn--primary {
  background: var(--color-primary-500);
  color: white;
}
.ln-btn--primary:hover:not(:disabled) {
  background: var(--color-primary-600);
}
.ln-btn--primary:active:not(:disabled) {
  background: var(--color-primary-700);
  transform: scale(0.98);
}

.ln-btn--secondary {
  background: var(--color-primary-50);
  color: var(--color-primary-600);
}
.ln-btn--secondary:hover:not(:disabled) {
  background: var(--color-primary-100);
}
.ln-btn--secondary:active:not(:disabled) {
  transform: scale(0.98);
}

.ln-btn--outline {
  background: transparent;
  color: var(--color-primary-500);
  border: 1px solid var(--color-primary-200);
}
.ln-btn--outline:hover:not(:disabled) {
  background: var(--color-primary-50);
}
.ln-btn--outline:active:not(:disabled) {
  transform: scale(0.98);
}

.ln-btn--ghost {
  background: transparent;
  color: var(--color-primary-500);
}
.ln-btn--ghost:hover:not(:disabled) {
  background: var(--color-primary-50);
}
.ln-btn--ghost:active:not(:disabled) {
  transform: scale(0.98);
}

.ln-btn--danger {
  background: var(--color-error);
  color: white;
}
.ln-btn--danger:hover:not(:disabled) {
  background: #DC2626;
}
.ln-btn--danger:active:not(:disabled) {
  background: #B91C1C;
  transform: scale(0.98);
}

/* States */
.ln-btn:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

.ln-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* Loading */
.ln-btn--loading {
  cursor: wait;
  pointer-events: none;
}

.ln-btn__content {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.ln-btn__content--hidden {
  visibility: hidden;
}

.ln-btn__spinner {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: ln-spin 600ms linear infinite;
}

@keyframes ln-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
