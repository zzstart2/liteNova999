/**
 * 色彩工具模块测试
 */

import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  rgbToHex,
  hexToHsl,
  hslToHex,
  generatePalette,
  generateAllPalettes,
  getContrastTextColor,
  contrastRatio,
  relativeLuminance,
  generateCssVariables,
  generateLightThemeColors,
} from '../src/brand/color-utils';
import type { BrandColors, ColorShade } from '../src/types/brand';

// ============================================================
// 颜色转换
// ============================================================

describe('hexToRgb', () => {
  it('should convert 6-digit hex', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('should convert 3-digit hex', () => {
    expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('should handle without # prefix', () => {
    expect(hexToRgb('3b82f6')).toEqual({ r: 59, g: 130, b: 246 });
  });
});

describe('rgbToHex', () => {
  it('should convert RGB to hex', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
    expect(rgbToHex({ r: 59, g: 130, b: 246 })).toBe('#3b82f6');
  });

  it('should clamp values', () => {
    expect(rgbToHex({ r: 300, g: -10, b: 128 })).toBe('#ff0080');
  });
});

describe('hexToHsl / hslToHex roundtrip', () => {
  it('should round-trip primary colors', () => {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000'];
    for (const hex of colors) {
      const hsl = hexToHsl(hex);
      const back = hslToHex(hsl);
      // Allow small rounding differences
      const rgb1 = hexToRgb(hex);
      const rgb2 = hexToRgb(back);
      expect(Math.abs(rgb1.r - rgb2.r)).toBeLessThanOrEqual(2);
      expect(Math.abs(rgb1.g - rgb2.g)).toBeLessThanOrEqual(2);
      expect(Math.abs(rgb1.b - rgb2.b)).toBeLessThanOrEqual(2);
    }
  });
});

// ============================================================
// 色阶生成
// ============================================================

describe('generatePalette', () => {
  it('should generate all 11 shades', () => {
    const palette = generatePalette('#3b82f6');
    const shades: ColorShade[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

    for (const shade of shades) {
      expect(palette[shade]).toBeDefined();
      expect(palette[shade]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('should produce lighter shades for lower numbers', () => {
    const palette = generatePalette('#3b82f6');
    // shade 50 should be lighter than shade 500
    const lum50 = relativeLuminance(palette[50]);
    const lum500 = relativeLuminance(palette[500]);
    const lum900 = relativeLuminance(palette[900]);

    expect(lum50).toBeGreaterThan(lum500);
    expect(lum500).toBeGreaterThan(lum900);
  });
});

describe('generateAllPalettes', () => {
  it('should generate palettes for all color keys', () => {
    const colors: BrandColors = {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#f59e0b',
      success: '#22c55e',
      warning: '#f97316',
      danger: '#ef4444',
      info: '#06b6d4',
      neutral: '#6b7280',
    };

    const palettes = generateAllPalettes(colors);
    expect(Object.keys(palettes)).toHaveLength(8);
    expect(palettes.primary[500]).toBeDefined();
    expect(palettes.danger[100]).toBeDefined();
  });
});

// ============================================================
// 对比度 & 无障碍
// ============================================================

describe('contrastRatio', () => {
  it('should return 21:1 for black on white', () => {
    const ratio = contrastRatio('#000000', '#ffffff');
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('should return 1:1 for same color', () => {
    const ratio = contrastRatio('#3b82f6', '#3b82f6');
    expect(ratio).toBeCloseTo(1, 1);
  });

  it('should be symmetric', () => {
    const r1 = contrastRatio('#3b82f6', '#ffffff');
    const r2 = contrastRatio('#ffffff', '#3b82f6');
    expect(r1).toBeCloseTo(r2, 5);
  });
});

describe('getContrastTextColor', () => {
  it('should return white for dark backgrounds', () => {
    expect(getContrastTextColor('#000000')).toBe('#ffffff');
    expect(getContrastTextColor('#1a1a2e')).toBe('#ffffff');
    expect(getContrastTextColor('#333333')).toBe('#ffffff');
  });

  it('should return black for light backgrounds', () => {
    expect(getContrastTextColor('#ffffff')).toBe('#000000');
    expect(getContrastTextColor('#f0f0f0')).toBe('#000000');
    expect(getContrastTextColor('#e0e0e0')).toBe('#000000');
  });
});

// ============================================================
// CSS 变量生成
// ============================================================

describe('generateCssVariables', () => {
  it('should generate semantic color variables', () => {
    const colors: BrandColors = {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#f59e0b',
      success: '#22c55e',
      warning: '#f97316',
      danger: '#ef4444',
      info: '#06b6d4',
      neutral: '#6b7280',
    };
    const palettes = generateAllPalettes(colors);
    const themeColors = generateLightThemeColors(colors);
    const vars = generateCssVariables(colors, palettes, themeColors, 8);

    expect(vars['--brand-primary']).toBe('#3b82f6');
    expect(vars['--brand-danger']).toBe('#ef4444');
    expect(vars['--brand-primary-500']).toBeDefined();
    expect(vars['--brand-primary-50']).toBeDefined();
    expect(vars['--brand-bg']).toBe('#ffffff');
    expect(vars['--brand-radius']).toBe('8px');
    expect(vars['--brand-radius-sm']).toBe('6px');
  });

  it('should include custom CSS vars', () => {
    const colors: BrandColors = {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#f59e0b',
      success: '#22c55e',
      warning: '#f97316',
      danger: '#ef4444',
      info: '#06b6d4',
      neutral: '#6b7280',
    };
    const palettes = generateAllPalettes(colors);
    const themeColors = generateLightThemeColors(colors);
    const vars = generateCssVariables(colors, palettes, themeColors, 8, {
      '--brand-font': 'Inter',
    });

    expect(vars['--brand-font']).toBe('Inter');
  });
});
