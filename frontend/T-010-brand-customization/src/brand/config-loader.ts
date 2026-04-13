/**
 * 品牌配置加载器
 *
 * 实现多层配置合并：默认 → 静态覆盖 → 远程配置 → 运行时覆盖
 * 支持远程加载、本地缓存、配置校验
 */

import type {
  BrandConfig,
  PartialBrandConfig,
  ConfigLoadOptions,
  ConfigSource,
} from '../types/brand';
import { DEFAULT_BRAND_CONFIG } from './default-config';

// ============================================================
// 深度合并
// ============================================================

/**
 * 深度合并两个对象（immutable，返回新对象）
 * source 中的非 undefined 值会覆盖 target
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T> | undefined
): T {
  if (!source) return { ...target };

  const result = { ...target } as Record<string, unknown>;

  for (const key of Object.keys(source)) {
    const sourceVal = (source as Record<string, unknown>)[key];
    const targetVal = result[key];

    if (sourceVal === undefined) continue;

    if (
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      );
    } else {
      result[key] = sourceVal;
    }
  }

  return result as T;
}

// ============================================================
// 缓存
// ============================================================

interface CacheEntry {
  data: PartialBrandConfig;
  timestamp: number;
  ttl: number;
}

const DEFAULT_CACHE_KEY = '__brand_config_cache__';
const DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

function getCachedConfig(cacheKey: string): PartialBrandConfig | null {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;

    const entry: CacheEntry = JSON.parse(raw);
    const now = Date.now();

    if (now - entry.timestamp > entry.ttl) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

function setCachedConfig(
  cacheKey: string,
  data: PartialBrandConfig,
  ttl: number
): void {
  try {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    // localStorage 不可用或已满，静默忽略
  }
}

// ============================================================
// 远程加载
// ============================================================

async function fetchRemoteConfig(
  url: string,
  headers?: Record<string, string>,
  timeout = 5000
): Promise<PartialBrandConfig> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Remote config fetch failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as PartialBrandConfig;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// 配置校验
// ============================================================

export interface ConfigValidationError {
  path: string;
  message: string;
}

/**
 * 基础配置校验（不依赖 Zod，可独立使用）
 */
export function validateConfig(config: unknown): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];

  if (!config || typeof config !== 'object') {
    errors.push({ path: '', message: 'Config must be an object' });
    return errors;
  }

  const c = config as Record<string, unknown>;

  // meta.id 必须
  if (c.meta && typeof c.meta === 'object') {
    const meta = c.meta as Record<string, unknown>;
    if (!meta.id || typeof meta.id !== 'string') {
      errors.push({ path: 'meta.id', message: 'meta.id is required and must be a string' });
    }
  }

  // color.colors 颜色值校验
  if (c.color && typeof c.color === 'object') {
    const color = c.color as Record<string, unknown>;
    if (color.colors && typeof color.colors === 'object') {
      const colors = color.colors as Record<string, unknown>;
      const hexRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
      for (const [key, val] of Object.entries(colors)) {
        if (typeof val === 'string' && !hexRegex.test(val)) {
          errors.push({
            path: `color.colors.${key}`,
            message: `Invalid hex color: "${val}"`,
          });
        }
      }
    }
  }

  // text.brandName 必须
  if (c.text && typeof c.text === 'object') {
    const text = c.text as Record<string, unknown>;
    if (!text.brandName || typeof text.brandName !== 'string') {
      errors.push({
        path: 'text.brandName',
        message: 'text.brandName is required and must be a string',
      });
    }
  }

  return errors;
}

// ============================================================
// 配置加载器
// ============================================================

export interface ConfigLoaderResult {
  config: BrandConfig;
  sources: ConfigSource[];
  warnings: string[];
}

/**
 * 加载并合并品牌配置
 *
 * 合并顺序：默认 → 静态覆盖 → 远程（或缓存） → 运行时覆盖
 */
export async function loadBrandConfig(
  options: ConfigLoadOptions = {},
  runtimeOverrides?: PartialBrandConfig
): Promise<ConfigLoaderResult> {
  const sources: ConfigSource[] = ['default'];
  const warnings: string[] = [];

  // 1. 从默认配置开始
  let merged: BrandConfig = { ...DEFAULT_BRAND_CONFIG };

  // 2. 合并静态覆盖
  if (options.staticOverrides) {
    merged = deepMerge(merged, options.staticOverrides) as BrandConfig;
    sources.push('static');
  }

  // 3. 远程配置
  if (options.remoteUrl) {
    const cacheKey = options.cacheKey || DEFAULT_CACHE_KEY;
    const cacheTTL = options.cacheTTL || DEFAULT_CACHE_TTL;

    // 先尝试远程
    try {
      const remoteConfig = await fetchRemoteConfig(
        options.remoteUrl,
        options.remoteHeaders,
        options.timeout
      );
      merged = deepMerge(merged, remoteConfig) as BrandConfig;
      sources.push('remote');

      // 远程成功，更新缓存
      setCachedConfig(cacheKey, remoteConfig, cacheTTL);
    } catch (err) {
      // 远程失败，尝试缓存
      const cached = getCachedConfig(cacheKey);
      if (cached) {
        merged = deepMerge(merged, cached) as BrandConfig;
        warnings.push(
          `Remote config failed, using cache. Error: ${err instanceof Error ? err.message : String(err)}`
        );
      } else {
        warnings.push(
          `Remote config failed, no cache available. Error: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  // 4. 运行时覆盖
  if (runtimeOverrides) {
    merged = deepMerge(merged, runtimeOverrides) as BrandConfig;
    sources.push('runtime');
  }

  // 5. 校验
  const validationErrors = validateConfig(merged);
  if (validationErrors.length > 0) {
    warnings.push(
      ...validationErrors.map((e) => `Validation: [${e.path}] ${e.message}`)
    );
  }

  return { config: merged, sources, warnings };
}

/**
 * 同步加载品牌配置（不含远程，用于 SSR 或初始渲染）
 */
export function loadBrandConfigSync(
  staticOverrides?: PartialBrandConfig,
  runtimeOverrides?: PartialBrandConfig
): BrandConfig {
  let config: BrandConfig = { ...DEFAULT_BRAND_CONFIG };

  if (staticOverrides) {
    config = deepMerge(config, staticOverrides) as BrandConfig;
  }
  if (runtimeOverrides) {
    config = deepMerge(config, runtimeOverrides) as BrandConfig;
  }

  return config;
}
