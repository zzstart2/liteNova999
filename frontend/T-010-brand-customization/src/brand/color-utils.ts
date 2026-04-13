/**
 * 色彩工具模块
 *
 * 提供 HSL 解析、色阶自动生成、对比度计算等能力
 * 零外部依赖，纯函数实现
 */

import type { ColorShade, ColorPalette, BrandColors, ThemeColors } from '../types/brand';

// ============================================================
// 颜色解析与转换
// ============================================================

interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

/**
 * 将 HEX 颜色转为 RGB
 */
export function hexToRgb(hex: string): RGB {
  const cleaned = hex.replace('#', '');
  const fullHex =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned;

  const num = parseInt(fullHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * 将 RGB 转为 HEX
 */
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * 将 RGB 转为 HSL
 */
export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / delta + 2) / 6;
        break;
      case b:
        h = ((r - g) / delta + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * 将 HSL 转为 RGB
 */
export function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  if (s === 0) {
    const val = Math.round(l * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * 将 HEX 转为 HSL
 */
export function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex));
}

/**
 * 将 HSL 转为 HEX
 */
export function hslToHex(hsl: HSL): string {
  return rgbToHex(hslToRgb(hsl));
}

// ============================================================
// 色阶生成
// ============================================================

/**
 * 色阶级别定义
 * shade -> 目标亮度百分比映射
 */
const SHADE_LIGHTNESS_MAP: Record<ColorShade, number> = {
  50: 97,
  100: 94,
  200: 86,
  300: 77,
  400: 66,
  500: 50,  // 基准色
  600: 42,
  700: 35,
  800: 27,
  900: 20,
  950: 12,
};

/**
 * 从单一基准色生成完整色阶面板
 *
 * @param baseHex - 基准色 HEX 值（如 #3b82f6）
 * @returns 11 级色阶面板
 */
export function generatePalette(baseHex: string): ColorPalette {
  const baseHsl = hexToHsl(baseHex);
  const palette = {} as ColorPalette;

  const shades = Object.keys(SHADE_LIGHTNESS_MAP).map(Number) as ColorShade[];

  for (const shade of shades) {
    const targetL = SHADE_LIGHTNESS_MAP[shade];

    // 色相微调：深色略暖，浅色略冷（更自然的感觉）
    const hueShift = shade < 500 ? (500 - shade) * 0.01 : (500 - shade) * 0.005;
    const h = Math.round(baseHsl.h + hueShift) % 360;

    // 饱和度调整：极浅/极深的色彩饱和度降低
    const distanceFromMid = Math.abs(shade - 500) / 500;
    const satAdjust = 1 - distanceFromMid * 0.15;
    const s = Math.round(Math.min(100, baseHsl.s * satAdjust));

    palette[shade] = hslToHex({ h, s, l: targetL });
  }

  return palette;
}

/**
 * 批量生成所有语义色的色阶
 */
export function generateAllPalettes(
  colors: BrandColors
): Record<keyof BrandColors, ColorPalette> {
  const result = {} as Record<keyof BrandColors, ColorPalette>;
  const keys = Object.keys(colors) as (keyof BrandColors)[];

  for (const key of keys) {
    result[key] = generatePalette(colors[key]);
  }

  return result;
}

// ============================================================
// 主题色彩生成
// ============================================================

/** 默认亮色主题色 */
export function generateLightThemeColors(colors: BrandColors): ThemeColors {
  return {
    background: '#ffffff',
    surface: '#f9fafb',
    textPrimary: '#111827',
    textSecondary: '#6b7280',
    textDisabled: '#d1d5db',
    border: '#e5e7eb',
    divider: '#f3f4f6',
    overlay: 'rgba(0, 0, 0, 0.5)',
  };
}

/** 默认暗色主题色 */
export function generateDarkThemeColors(colors: BrandColors): ThemeColors {
  return {
    background: '#0f172a',
    surface: '#1e293b',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    textDisabled: '#475569',
    border: '#334155',
    divider: '#1e293b',
    overlay: 'rgba(0, 0, 0, 0.7)',
  };
}

// ============================================================
// 对比度与无障碍
// ============================================================

/**
 * 计算相对亮度 (WCAG 2.0)
 */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * 计算两种颜色的对比度
 * WCAG AA: >= 4.5:1 (正文) / >= 3:1 (大文字)
 * WCAG AAA: >= 7:1 (正文) / >= 4.5:1 (大文字)
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 判断给定背景色上，白色还是黑色文字对比度更高
 */
export function getContrastTextColor(bgHex: string): '#ffffff' | '#000000' {
  const lum = relativeLuminance(bgHex);
  return lum > 0.179 ? '#000000' : '#ffffff';
}

// ============================================================
// CSS 变量生成
// ============================================================

/**
 * 将品牌色彩配置转换为 CSS 自定义属性
 */
export function generateCssVariables(
  colors: BrandColors,
  palettes: Record<keyof BrandColors, ColorPalette>,
  themeColors: ThemeColors,
  borderRadius?: number,
  customVars?: Record<string, string>
): Record<string, string> {
  const vars: Record<string, string> = {};

  // 语义色
  const colorKeys = Object.keys(colors) as (keyof BrandColors)[];
  for (const key of colorKeys) {
    vars[`--brand-${key}`] = colors[key];

    // 色阶
    const palette = palettes[key];
    if (palette) {
      const shades = Object.keys(palette).map(Number) as ColorShade[];
      for (const shade of shades) {
        vars[`--brand-${key}-${shade}`] = palette[shade];
      }
    }
  }

  // 主题色
  vars['--brand-bg'] = themeColors.background;
  vars['--brand-surface'] = themeColors.surface;
  vars['--brand-text-primary'] = themeColors.textPrimary;
  vars['--brand-text-secondary'] = themeColors.textSecondary;
  vars['--brand-text-disabled'] = themeColors.textDisabled;
  vars['--brand-border'] = themeColors.border;
  vars['--brand-divider'] = themeColors.divider;
  vars['--brand-overlay'] = themeColors.overlay;

  // 圆角
  if (borderRadius !== undefined) {
    vars['--brand-radius'] = `${borderRadius}px`;
    vars['--brand-radius-sm'] = `${Math.max(0, borderRadius - 2)}px`;
    vars['--brand-radius-lg'] = `${borderRadius + 4}px`;
    vars['--brand-radius-xl'] = `${borderRadius + 8}px`;
    vars['--brand-radius-full'] = '9999px';
  }

  // 自定义
  if (customVars) {
    Object.assign(vars, customVars);
  }

  return vars;
}

/**
 * 将 CSS 变量注入到 DOM 元素
 */
export function injectCssVariables(
  vars: Record<string, string>,
  target: HTMLElement = document.documentElement
): void {
  for (const [key, value] of Object.entries(vars)) {
    target.style.setProperty(key, value);
  }
}

/**
 * 清除品牌 CSS 变量
 */
export function clearCssVariables(
  vars: Record<string, string>,
  target: HTMLElement = document.documentElement
): void {
  for (const key of Object.keys(vars)) {
    target.style.removeProperty(key);
  }
}
