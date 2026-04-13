/**
 * 品牌文案解析器
 *
 * 支持嵌套 key 路径访问、模板变量插值、fallback
 */

import type { BrandTextConfig, BrandTextMap } from '../types/brand';

// ============================================================
// 路径访问
// ============================================================

/**
 * 通过点分隔路径访问嵌套对象
 *
 * @example
 * getByPath({ footer: { copyright: '© {year}' } }, 'footer.copyright')
 * // => '© {year}'
 */
export function getByPath(obj: BrandTextMap | undefined, path: string): string | undefined {
  if (!obj) return undefined;

  const keys = path.split('.');
  let current: BrandTextMap | string | undefined = obj;

  for (const key of keys) {
    if (current === undefined || current === null || typeof current === 'string') {
      return undefined;
    }
    current = (current as BrandTextMap)[key];
  }

  return typeof current === 'string' ? current : undefined;
}

// ============================================================
// 模板插值
// ============================================================

/** 内置变量生成器 */
function getBuiltinVariables(config: BrandTextConfig): Record<string, string> {
  return {
    year: new Date().getFullYear().toString(),
    brandName: config.brandName,
    appName: config.appName || config.brandName,
    slogan: config.slogan || '',
  };
}

/**
 * 模板变量插值
 *
 * 支持 {variableName} 语法，内置 + 自定义变量
 *
 * @example
 * interpolate('© {year} {brandName}', { year: '2024', brandName: 'Acme' })
 * // => '© 2024 Acme'
 */
export function interpolate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

// ============================================================
// 文案解析器
// ============================================================

export interface TextResolverOptions {
  /** 自定义插值变量 */
  variables?: Record<string, string>;
  /** 找不到 key 时的 fallback 行为 */
  fallback?: 'key' | 'empty' | 'throw';
}

/**
 * 创建文案解析器
 *
 * @example
 * const resolver = createTextResolver(textConfig);
 * resolver.t('footer.copyright');        // '© 2024 Acme Corp'
 * resolver.t('custom.greeting', { name: 'Alice' }); // 'Hello, Alice!'
 */
export function createTextResolver(
  config: BrandTextConfig,
  options: TextResolverOptions = {}
) {
  const { variables: extraVars = {}, fallback = 'key' } = options;

  /** 获取完整变量表 */
  function getVariables(overrides?: Record<string, string>): Record<string, string> {
    return {
      ...getBuiltinVariables(config),
      ...extraVars,
      ...overrides,
    };
  }

  /**
   * 解析文案
   *
   * @param key - 文案 key，支持点分隔路径 或 顶层快捷名
   * @param vars - 额外插值变量
   */
  function t(key: string, vars?: Record<string, string>): string {
    // 1. 先查快捷顶层字段
    let raw: string | undefined;
    switch (key) {
      case 'brandName':
        raw = config.brandName;
        break;
      case 'slogan':
        raw = config.slogan;
        break;
      case 'copyright':
        raw = config.copyright;
        break;
      case 'appName':
        raw = config.appName;
        break;
      case 'appDescription':
        raw = config.appDescription;
        break;
      default:
        // 2. 从 texts 映射中查找
        raw = getByPath(config.texts, key);
    }

    // 3. 处理未找到
    if (raw === undefined) {
      switch (fallback) {
        case 'empty':
          return '';
        case 'throw':
          throw new Error(`[BrandText] Key not found: "${key}"`);
        case 'key':
        default:
          return key;
      }
    }

    // 4. 插值
    return interpolate(raw, getVariables(vars));
  }

  /**
   * 检查 key 是否存在
   */
  function has(key: string): boolean {
    const topLevel = ['brandName', 'slogan', 'copyright', 'appName', 'appDescription'];
    if (topLevel.includes(key)) {
      return (config as Record<string, unknown>)[key] !== undefined;
    }
    return getByPath(config.texts, key) !== undefined;
  }

  /**
   * 获取所有自定义文案的 flat key 列表
   */
  function keys(prefix = ''): string[] {
    const result: string[] = [];

    function walk(obj: BrandTextMap, currentPath: string) {
      for (const [k, v] of Object.entries(obj)) {
        const fullPath = currentPath ? `${currentPath}.${k}` : k;
        if (typeof v === 'string') {
          result.push(fullPath);
        } else {
          walk(v, fullPath);
        }
      }
    }

    if (config.texts) {
      walk(config.texts, prefix);
    }

    return result;
  }

  return { t, has, keys, getVariables };
}

export type TextResolver = ReturnType<typeof createTextResolver>;
