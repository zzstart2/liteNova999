/**
 * liteNova999 Design System — useToast composable
 *
 * Manages toast notifications with auto-dismiss and manual close.
 */

import { ref, readonly, type Ref } from 'vue';
import type { ToastType } from '../types/design-tokens';

export interface ToastItem {
  readonly id: string;
  readonly type: ToastType;
  readonly title: string;
  readonly message?: string;
  readonly duration: number;
}

export interface UseToastReturn {
  /** Active toasts list */
  readonly toasts: Readonly<Ref<readonly ToastItem[]>>;
  /** Add a toast, returns its ID */
  add: (options: ToastOptions) => string;
  /** Remove a toast by ID */
  remove: (id: string) => void;
  /** Remove all toasts */
  clear: () => void;
  /** Shorthand: success toast */
  success: (title: string, message?: string) => string;
  /** Shorthand: error toast */
  error: (title: string, message?: string) => string;
  /** Shorthand: warning toast */
  warning: (title: string, message?: string) => string;
  /** Shorthand: info toast */
  info: (title: string, message?: string) => string;
}

export interface ToastOptions {
  type: ToastType;
  title: string;
  message?: string;
  /** Duration in ms. Defaults: 5000 for info/success, 0 (manual) for error. */
  duration?: number;
}

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 5000,
  info: 5000,
  warning: 5000,
  error: 0, // error toasts must be manually closed
};

let idCounter = 0;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

// Shared state across components
const toasts = ref<ToastItem[]>([]);

function generateId(): string {
  return `ln-toast-${++idCounter}-${Date.now()}`;
}

function add(options: ToastOptions): string {
  const id = generateId();
  const duration = options.duration ?? DEFAULT_DURATIONS[options.type];

  const toast: ToastItem = {
    id,
    type: options.type,
    title: options.title,
    message: options.message,
    duration,
  };

  toasts.value = [...toasts.value, toast];

  if (duration > 0) {
    const timer = setTimeout(() => {
      remove(id);
    }, duration);
    timers.set(id, timer);
  }

  return id;
}

function remove(id: string): void {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

function clear(): void {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  toasts.value = [];
}

export function useToast(): UseToastReturn {
  return {
    toasts: readonly(toasts),
    add,
    remove,
    clear,
    success: (title: string, message?: string) => add({ type: 'success', title, message }),
    error: (title: string, message?: string) => add({ type: 'error', title, message }),
    warning: (title: string, message?: string) => add({ type: 'warning', title, message }),
    info: (title: string, message?: string) => add({ type: 'info', title, message }),
  };
}
