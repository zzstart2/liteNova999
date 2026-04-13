/**
 * useBrandText - 品牌文案专用 Hook
 *
 * 便捷访问品牌名称、slogan、自定义文案等
 */

import { computed, type ComputedRef } from 'vue';
import type { BrandTextConfig } from '../types/brand';
import { useBrandInjection } from '../brand/brand-provider';

export interface UseBrandTextReturn {
  /** 文案配置 */
  textConfig: ComputedRef<BrandTextConfig>;
  /** 品牌名称 */
  brandName: ComputedRef<string>;
  /** 品牌标语 */
  slogan: ComputedRef<string>;
  /** 版权信息（已插值） */
  copyright: ComputedRef<string>;
  /** 应用名称 */
  appName: ComputedRef<string>;
  /** 解析文案（支持路径和插值） */
  t: (key: string, vars?: Record<string, string>) => string;
  /** 检查文案 key 是否存在 */
  has: (key: string) => boolean;
}

export function useBrandText(): UseBrandTextReturn {
  const injection = useBrandInjection();

  const textConfig = computed(() => injection.context.config.text);
  const brandName = computed(() => injection.context.config.text.brandName);
  const slogan = computed(() => injection.context.config.text.slogan || '');
  const copyright = computed(() => injection.engine.t('copyright'));
  const appName = computed(() => injection.context.config.text.appName || brandName.value);

  function t(key: string, vars?: Record<string, string>): string {
    return injection.engine.t(key, vars);
  }

  function has(key: string): boolean {
    return injection.engine.textResolver.has(key);
  }

  return {
    textConfig,
    brandName,
    slogan,
    copyright,
    appName,
    t,
    has,
  };
}
