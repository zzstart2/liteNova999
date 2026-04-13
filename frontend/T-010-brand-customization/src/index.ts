/**
 * 品牌定制化配置系统 - 统一导出
 *
 * @module @lite999/brand
 */

// Types
export type {
  BrandConfig,
  PartialBrandConfig,
  BrandColors,
  BrandColorConfig,
  ThemeColors,
  ThemeMode,
  ColorShade,
  ColorPalette,
  BrandLogoConfig,
  LogoAsset,
  LogoVariant,
  LogoThemeVariant,
  BrandTextConfig,
  BrandTextMap,
  BrandMeta,
  BrandContext,
  BrandEvent,
  BrandEventType,
  BrandEventListener,
  ConfigLoadOptions,
  ConfigSource,
  DeepPartial,
} from './types/brand';

// Engine
export { BrandEngine, createBrandEngine } from './brand/brand-engine';

// Config
export { DEFAULT_BRAND_CONFIG } from './brand/default-config';
export { loadBrandConfig, loadBrandConfigSync, deepMerge, validateConfig } from './brand/config-loader';
export type { ConfigLoaderResult, ConfigValidationError } from './brand/config-loader';

// Color utilities
export {
  hexToRgb,
  rgbToHex,
  hexToHsl,
  hslToHex,
  rgbToHsl,
  hslToRgb,
  generatePalette,
  generateAllPalettes,
  generateLightThemeColors,
  generateDarkThemeColors,
  generateCssVariables,
  injectCssVariables,
  clearCssVariables,
  relativeLuminance,
  contrastRatio,
  getContrastTextColor,
} from './brand/color-utils';

// Text resolver
export { createTextResolver, getByPath, interpolate } from './brand/text-resolver';
export type { TextResolver, TextResolverOptions } from './brand/text-resolver';

// Vue Provider
export { BrandProvider, useBrandInjection, BRAND_INJECTION_KEY } from './brand/brand-provider';
export type { BrandInjection } from './brand/brand-provider';

// Hooks
export { useBrand } from './hooks/use-brand';
export type { UseBrandReturn } from './hooks/use-brand';
export { useBrandColor } from './hooks/use-brand-color';
export type { UseBrandColorReturn } from './hooks/use-brand-color';
export { useBrandText } from './hooks/use-brand-text';
export type { UseBrandTextReturn } from './hooks/use-brand-text';

// Components (import individually for tree-shaking)
// import BrandLogo from '@lite999/brand/components/BrandLogo.vue'
// import BrandText from '@lite999/brand/components/BrandText.vue'
// import BrandColorPreview from '@lite999/brand/components/BrandColorPreview.vue'
