/**
 * liteNova999 Design System — Theme Manager
 *
 * Handles theme switching with:
 * - System preference detection (prefers-color-scheme)
 * - Manual toggle (light/dark/system)
 * - Persistence to localStorage
 * - data-theme attribute on <html>
 * - Smooth transitions (respecting prefers-reduced-motion)
 */

import type { ThemeMode } from '../types/design-tokens';

const STORAGE_KEY = 'ln-theme-mode';
const TRANSITION_CLASS = 'ln-theme-transition';

/**
 * Get the resolved theme (light or dark) from a ThemeMode.
 * When mode is 'system', detects from media query.
 */
export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return getSystemPreference();
  }
  return mode;
}

/**
 * Detect the system color scheme preference.
 */
export function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Check if the user prefers reduced motion.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get the persisted theme mode from localStorage.
 * Defaults to 'system' if not set or invalid.
 */
export function getPersistedMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

/**
 * Persist the theme mode to localStorage.
 */
export function persistMode(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, mode);
}

/**
 * Apply the resolved theme to the document.
 * Sets data-theme attribute and optionally adds a transition class.
 */
export function applyTheme(theme: 'light' | 'dark', animate: boolean = true): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  if (animate && !prefersReducedMotion()) {
    root.classList.add(TRANSITION_CLASS);
    // Remove transition class after animation completes
    const onTransitionEnd = (): void => {
      root.classList.remove(TRANSITION_CLASS);
      root.removeEventListener('transitionend', onTransitionEnd);
    };
    root.addEventListener('transitionend', onTransitionEnd);
    // Fallback: remove after 500ms even if no transition fires
    setTimeout(() => {
      root.classList.remove(TRANSITION_CLASS);
    }, 500);
  }

  root.setAttribute('data-theme', theme);
}

/**
 * Set the theme mode, persist it, and apply it.
 */
export function setThemeMode(mode: ThemeMode, animate: boolean = true): void {
  persistMode(mode);
  const resolved = resolveTheme(mode);
  applyTheme(resolved, animate);
}

/**
 * Toggle between light and dark (ignoring system).
 * Returns the new mode.
 */
export function toggleTheme(): ThemeMode {
  const current = getPersistedMode();
  const resolved = resolveTheme(current);
  const next: ThemeMode = resolved === 'light' ? 'dark' : 'light';
  setThemeMode(next);
  return next;
}

/**
 * Initialize the theme system.
 * Call once at app startup.
 * Returns a cleanup function that removes the system preference listener.
 */
export function initTheme(): () => void {
  const mode = getPersistedMode();
  // Apply without animation on initial load
  applyTheme(resolveTheme(mode), false);

  // Listen for system preference changes (only relevant when mode is 'system')
  const mql = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  const handleChange = (): void => {
    const currentMode = getPersistedMode();
    if (currentMode === 'system') {
      applyTheme(getSystemPreference());
    }
  };

  mql?.addEventListener('change', handleChange);

  return () => {
    mql?.removeEventListener('change', handleChange);
  };
}
