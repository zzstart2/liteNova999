<script setup lang="ts">
/**
 * CtaButton - CTA 按钮组件
 */
defineProps<{
  label: string;
  href: string;
  /** 按钮风格 */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否外部链接 */
  external?: boolean;
  /** 全宽 */
  block?: boolean;
}>();
</script>

<template>
  <a
    :href="href"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener noreferrer' : undefined"
    class="cta-btn"
    :class="[
      `cta-btn--${variant || 'primary'}`,
      `cta-btn--${size || 'md'}`,
      { 'cta-btn--block': block },
    ]"
  >
    {{ label }}
    <span v-if="external" class="cta-btn__external" aria-hidden="true">↗</span>
  </a>
</template>

<style scoped>
.cta-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-weight: 600;
  text-decoration: none;
  border-radius: var(--brand-radius, 8px);
  transition: all 0.2s ease;
  cursor: pointer;
  white-space: nowrap;
  border: 2px solid transparent;
}

/* Sizes */
.cta-btn--sm { padding: 8px 16px; font-size: 13px; }
.cta-btn--md { padding: 12px 24px; font-size: 15px; }
.cta-btn--lg { padding: 16px 32px; font-size: 17px; }

/* Primary */
.cta-btn--primary {
  background: var(--brand-primary, #3b82f6);
  color: #ffffff;
  border-color: var(--brand-primary, #3b82f6);
}
.cta-btn--primary:hover {
  background: var(--brand-primary-600, #2563eb);
  border-color: var(--brand-primary-600, #2563eb);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
}

/* Secondary */
.cta-btn--secondary {
  background: var(--brand-surface, #f9fafb);
  color: var(--brand-text-primary, #111827);
  border-color: var(--brand-border, #e5e7eb);
}
.cta-btn--secondary:hover {
  background: var(--brand-bg, #ffffff);
  border-color: var(--brand-primary, #3b82f6);
  color: var(--brand-primary, #3b82f6);
}

/* Outline */
.cta-btn--outline {
  background: transparent;
  color: var(--brand-primary, #3b82f6);
  border-color: var(--brand-primary, #3b82f6);
}
.cta-btn--outline:hover {
  background: var(--brand-primary, #3b82f6);
  color: #ffffff;
}

/* Ghost */
.cta-btn--ghost {
  background: transparent;
  color: var(--brand-text-secondary, #6b7280);
  border-color: transparent;
}
.cta-btn--ghost:hover {
  color: var(--brand-primary, #3b82f6);
  background: var(--brand-primary-50, #eff6ff);
}

/* Block */
.cta-btn--block { width: 100%; }

.cta-btn__external { font-size: 0.85em; }
</style>
