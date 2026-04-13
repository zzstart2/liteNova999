/**
 * liteNova999 Design System — TypeScript Token Types
 *
 * Comprehensive type definitions for all design tokens.
 * Enables type-safe programmatic access to the design system.
 */

// ─── Color Tokens ────────────────────────────────────────────

export interface PrimaryColorScale {
  readonly 50: string;
  readonly 100: string;
  readonly 200: string;
  readonly 300: string;
  readonly 400: string;
  readonly 500: string;
  readonly 600: string;
  readonly 700: string;
  readonly 800: string;
  readonly 900: string;
}

export interface SecondaryColors {
  readonly cyan: string;
  readonly amber: string;
}

export interface SemanticColors {
  readonly success: string;
  readonly successLight: string;
  readonly warning: string;
  readonly warningLight: string;
  readonly error: string;
  readonly errorLight: string;
  readonly info: string;
  readonly infoLight: string;
}

export interface NeutralColorScale {
  readonly 0: string;
  readonly 50: string;
  readonly 100: string;
  readonly 200: string;
  readonly 300: string;
  readonly 400: string;
  readonly 500: string;
  readonly 600: string;
  readonly 700: string;
  readonly 800: string;
  readonly 900: string;
}

export interface ColorTokens {
  readonly primary: PrimaryColorScale;
  readonly secondary: SecondaryColors;
  readonly semantic: SemanticColors;
  readonly neutral: NeutralColorScale;
}

// ─── Typography Tokens ───────────────────────────────────────

export interface FontFamilyTokens {
  readonly sans: string;
  readonly mono: string;
}

export type FontSizeKey = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
export type FontSizeTokens = Readonly<Record<FontSizeKey, string>>;

export type LineHeightKey = 'tight' | 'snug' | 'normal' | 'relaxed';
export type LineHeightTokens = Readonly<Record<LineHeightKey, number>>;

export type FontWeightKey = 'light' | 'regular' | 'medium' | 'semibold' | 'bold';
export type FontWeightTokens = Readonly<Record<FontWeightKey, number>>;

export type LetterSpacingKey = 'tight' | 'normal' | 'wide';
export type LetterSpacingTokens = Readonly<Record<LetterSpacingKey, string>>;

export interface TypographyTokens {
  readonly fontFamily: FontFamilyTokens;
  readonly fontSize: FontSizeTokens;
  readonly lineHeight: LineHeightTokens;
  readonly fontWeight: FontWeightTokens;
  readonly letterSpacing: LetterSpacingTokens;
}

// ─── Spacing Tokens ──────────────────────────────────────────

export type SpacingKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '8' | '10' | '12' | '16' | '20';
export type SpacingTokens = Readonly<Record<SpacingKey, string>>;

// ─── Border Radius Tokens ────────────────────────────────────

export type RadiusKey = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
export type RadiusTokens = Readonly<Record<RadiusKey, string>>;

// ─── Shadow Tokens ───────────────────────────────────────────

export type ShadowKey = 'sm' | 'md' | 'lg' | 'xl' | 'inner';
export type ShadowTokens = Readonly<Record<ShadowKey, string>>;

// ─── Transition Tokens ───────────────────────────────────────

export type DurationKey = 'fast' | 'normal' | 'slow' | 'slower';
export type DurationTokens = Readonly<Record<DurationKey, string>>;

export type EasingKey = 'out' | 'in' | 'inOut' | 'spring';
export type EasingTokens = Readonly<Record<EasingKey, string>>;

export interface TransitionTokens {
  readonly duration: DurationTokens;
  readonly easing: EasingTokens;
}

// ─── Z-Index Tokens ──────────────────────────────────────────

export type ZIndexKey = 'dropdown' | 'sticky' | 'fixed' | 'modalBackdrop' | 'modal' | 'popover' | 'tooltip' | 'toast';
export type ZIndexTokens = Readonly<Record<ZIndexKey, number>>;

// ─── Breakpoint Tokens ───────────────────────────────────────

export type BreakpointKey = 'mobile' | 'tablet' | 'desktop' | 'wide';
export type BreakpointTokens = Readonly<Record<BreakpointKey, string>>;

// ─── Layout Tokens ───────────────────────────────────────────

export interface LayoutTokens {
  readonly maxContentWidth: string;
}

// ─── Icon Size Tokens ────────────────────────────────────────

export type IconSizeKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface IconSizeSpec {
  readonly size: string;
  readonly strokeWidth: string;
}

export type IconSizeTokens = Readonly<Record<IconSizeKey, IconSizeSpec>>;

// ─── Complete Design Tokens ──────────────────────────────────

export interface DesignTokens {
  readonly color: ColorTokens;
  readonly typography: TypographyTokens;
  readonly spacing: SpacingTokens;
  readonly radius: RadiusTokens;
  readonly shadow: ShadowTokens;
  readonly transition: TransitionTokens;
  readonly zIndex: ZIndexTokens;
  readonly breakpoint: BreakpointTokens;
  readonly layout: LayoutTokens;
  readonly iconSize: IconSizeTokens;
}

// ─── Theme Types ─────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  readonly bgPage: string;
  readonly bgCard: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly border: string;
  readonly primaryButton: string;
}

export interface ThemeConfig {
  readonly light: ThemeColors;
  readonly dark: ThemeColors;
}

// ─── Component Token Types ───────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type InputSize = 'md' | 'lg';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';

export type ModalSize = 'md' | 'lg';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
