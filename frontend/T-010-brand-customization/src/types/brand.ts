/**
 * PRJ-LITE999-T-010 品牌定制化配置系统 - 类型定义
 *
 * 完整的品牌配置类型体系，涵盖色彩、Logo、文案、元信息等
 */

// ============================================================
// 色彩系统
// ============================================================

/** 色阶级别 */
export type ColorShade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

/** 带色阶的颜色面板 */
export type ColorPalette = Record<ColorShade, string>;

/** 语义化色彩 Token */
export interface BrandColors {
  /** 主色 */
  primary: string;
  /** 辅色 */
  secondary: string;
  /** 强调色 */
  accent: string;
  /** 成功 */
  success: string;
  /** 警告 */
  warning: string;
  /** 危险/错误 */
  danger: string;
  /** 信息 */
  info: string;
  /** 中性色（灰阶基准） */
  neutral: string;
}

/** 主题模式 */
export type ThemeMode = 'light' | 'dark' | 'auto';

/** 主题色彩配置 */
export interface ThemeColors {
  /** 背景色 */
  background: string;
  /** 表面色（卡片、弹窗等） */
  surface: string;
  /** 主要文字色 */
  textPrimary: string;
  /** 次要文字色 */
  textSecondary: string;
  /** 禁用文字色 */
  textDisabled: string;
  /** 边框色 */
  border: string;
  /** 分割线色 */
  divider: string;
  /** 遮罩色 */
  overlay: string;
}

/** 完整色彩配置 */
export interface BrandColorConfig {
  /** 语义色彩 */
  colors: BrandColors;
  /** 亮色主题覆盖 */
  light?: Partial<ThemeColors>;
  /** 暗色主题覆盖 */
  dark?: Partial<ThemeColors>;
  /** 圆角基准值 (px) */
  borderRadius?: number;
  /** 是否自动生成色阶 */
  generatePalettes?: boolean;
}

// ============================================================
// Logo 资源
// ============================================================

/** Logo 变体类型 */
export type LogoVariant = 'full' | 'icon' | 'text';

/** Logo 适配的主题 */
export type LogoThemeVariant = 'light' | 'dark';

/** 单个 Logo 资源 */
export interface LogoAsset {
  /** SVG 字符串 / URL / Base64 Data URI */
  src: string;
  /** 资源类型 */
  type: 'svg' | 'url' | 'base64';
  /** 宽度 (px，可选) */
  width?: number;
  /** 高度 (px，可选) */
  height?: number;
  /** 替代文字 */
  alt?: string;
}

/** Logo 配置 */
export interface BrandLogoConfig {
  /** 完整 Logo（图标+文字） */
  full?: LogoAsset;
  /** 仅图标 */
  icon?: LogoAsset;
  /** 仅文字 */
  text?: LogoAsset;
  /** 暗色主题变体 */
  dark?: {
    full?: LogoAsset;
    icon?: LogoAsset;
    text?: LogoAsset;
  };
  /** Favicon URL */
  favicon?: string;
}

// ============================================================
// 文案系统
// ============================================================

/** 文案映射表（支持嵌套） */
export type BrandTextMap = {
  [key: string]: string | BrandTextMap;
};

/** 品牌文案配置 */
export interface BrandTextConfig {
  /** 品牌名称 */
  brandName: string;
  /** 品牌标语 */
  slogan?: string;
  /** 版权信息模板, 支持 {year} {brandName} 插值 */
  copyright?: string;
  /** 应用名称 */
  appName?: string;
  /** 应用描述 */
  appDescription?: string;
  /** 自定义文案映射 */
  texts?: BrandTextMap;
}

// ============================================================
// 品牌元信息
// ============================================================

export interface BrandMeta {
  /** 品牌唯一标识 */
  id: string;
  /** 品牌版本号 */
  version?: string;
  /** 品牌所属租户/组织 */
  tenantId?: string;
  /** 最后更新时间 (ISO 8601) */
  updatedAt?: string;
}

// ============================================================
// 完整品牌配置
// ============================================================

export interface BrandConfig {
  /** 品牌元信息 */
  meta: BrandMeta;
  /** 色彩配置 */
  color: BrandColorConfig;
  /** Logo 配置 */
  logo: BrandLogoConfig;
  /** 文案配置 */
  text: BrandTextConfig;
  /** 当前主题模式 */
  themeMode?: ThemeMode;
  /** 自定义 CSS 变量（直接注入） */
  customCssVars?: Record<string, string>;
}

/** 品牌配置的深度 Partial 版本，用于覆盖/合并 */
export type PartialBrandConfig = DeepPartial<BrandConfig>;

// ============================================================
// 工具类型
// ============================================================

/** 深度 Partial */
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

/** 配置加载来源 */
export type ConfigSource = 'default' | 'static' | 'remote' | 'runtime';

/** 配置加载选项 */
export interface ConfigLoadOptions {
  /** 远程配置 URL */
  remoteUrl?: string;
  /** 远程配置请求头 */
  remoteHeaders?: Record<string, string>;
  /** 缓存 key（localStorage） */
  cacheKey?: string;
  /** 缓存过期时间 (ms), 默认 24h */
  cacheTTL?: number;
  /** 静态配置覆盖 */
  staticOverrides?: PartialBrandConfig;
  /** 加载超时 (ms) */
  timeout?: number;
}

/** 品牌上下文（运行时状态） */
export interface BrandContext {
  /** 当前生效的完整配置 */
  config: BrandConfig;
  /** 当前主题模式 */
  themeMode: ThemeMode;
  /** 已解析的色阶 */
  palettes: Record<keyof BrandColors, ColorPalette>;
  /** 当前主题色 */
  themeColors: ThemeColors;
  /** 是否正在加载远程配置 */
  loading: boolean;
  /** 加载错误 */
  error: Error | null;
}

/** 品牌事件类型 */
export type BrandEventType = 'config-changed' | 'theme-changed' | 'config-loaded' | 'config-error';

/** 品牌事件 */
export interface BrandEvent {
  type: BrandEventType;
  payload?: unknown;
  timestamp: number;
}

/** 品牌事件监听器 */
export type BrandEventListener = (event: BrandEvent) => void;
