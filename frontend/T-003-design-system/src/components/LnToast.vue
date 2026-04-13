<script setup lang="ts">
/**
 * LnToast — liteNova999 Toast Notification Component
 *
 * Renders the toast container and individual toast items.
 * Use with the useToast() composable.
 */

import { useToast, type ToastItem } from '../composables/use-toast';
import type { ToastType } from '../types/design-tokens';

const { toasts, remove } = useToast();

const iconPaths: Record<ToastType, string> = {
  success: 'M20 6L9 17l-5-5',
  error: 'M18 6L6 18M6 6l12 12',
  warning: 'M12 9v4m0 4h.01M12 2L2 20h20L12 2z',
  info: 'M12 16v-4m0-4h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0z',
};
</script>

<template>
  <Teleport to="body">
    <div class="ln-toast-container" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="ln-toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="ln-toast"
          role="alert"
        >
          <span :class="['ln-toast__icon', `ln-toast__icon--${toast.type}`]" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path :d="iconPaths[toast.type]" />
            </svg>
          </span>

          <div class="ln-toast__content">
            <p class="ln-toast__title">{{ toast.title }}</p>
            <p v-if="toast.message" class="ln-toast__message">{{ toast.message }}</p>
          </div>

          <button
            class="ln-toast__dismiss"
            aria-label="Dismiss notification"
            @click="remove(toast.id)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.ln-toast-container {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  pointer-events: none;
}

.ln-toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  width: 360px;
  max-width: calc(100vw - 32px);
  padding: var(--space-4);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.ln-toast__icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

.ln-toast__icon--success {
  background: var(--color-success);
}

.ln-toast__icon--error {
  background: var(--color-error);
}

.ln-toast__icon--warning {
  background: var(--color-warning);
}

.ln-toast__icon--info {
  background: var(--color-info);
}

.ln-toast__content {
  flex: 1;
  min-width: 0;
}

.ln-toast__title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.ln-toast__message {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin: 2px 0 0;
}

.ln-toast__dismiss {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: var(--color-neutral-400);
  cursor: pointer;
  background: transparent;
  border: none;
  transition: all var(--duration-normal) var(--ease-out);
}

.ln-toast__dismiss:hover {
  color: var(--color-neutral-600);
  background: var(--color-neutral-100);
}

.ln-toast__dismiss:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

/* Transitions */
.ln-toast-enter-active {
  transition:
    opacity var(--duration-slow) var(--ease-out),
    transform var(--duration-slow) var(--ease-out);
}

.ln-toast-leave-active {
  transition:
    opacity var(--duration-normal) var(--ease-in),
    transform var(--duration-normal) var(--ease-in);
}

.ln-toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.ln-toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.ln-toast-move {
  transition: transform var(--duration-slow) var(--ease-out);
}
</style>
