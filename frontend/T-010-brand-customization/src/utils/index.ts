/**
 * 品牌系统公共工具
 */

export { hexToRgb, rgbToHex, hexToHsl, hslToHex } from '../brand/color-utils';
export { generatePalette, generateAllPalettes } from '../brand/color-utils';
export { getContrastTextColor, contrastRatio, relativeLuminance } from '../brand/color-utils';
export { generateCssVariables, injectCssVariables, clearCssVariables } from '../brand/color-utils';
export { createTextResolver } from '../brand/text-resolver';
export { getByPath, interpolate } from '../brand/text-resolver';
export { deepMerge, validateConfig, loadBrandConfig, loadBrandConfigSync } from '../brand/config-loader';
