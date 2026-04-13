/**
 * liteNova999 Design System — Typed Token Objects
 *
 * Programmatic access to all design tokens with full TypeScript types.
 * Use these when you need token values in JS/TS logic (e.g., dynamic styles, charts).
 * For CSS, prefer the CSS custom properties in tokens/*.css.
 */

import type {
  DesignTokens,
  ColorTokens,
  TypographyTokens,
  SpacingTokens,
  RadiusTokens,
  ShadowTokens,
  TransitionTokens,
  ZIndexTokens,
  BreakpointTokens,
  LayoutTokens,
  IconSizeTokens,
  ThemeConfig,
} from '../types/design-tokens';

// ─── Colors ──────────────────────────────────────────────────

export const colors: ColorTokens = {
  primary: {
    50: '#EEF2FF',
    100: '#DDE5FF',
    200: '#B3C5FF',
    300: '#809CFF',
    400: '#5673FF',
    500: '#3354FF',
    600: '#2440DB',
    700: '#1A30B7',
    800: '#122393',
    900: '#0C1870',
  },
  secondary: {
    cyan: '#00D4AA',
    amber: '#FFB020',
  },
  semantic: {
    success: '#10B981',
    successLight: '#ECFDF5',
    warning: '#F59E0B',
    warningLight: '#FFFBEB',
    error: '#EF4444',
    errorLight: '#FEF2F2',
    info: '#3B82F6',
    infoLight: '#EFF6FF',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
} as const;

// ─── Typography ──────────────────────────────────────────────

export const typography: TypographyTokens = {
  fontFamily: {
    sans: "'Inter', 'Noto Sans SC', 'PingFang SC', system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
  },
  lineHeight: {
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
  },
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
  },
} as const;

// ─── Spacing ─────────────────────────────────────────────────

export const spacing: SpacingTokens = {
  '0': '0',
  '1': '0.25rem',
  '2': '0.5rem',
  '3': '0.75rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '8': '2rem',
  '10': '2.5rem',
  '12': '3rem',
  '16': '4rem',
  '20': '5rem',
} as const;

// ─── Radius ──────────────────────────────────────────────────

export const radius: RadiusTokens = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const;

// ─── Shadows ─────────────────────────────────────────────────

export const shadow: ShadowTokens = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
} as const;

// ─── Transitions ─────────────────────────────────────────────

export const transition: TransitionTokens = {
  duration: {
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  easing: {
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

// ─── Z-Index ─────────────────────────────────────────────────

export const zIndex: ZIndexTokens = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  toast: 1080,
} as const;

// ─── Breakpoints ─────────────────────────────────────────────

export const breakpoint: BreakpointTokens = {
  mobile: '640px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1280px',
} as const;

// ─── Layout ──────────────────────────────────────────────────

export const layout: LayoutTokens = {
  maxContentWidth: '1200px',
} as const;

// ─── Icon Sizes ──────────────────────────────────────────────

export const iconSize: IconSizeTokens = {
  xs: { size: '16px', strokeWidth: '1.5px' },
  sm: { size: '20px', strokeWidth: '1.5px' },
  md: { size: '24px', strokeWidth: '2px' },
  lg: { size: '32px', strokeWidth: '2px' },
  xl: { size: '48px', strokeWidth: '2px' },
} as const;

// ─── Theme Config ────────────────────────────────────────────

export const themeConfig: ThemeConfig = {
  light: {
    bgPage: colors.neutral[0],
    bgCard: colors.neutral[0],
    textPrimary: colors.neutral[800],
    textSecondary: colors.neutral[600],
    border: colors.neutral[200],
    primaryButton: colors.primary[500],
  },
  dark: {
    bgPage: colors.neutral[900],
    bgCard: colors.neutral[800],
    textPrimary: colors.neutral[50],
    textSecondary: colors.neutral[200],
    border: colors.neutral[700],
    primaryButton: colors.primary[400],
  },
} as const;

// ─── Complete Token Set ──────────────────────────────────────

export const designTokens: DesignTokens = {
  color: colors,
  typography,
  spacing,
  radius,
  shadow,
  transition,
  zIndex,
  breakpoint,
  layout,
  iconSize,
} as const;

export default designTokens;
