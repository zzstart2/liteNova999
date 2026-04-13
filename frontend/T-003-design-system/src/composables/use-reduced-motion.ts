/**
 * liteNova999 Design System — useReducedMotion composable
 *
 * Detects and reactively tracks prefers-reduced-motion media query.
 */

import { ref, onMounted, onUnmounted, readonly, type Ref } from 'vue';

export interface UseReducedMotionReturn {
  /** Whether the user prefers reduced motion */
  readonly prefersReducedMotion: Readonly<Ref<boolean>>;
}

export function useReducedMotion(): UseReducedMotionReturn {
  const prefersReducedMotion = ref(false);
  let mql: MediaQueryList | null = null;

  const handleChange = (e: MediaQueryListEvent): void => {
    prefersReducedMotion.value = e.matches;
  };

  onMounted(() => {
    mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.value = mql.matches;
    mql.addEventListener('change', handleChange);
  });

  onUnmounted(() => {
    mql?.removeEventListener('change', handleChange);
  });

  return {
    prefersReducedMotion: readonly(prefersReducedMotion),
  };
}
