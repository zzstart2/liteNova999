<script setup lang="ts">
/**
 * LnCard — liteNova999 Card Component
 *
 * Container with header/body/footer slots, optional hover effect.
 */

export interface LnCardProps {
  /** Enable hover effect (shadow + lift) */
  hoverable?: boolean;
  /** Remove border */
  borderless?: boolean;
  /** Custom padding override */
  padding?: string;
}

withDefaults(defineProps<LnCardProps>(), {
  hoverable: false,
  borderless: false,
  padding: undefined,
});
</script>

<template>
  <div
    :class="[
      'ln-card',
      {
        'ln-card--hoverable': hoverable,
        'ln-card--borderless': borderless,
      },
    ]"
    :style="padding ? { padding } : undefined"
  >
    <div v-if="$slots.header" class="ln-card__header">
      <slot name="header" />
    </div>

    <div class="ln-card__body">
      <slot />
    </div>

    <div v-if="$slots.footer" class="ln-card__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.ln-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-md);
  transition:
    box-shadow var(--duration-normal) var(--ease-out),
    transform var(--duration-normal) var(--ease-out);
}

.ln-card--borderless {
  border: none;
}

.ln-card--hoverable:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

.ln-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.ln-card__body {
  color: var(--color-text-secondary);
}

.ln-card__footer {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}
</style>
