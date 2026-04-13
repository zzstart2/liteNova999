/**
 * liteNova999 Design System — useModal composable
 *
 * Manages modal open/close state with body scroll lock and escape key handling.
 */

import { ref, watch, onMounted, onUnmounted, readonly, type Ref } from 'vue';

export interface UseModalReturn {
  /** Whether the modal is open */
  readonly isOpen: Readonly<Ref<boolean>>;
  /** Open the modal */
  open: () => void;
  /** Close the modal */
  close: () => void;
  /** Toggle modal state */
  toggle: () => void;
}

export interface UseModalOptions {
  /** Close on Escape key press (default: true) */
  closeOnEscape?: boolean;
  /** Lock body scroll when open (default: true) */
  lockScroll?: boolean;
  /** Called when modal is closed */
  onClose?: () => void;
}

export function useModal(options: UseModalOptions = {}): UseModalReturn {
  const {
    closeOnEscape = true,
    lockScroll = true,
    onClose,
  } = options;

  const isOpen = ref(false);
  let previousOverflow = '';

  const open = (): void => {
    isOpen.value = true;
  };

  const close = (): void => {
    isOpen.value = false;
    onClose?.();
  };

  const toggle = (): void => {
    if (isOpen.value) {
      close();
    } else {
      open();
    }
  };

  const handleKeydown = (e: KeyboardEvent): void => {
    if (closeOnEscape && e.key === 'Escape' && isOpen.value) {
      close();
    }
  };

  // Lock/unlock body scroll
  watch(isOpen, (open) => {
    if (typeof document === 'undefined') return;
    if (lockScroll) {
      if (open) {
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = previousOverflow;
      }
    }
  });

  onMounted(() => {
    if (closeOnEscape) {
      document.addEventListener('keydown', handleKeydown);
    }
  });

  onUnmounted(() => {
    if (closeOnEscape) {
      document.removeEventListener('keydown', handleKeydown);
    }
    // Ensure scroll is restored on unmount
    if (lockScroll && isOpen.value) {
      document.body.style.overflow = previousOverflow;
    }
  });

  return {
    isOpen: readonly(isOpen),
    open,
    close,
    toggle,
  };
}
