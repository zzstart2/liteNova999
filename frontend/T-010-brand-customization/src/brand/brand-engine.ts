/**
 * 品牌引擎核心
 *
 * 负责协调色彩系统、文案系统、Logo 资源、CSS 变量注入
 * 提供统一的品牌状态管理与事件系统
 */

import type {
  BrandConfig,
  BrandContext,
  BrandColors,
  ThemeMode,
  ThemeColors,
  ColorPalette,
  PartialBrandConfig,
  BrandEventType,
  BrandEvent,
  BrandEventListener,
} from '../types/brand';
import {
  generateAllPalettes,
  generateLightThemeColors,
  generateDarkThemeColors,
  generateCssVariables,
  injectCssVariables,
  clearCssVariables,
} from './color-utils';
import { createTextResolver, type TextResolver } from './text-resolver';
import { deepMerge } from './config-loader';

// ============================================================
// 品牌引擎
// ============================================================

export class BrandEngine {
  private _config: BrandConfig;
  private _themeMode: ThemeMode;
  private _palettes: Record<keyof BrandColors, ColorPalette>;
  private _themeColors: ThemeColors;
  private _textResolver: TextResolver;
  private _cssVars: Record<string, string> = {};
  private _listeners: Map<BrandEventType, Set<BrandEventListener>> = new Map();
  private _mediaQuery: MediaQueryList | null = null;
  private _mediaHandler: ((e: MediaQueryListEvent) => void) | null = null;

  constructor(config: BrandConfig) {
    this._config = config;
    this._themeMode = config.themeMode || 'light';
    this._palettes = this._generatePalettes();
    this._themeColors = this._resolveThemeColors();
    this._textResolver = createTextResolver(config.text);
  }

  // --------------------------------------------------------
  // Getters
  // --------------------------------------------------------

  get config(): BrandConfig {
    return this._config;
  }

  get themeMode(): ThemeMode {
    return this._themeMode;
  }

  get palettes(): Record<keyof BrandColors, ColorPalette> {
    return this._palettes;
  }

  get themeColors(): ThemeColors {
    return this._themeColors;
  }

  get textResolver(): TextResolver {
    return this._textResolver;
  }

  /** 获取当前品牌上下文快照 */
  get context(): BrandContext {
    return {
      config: this._config,
      themeMode: this._themeMode,
      palettes: this._palettes,
      themeColors: this._themeColors,
      loading: false,
      error: null,
    };
  }

  // --------------------------------------------------------
  // 配置更新
  // --------------------------------------------------------

  /**
   * 更新品牌配置（深度合并）
   */
  updateConfig(partial: PartialBrandConfig): void {
    this._config = deepMerge(this._config, partial) as BrandConfig;
    this._rebuild();
    this._emit('config-changed', this._config);
  }

  /**
   * 替换整个品牌配置
   */
  replaceConfig(config: BrandConfig): void {
    this._config = config;
    this._rebuild();
    this._emit('config-changed', this._config);
  }

  // --------------------------------------------------------
  // 主题
  // --------------------------------------------------------

  /**
   * 切换主题模式
   */
  setThemeMode(mode: ThemeMode): void {
    this._themeMode = mode;

    if (mode === 'auto') {
      this._setupAutoTheme();
    } else {
      this._teardownAutoTheme();
    }

    this._themeColors = this._resolveThemeColors();
    this._applyCssVariables();
    this._emit('theme-changed', mode);
  }

  /**
   * 获取当前实际生效的主题（解析 auto）
   */
  get effectiveTheme(): 'light' | 'dark' {
    if (this._themeMode === 'auto') {
      return this._detectSystemTheme();
    }
    return this._themeMode;
  }

  // --------------------------------------------------------
  // CSS 注入
  // --------------------------------------------------------

  /**
   * 将品牌 CSS 变量注入 DOM
   */
  mount(target?: HTMLElement): void {
    this._applyCssVariables(target);

    // 设置 data 属性
    const el = target || document.documentElement;
    el.setAttribute('data-brand', this._config.meta.id);
    el.setAttribute('data-theme', this.effectiveTheme);
  }

