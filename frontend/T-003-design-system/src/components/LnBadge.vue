<script setup lang="ts">
/**
 * LnBadge — liteNova999 Badge Component
 *
 * Semantic badge/tag with variant support.
 */

import type { BadgeVariant } from '../types/design-tokens';

export interface LnBadgeProps {
  /** Badge variant */
  variant?: BadgeVariant;
}

withDefaults(defineProps<LnBadgeProps>(), {
  variant: 'default',
});
</script>

<template>
  <span :class="['ln-badge', `ln-badge--${variant}`]">
    <slot />
  </span>
</template>

<style scoped>
.ln-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 var(--space-2);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-radius: var(--radius-full);
  white-space: nowrap;
  line-height: 1;
}

.ln-badge--default {
  background: var(--color-neutral-100);
  color: var(--color-neutral-600);
}

.ln-badge--primary {
  background: var(--color-primary-50);
  color: var(--color-primary-700);
}

.ln-badge--success {
  background: var(--color-success-light);
  color: #065F46;
}

.ln-badge--warning {
  background: var(--color-warning-light);
  color: #92400E;
}

.ln-badge--error {
  background: var(--color-error-light);
  color: #991B1B;
}
</style>
