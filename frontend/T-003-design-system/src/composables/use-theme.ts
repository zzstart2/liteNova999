/**
 * liteNova999 Design System — useTheme composable
 *
 * Provides reactive theme management for Vue components.
 * Wraps theme-manager.ts with Vue reactivity.
 */

import { ref, computed, onMounted, onUnmounted, readonly, type Ref, type ComputedRef } from 'vue';
import type { ThemeMode } from '../types/design-tokens';
import {
  getPersistedMode,
  resolveTheme,
  setThemeMode,
  toggleTheme as toggleThemeRaw,
  initTheme,
} from '../themes/theme-manager';

export interface UseThemeReturn {
  /** Current theme mode (light | dark | system) */
  readonly mode: Readonly<Ref<ThemeMode>>;
  /** Resolved effective theme (light | dark) */
  readonly resolvedTheme: ComputedRef<'light' | 'dark'>;
  /** Whether dark mode is currently active */
  readonly isDark: ComputedRef<boolean>;
  /** Set theme mode */
  setMode: (mode: ThemeMode) => void;
  /** Toggle between light and dark */
  toggle: () => void;
}

export function useTheme(): UseThemeReturn {
  const mode = ref<ThemeMode>(getPersistedMode());

  const resolvedTheme = computed<'light' | 'dark'>(() => resolveTheme(mode.value));
  const isDark = computed(() => resolvedTheme.value === 'dark');

  let cleanup: (() => void) | null = null;

  const setMode = (newMode: ThemeMode): void => {
    mode.value = newMode;
    setThemeMode(newMode);
  };

  const toggle = (): void => {
    const next = toggleThemeRaw();
    mode.value = next;
  };

  onMounted(() => {
    cleanup = initTheme();
    // Sync mode in case localStorage changed externally
    mode.value = getPersistedMode();
  });

  onUnmounted(() => {
    cleanup?.();
  });

  return {
    mode: readonly(mode),
    resolvedTheme,
    isDark,
    setMode,
    toggle,
  };
}
