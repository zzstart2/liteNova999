/**
 * useBrandColor - 品牌色彩专用 Hook
 *
 * 便捷访问色彩 token、色阶、主题色，以及生成色彩相关的 CSS class
 */

import { computed, type ComputedRef } from 'vue';
import type { BrandColors, ColorPalette, ColorShade, ThemeColors } from '../types/brand';
import { getContrastTextColor, contrastRatio } from '../brand/color-utils';
import { useBrandInjection } from '../brand/brand-provider';

export interface UseBrandColorReturn {
  /** 语义色彩 */
  colors: ComputedRef<BrandColors>;
  /** 所有色阶 */
  palettes: ComputedRef<Record<keyof BrandColors, ColorPalette>>;
  /** 当前主题色 */
  themeColors: ComputedRef<ThemeColors>;
  /** 获取某色彩的指定色阶 */
  getShade: (color: keyof BrandColors, shade: ColorShade) => string;
  /** 获取某色彩在指定背景上的最佳文字色 */
  getTextColor: (bgColor: string) => '#ffffff' | '#000000';
  /** 获取两种颜色的对比度 */
  getContrast: (color1: string, color2: string) => number;
  /** 生成 CSS 变量引用 */
  cssVar: (token: string) => string;
}

export function useBrandColor(): UseBrandColorReturn {
  const injection = useBrandInjection();

  const colors = computed(() => injection.context.config.color.colors);
  const palettes = computed(() => injection.context.palettes);
  const themeColors = computed(() => injection.context.themeColors);

  function getShade(color: keyof BrandColors, shade: ColorShade): string {
    const palette = palettes.value[color];
    if (!palette) return colors.value[color]; // fallback 到基准色
    return palette[shade] || colors.value[color];
  }

  function getTextColor(bgColor: string): '#ffffff' | '#000000' {
    return getContrastTextColor(bgColor);
  }

  function getContrast(color1: string, color2: string): number {
    return contrastRatio(color1, color2);
  }

  function cssVar(token: string): string {
    return `var(--brand-${token})`;
  }

  return {
    colors,
    palettes,
    themeColors,
    getShade,
    getTextColor,
    getContrast,
    cssVar,
  };
}
