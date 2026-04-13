/**
 * 品牌引擎核心测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrandEngine, createBrandEngine } from '../src/brand/brand-engine';
import { DEFAULT_BRAND_CONFIG } from '../src/brand/default-config';
import { deepMerge, validateConfig } from '../src/brand/config-loader';
import type { BrandConfig, PartialBrandConfig } from '../src/types/brand';

// ============================================================
// deepMerge
// ============================================================

describe('deepMerge', () => {
  it('should shallow merge flat objects', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('should deep merge nested objects', () => {
    const target = { outer: { a: 1, b: 2 } };
    const source = { outer: { b: 3 } };
    const result = deepMerge(target, source as any);
    expect(result).toEqual({ outer: { a: 1, b: 3 } });
  });

  it('should not mutate target', () => {
    const target = { a: 1 };
    const source = { a: 2 };
    const result = deepMerge(target, source);
    expect(target.a).toBe(1);
    expect(result.a).toBe(2);
  });

  it('should handle undefined source', () => {
    const target = { a: 1 };
    const result = deepMerge(target, undefined);
    expect(result).toEqual({ a: 1 });
  });

  it('should skip undefined values in source', () => {
    const target = { a: 1, b: 2 };
    const source = { a: undefined, b: 3 };
    const result = deepMerge(target, source as any);
    expect(result.a).toBe(1);
    expect(result.b).toBe(3);
  });

  it('should replace arrays (not merge)', () => {
    const target = { arr: [1, 2, 3] };
    const source = { arr: [4, 5] };
    const result = deepMerge(target, source as any);
    expect(result.arr).toEqual([4, 5]);
  });
});

// ============================================================
// validateConfig
// ============================================================

describe('validateConfig', () => {
  it('should pass valid config', () => {
    const errors = validateConfig(DEFAULT_BRAND_CONFIG);
    expect(errors).toHaveLength(0);
  });

  it('should catch non-object config', () => {
    const errors = validateConfig(null);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should catch invalid hex colors', () => {
    const config = deepMerge(DEFAULT_BRAND_CONFIG, {
      color: { colors: { primary: 'not-a-color' } },
    } as any);
    const errors = validateConfig(config);
    expect(errors.some((e) => e.path.includes('primary'))).toBe(true);
  });
});

// ============================================================
// BrandEngine
// ============================================================

describe('BrandEngine', () => {
  let engine: BrandEngine;

  beforeEach(() => {
    engine = createBrandEngine(DEFAULT_BRAND_CONFIG);
  });

  it('should initialize with default config', () => {
    expect(engine.config).toEqual(DEFAULT_BRAND_CONFIG);
    expect(engine.themeMode).toBe('light');
  });

  it('should resolve brand name via t()', () => {
    expect(engine.t('brandName')).toBe('Lite999');
  });

  it('should resolve nested text', () => {
    expect(engine.t('nav.home')).toBe('Home');
    expect(engine.t('auth.login')).toBe('Sign In');
  });

  it('should resolve copyright with interpolation', () => {
    const year = new Date().getFullYear().toString();
    expect(engine.t('copyright')).toBe(`© ${year} Lite999`);
  });

  it('should generate palettes', () => {
    expect(engine.palettes.primary).toBeDefined();
    expect(engine.palettes.primary[500]).toBeDefined();
    expect(engine.palettes.primary[50]).toBeDefined();
    expect(engine.palettes.primary[950]).toBeDefined();
  });

  it('should generate theme colors', () => {
    expect(engine.themeColors.background).toBe('#ffffff');
    expect(engine.themeColors.textPrimary).toBe('#111827');
  });

  it('should provide context snapshot', () => {
    const ctx = engine.context;
    expect(ctx.config).toBe(engine.config);
    expect(ctx.themeMode).toBe('light');
    expect(ctx.loading).toBe(false);
    expect(ctx.error).toBeNull();
    expect(ctx.palettes).toBeDefined();
    expect(ctx.themeColors).toBeDefined();
  });

  // Config updates
  it('should update config partially', () => {
    engine.updateConfig({
      text: { brandName: 'NewBrand' },
    } as PartialBrandConfig);

    expect(engine.config.text.brandName).toBe('NewBrand');
    expect(engine.t('brandName')).toBe('NewBrand');
    // Other fields preserved
    expect(engine.config.color.colors.primary).toBe('#3b82f6');
  });

  it('should replace config entirely', () => {
    const newConfig: BrandConfig = {
      ...DEFAULT_BRAND_CONFIG,
      meta: { id: 'replaced', version: '2.0.0' },
      text: { ...DEFAULT_BRAND_CONFIG.text, brandName: 'Replaced' },
    };
    engine.replaceConfig(newConfig);
    expect(engine.config.meta.id).toBe('replaced');
    expect(engine.t('brandName')).toBe('Replaced');
  });

  // Theme switching
  it('should switch theme mode', () => {
    expect(engine.themeMode).toBe('light');
    engine.setThemeMode('dark');
    expect(engine.themeMode).toBe('dark');
    expect(engine.effectiveTheme).toBe('dark');
    expect(engine.themeColors.background).toBe('#0f172a');
  });

  // Events
  it('should emit config-changed event', () => {
    const listener = vi.fn();
    engine.on('config-changed', listener);

    engine.updateConfig({ text: { brandName: 'EventTest' } } as PartialBrandConfig);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].type).toBe('config-changed');
  });

  it('should emit theme-changed event', () => {
    const listener = vi.fn();
    engine.on('theme-changed', listener);

    engine.setThemeMode('dark');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].payload).toBe('dark');
  });

  it('should unsubscribe with returned function', () => {
    const listener = vi.fn();
    const unsub = engine.on('config-changed', listener);

    engine.updateConfig({ text: { brandName: 'Test1' } } as PartialBrandConfig);
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    engine.updateConfig({ text: { brandName: 'Test2' } } as PartialBrandConfig);
    expect(listener).toHaveBeenCalledTimes(1); // not called again
  });

  // Destroy
  it('should clean up on destroy', () => {
    const listener = vi.fn();
    engine.on('config-changed', listener);
    engine.destroy();

    engine.updateConfig({ text: { brandName: 'After Destroy' } } as PartialBrandConfig);
    expect(listener).not.toHaveBeenCalled();
  });
});
