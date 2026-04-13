/**
 * liteNova999 Design System — Barrel Exports
 *
 * Import from this file for tree-shakeable access to all design system modules.
 *
 * @example
 * ```ts
 * import { LnButton, useTheme, colors, designTokens } from '@/design-system';
 * ```
 */

// ─── Types ───────────────────────────────────────────────────
export type {
  // Token types
  DesignTokens,
  ColorTokens,
  PrimaryColorScale,
  SecondaryColors,
  SemanticColors,
  NeutralColorScale,
  TypographyTokens,
  FontFamilyTokens,
  FontSizeKey,
  FontSizeTokens,
  LineHeightKey,
  LineHeightTokens,
  FontWeightKey,
  FontWeightTokens,
  LetterSpacingKey,
  LetterSpacingTokens,
  SpacingKey,
  SpacingTokens,
  RadiusKey,
  RadiusTokens,
  ShadowKey,
  ShadowTokens,
  DurationKey,
  DurationTokens,
  EasingKey,
  EasingTokens,
  TransitionTokens,
  ZIndexKey,
  ZIndexTokens,
  BreakpointKey,
  BreakpointTokens,
  LayoutTokens,
  IconSizeKey,
  IconSizeSpec,
  IconSizeTokens,
  ThemeMode,
  ThemeColors,
  ThemeConfig,
  // Component prop types
  ButtonVariant,
  ButtonSize,
  InputSize,
  BadgeVariant,
  ModalSize,
  ToastType,
} from './types/design-tokens';

// ─── Token Objects ───────────────────────────────────────────
export {
  colors,
  typography,
  spacing,
  radius,
  shadow,
  transition,
  zIndex,
  breakpoint,
  layout,
  iconSize,
  themeConfig,
  designTokens,
} from './tokens/tokens';

// ─── Theme Manager ───────────────────────────────────────────
export {
  resolveTheme,
  getSystemPreference,
  prefersReducedMotion,
  getPersistedMode,
  persistMode,
  applyTheme,
  setThemeMode,
  toggleTheme,
  initTheme,
} from './themes/theme-manager';

// ─── Composables ─────────────────────────────────────────────
export { useTheme } from './composables/use-theme';
export type { UseThemeReturn } from './composables/use-theme';

export { useToast } from './composables/use-toast';
export type { UseToastReturn, ToastItem, ToastOptions } from './composables/use-toast';

export { useModal } from './composables/use-modal';
export type { UseModalReturn, UseModalOptions } from './composables/use-modal';

export { useReducedMotion } from './composables/use-reduced-motion';
export type { UseReducedMotionReturn } from './composables/use-reduced-motion';

// ─── Components ──────────────────────────────────────────────
export { default as LnButton } from './components/LnButton.vue';
export { default as LnInput } from './components/LnInput.vue';
export { default as LnCard } from './components/LnCard.vue';
export { default as LnBadge } from './components/LnBadge.vue';
export { default as LnIcon } from './components/LnIcon.vue';
export { default as LnModal } from './components/LnModal.vue';
export { default as LnToast } from './components/LnToast.vue';
export { default as LnNavbar } from './components/LnNavbar.vue';
export { default as LnTable } from './components/LnTable.vue';
