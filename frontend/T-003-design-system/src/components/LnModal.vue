<script setup lang="ts">
/**
 * LnModal — liteNova999 Modal Component
 *
 * Accessible modal dialog with backdrop, animation, and focus trapping.
 * Supports two sizes (md, lg) and close on backdrop click / Escape.
 */

import { watch, ref, nextTick, onUnmounted } from 'vue';
import type { ModalSize } from '../types/design-tokens';

export interface LnModalProps {
  /** Whether the modal is open (v-model) */
  modelValue?: boolean;
  /** Modal size */
  size?: ModalSize;
  /** Title text */
  title?: string;
  /** Close on backdrop click */
  closeOnBackdrop?: boolean;
  /** Close on Escape key */
  closeOnEscape?: boolean;
  /** Show close button */
  showClose?: boolean;
}

const props = withDefaults(defineProps<LnModalProps>(), {
  modelValue: false,
  size: 'md',
  title: undefined,
  closeOnBackdrop: true,
  closeOnEscape: true,
  showClose: true,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const modalRef = ref<HTMLElement | null>(null);
let previouslyFocused: HTMLElement | null = null;

function close(): void {
  emit('update:modelValue', false);
  emit('close');
}

function onBackdropClick(event: MouseEvent): void {
  if (props.closeOnBackdrop && event.target === event.currentTarget) {
    close();
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (props.closeOnEscape && event.key === 'Escape') {
    close();
  }

  // Focus trap
  if (event.key === 'Tab' && modalRef.value) {
    const focusable = modalRef.value.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }
}

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      previouslyFocused = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKeydown);
      await nextTick();
      // Focus the modal or first focusable element
      const firstFocusable = modalRef.value?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (firstFocusable ?? modalRef.value)?.focus();
    } else {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeydown);
      previouslyFocused?.focus();
    }
  }
);

onUnmounted(() => {
  document.body.style.overflow = '';
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="ln-modal">
      <div
        v-if="modelValue"
        class="ln-modal-backdrop"
        @click="onBackdropClick"
      >
        <div
          ref="modalRef"
          :class="['ln-modal', `ln-modal--${size}`]"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
        >
          <!-- Header -->
          <div v-if="title || showClose" class="ln-modal__header">
            <h2 v-if="title" class="ln-modal__title">{{ title }}</h2>
            <button
              v-if="showClose"
              class="ln-modal__close"
              aria-label="Close modal"
              @click="close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="ln-modal__body">
            <slot />
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="ln-modal__footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ln-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: var(--z-modal-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ln-modal {
  position: relative;
  width: min(480px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  background: var(--color-bg-card);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-xl);
  z-index: var(--z-modal);
}

.ln-modal--lg {
  width: min(640px, calc(100vw - 32px));
}

.ln-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.ln-modal__title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.ln-modal__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  color: var(--color-neutral-500);
  transition: all var(--duration-normal) var(--ease-out);
  cursor: pointer;
  background: transparent;
  border: none;
  margin-left: auto;
}

.ln-modal__close:hover {
  background: var(--color-neutral-100);
  color: var(--color-neutral-700);
}

.ln-modal__close:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

.ln-modal__body {
  color: var(--color-text-secondary);
}

.ln-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

/* Transition */
.ln-modal-enter-active {
  transition: opacity var(--duration-slow) var(--ease-out);
}

.ln-modal-enter-active .ln-modal {
  transition:
    opacity var(--duration-slow) var(--ease-out),
    transform var(--duration-slow) var(--ease-out);
}

.ln-modal-leave-active {
  transition: opacity var(--duration-normal) var(--ease-in);
}

.ln-modal-leave-active .ln-modal {
  transition:
    opacity var(--duration-normal) var(--ease-in),
    transform var(--duration-normal) var(--ease-in);
}

.ln-modal-enter-from {
  opacity: 0;
}

.ln-modal-enter-from .ln-modal {
  opacity: 0;
  transform: translateY(16px);
}

.ln-modal-leave-to {
  opacity: 0;
}

.ln-modal-leave-to .ln-modal {
  opacity: 0;
  transform: translateY(8px);
}
</style>
