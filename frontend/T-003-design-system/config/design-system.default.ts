/**
 * liteNova999 Design System — Default Configuration
 *
 * Override these values in your app config to customize the design system.
 */

import type { ThemeMode } from '../src/types/design-tokens';

export interface DesignSystemConfig {
  /** Default theme mode */
  defaultTheme: ThemeMode;
  /** localStorage key for theme persistence */
  themeStorageKey: string;
  /** Enable smooth theme transition */
  enableTransitions: boolean;
  /** Toast default auto-dismiss duration (ms) */
  toastDuration: number;
  /** Toast maximum visible count */
  toastMaxVisible: number;
  /** CSS class prefix */
  prefix: string;
}

export const defaultConfig: DesignSystemConfig = {
  defaultTheme: 'system',
  themeStorageKey: 'ln-theme-mode',
  enableTransitions: true,
  toastDuration: 5000,
  toastMaxVisible: 5,
  prefix: 'ln',
} as const;

export default defaultConfig;
