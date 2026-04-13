/**
 * Theme Manager Tests
 *
 * Tests for theme switching logic: resolve, persist, apply, toggle.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveTheme,
  getSystemPreference,
  getPersistedMode,
  persistMode,
  applyTheme,
  setThemeMode,
  toggleTheme,
  initTheme,
  prefersReducedMotion,
} from '../src/themes/theme-manager';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

// Mock matchMedia
function createMatchMediaMock(matches: boolean) {
  return (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

describe('Theme Manager', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    localStorageMock.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('ln-theme-transition');
  });

  describe('resolveTheme', () => {
    it('returns light when mode is light', () => {
      expect(resolveTheme('light')).toBe('light');
    });

    it('returns dark when mode is dark', () => {
      expect(resolveTheme('dark')).toBe('dark');
    });

    it('returns system preference when mode is system', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: createMatchMediaMock(true),
        writable: true,
      });
      expect(resolveTheme('system')).toBe('dark');

      Object.defineProperty(window, 'matchMedia', {
        value: createMatchMediaMock(false),
        writable: true,
      });
      expect(resolveTheme('system')).toBe('light');
    });
  });

  describe('getSystemPreference', () => {
    it('returns dark when prefers-color-scheme is dark', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: createMatchMediaMock(true),
        writable: true,
      });
      expect(getSystemPreference()).toBe('dark');
    });

    it('returns light when prefers-color-scheme is not dark', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: createMatchMediaMock(false),
        writable: true,
      });
      expect(getSystemPreference()).toBe('light');
    });
  });

  describe('persistence', () => {
    it('defaults to system when nothing stored', () => {
      expect(getPersistedMode()).toBe('system');
    });

    it('returns stored mode', () => {
      persistMode('dark');
      expect(getPersistedMode()).toBe('dark');
    });

    it('returns system for invalid stored value', () => {
      localStorageMock.setItem('ln-theme-mode', 'invalid');
      expect(getPersistedMode()).toBe('system');
    });
  });

  describe('applyTheme', () => {
    it('sets data-theme attribute on html', () => {
      applyTheme('dark', false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('sets data-theme to light', () => {
      applyTheme('light', false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  describe('setThemeMode', () => {
    it('persists and applies theme', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: createMatchMediaMock(false),
        writable: true,
      });
      setThemeMode('dark', false);
      expect(getPersistedMode()).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('toggleTheme', () => {
    it('toggles from light to dark', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: createMatchMediaMock(false),
        writable: true,
      });
      persistMode('light');
      applyTheme('light', false);
      const next = toggleTheme();
      expect(next).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('toggles from dark to light', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: createMatchMediaMock(false),
        writable: true,
      });
      persistMode('dark');
      applyTheme('dark', false);
      const next = toggleTheme();
      expect(next).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  describe('initTheme', () => {
    it('applies persisted theme on init', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: createMatchMediaMock(false),
        writable: true,
      });
      persistMode('dark');
      const cleanup = initTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      cleanup();
    });

    it('returns cleanup function', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: createMatchMediaMock(false),
        writable: true,
      });
      const cleanup = initTheme();
      expect(typeof cleanup).toBe('function');
      cleanup();
    });
  });

  describe('prefersReducedMotion', () => {
    it('returns true when user prefers reduced motion', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: (query: string) => ({
          matches: query.includes('reduced-motion'),
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
        writable: true,
      });
      expect(prefersReducedMotion()).toBe(true);
    });
  });
});
