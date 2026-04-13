<script setup lang="ts">
/**
 * LnIcon — liteNova999 Icon Wrapper Component
 *
 * Wraps icon content with consistent sizing from the design spec.
 * Uses currentColor for fill/stroke to inherit parent text color.
 * Expects slotted SVG or icon component.
 */

import type { IconSizeKey } from '../types/design-tokens';

export interface LnIconProps {
  /** Icon size */
  size?: IconSizeKey;
  /** Accessible label (required for standalone icons, omit for decorative) */
  label?: string;
}

const props = withDefaults(defineProps<LnIconProps>(), {
  size: 'md',
  label: undefined,
});

const sizeMap: Record<IconSizeKey, string> = {
  xs: '16px',
  sm: '20px',
  md: '24px',
  lg: '32px',
  xl: '48px',
};
</script>

<template>
  <span
    :class="['ln-icon', `ln-icon--${size}`]"
    :style="{ width: sizeMap[size], height: sizeMap[size] }"
    :role="label ? 'img' : 'presentation'"
    :aria-label="label"
    :aria-hidden="!label || undefined"
  >
    <slot />
  </span>
</template>

<style scoped>
.ln-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: currentColor;
}

/* Ensure slotted SVGs inherit size and color */
.ln-icon :deep(svg) {
  width: 100%;
  height: 100%;
  color: inherit;
  fill: none;
  stroke: currentColor;
}

.ln-icon--xs :deep(svg) {
  stroke-width: 1.5;
}

.ln-icon--sm :deep(svg) {
  stroke-width: 1.5;
}

.ln-icon--md :deep(svg) {
  stroke-width: 2;
}

.ln-icon--lg :deep(svg) {
  stroke-width: 2;
}

.ln-icon--xl :deep(svg) {
  stroke-width: 2;
}
</style>