  /**
   * 清除注入的 CSS 变量
   */
  unmount(target?: HTMLElement): void {
    if (Object.keys(this._cssVars).length > 0) {
      clearCssVariables(this._cssVars, target || document.documentElement);
    }
    this._teardownAutoTheme();

    const el = target || document.documentElement;
    el.removeAttribute('data-brand');
    el.removeAttribute('data-theme');
  }

  // --------------------------------------------------------
  // 文案快捷方式
  // --------------------------------------------------------

  /**
   * 解析品牌文案
   */
  t(key: string, vars?: Record<string, string>): string {
    return this._textResolver.t(key, vars);
  }

  // --------------------------------------------------------
  // 事件系统
  // --------------------------------------------------------

  on(type: BrandEventType, listener: BrandEventListener): () => void {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type)!.add(listener);

    // 返回取消订阅函数
    return () => {
      this._listeners.get(type)?.delete(listener);
    };
  }

  off(type: BrandEventType, listener: BrandEventListener): void {
    this._listeners.get(type)?.delete(listener);
  }

  // --------------------------------------------------------
  // 销毁
  // --------------------------------------------------------

  destroy(): void {
    this.unmount();
    this._listeners.clear();
  }

  // --------------------------------------------------------
  // Private
  // --------------------------------------------------------

  private _rebuild(): void {
    this._palettes = this._generatePalettes();
    this._themeColors = this._resolveThemeColors();
    this._textResolver = createTextResolver(this._config.text);
  }

  private _generatePalettes(): Record<keyof BrandColors, ColorPalette> {
    if (this._config.color.generatePalettes !== false) {
      return generateAllPalettes(this._config.color.colors);
    }
    // 返回空色阶（仅使用基准色）
    return {} as Record<keyof BrandColors, ColorPalette>;
  }

  private _resolveThemeColors(): ThemeColors {
    const theme = this.effectiveTheme;
    const base =
      theme === 'dark'
        ? generateDarkThemeColors(this._config.color.colors)
        : generateLightThemeColors(this._config.color.colors);

    const overrides =
      theme === 'dark' ? this._config.color.dark : this._config.color.light;

    return overrides ? { ...base, ...overrides } : base;
  }

  private _applyCssVariables(target?: HTMLElement): void {
    // 先清除旧的
    if (Object.keys(this._cssVars).length > 0) {
      clearCssVariables(this._cssVars, target || document.documentElement);
    }

    // 生成新的
    this._cssVars = generateCssVariables(
      this._config.color.colors,
      this._palettes,
      this._themeColors,
      this._config.color.borderRadius,
      this._config.customCssVars
    );

    // 注入
    injectCssVariables(this._cssVars, target || document.documentElement);

    // 更新 data-theme
    const el = target || document.documentElement;
    el.setAttribute('data-theme', this.effectiveTheme);
  }

  private _detectSystemTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private _setupAutoTheme(): void {
    if (typeof window === 'undefined') return;

    this._teardownAutoTheme();

    this._mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this._mediaHandler = () => {
      this._themeColors = this._resolveThemeColors();
      this._applyCssVariables();
      this._emit('theme-changed', this._themeMode);
    };

    this._mediaQuery.addEventListener('change', this._mediaHandler);
  }

  private _teardownAutoTheme(): void {
    if (this._mediaQuery && this._mediaHandler) {
      this._mediaQuery.removeEventListener('change', this._mediaHandler);
      this._mediaQuery = null;
      this._mediaHandler = null;
    }
  }

  private _emit(type: BrandEventType, payload?: unknown): void {
    const event: BrandEvent = { type, payload, timestamp: Date.now() };
    this._listeners.get(type)?.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error(`[BrandEngine] Event listener error (${type}):`, err);
      }
    });
  }
}

/**
 * 创建品牌引擎实例
 */
export function createBrandEngine(config: BrandConfig): BrandEngine {
  return new BrandEngine(config);
}
