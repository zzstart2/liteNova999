/**
 * useBrand - 品牌系统主 Hook
 *
 * 提供完整品牌上下文访问、主题切换、配置更新等能力
 */

import { computed, type ComputedRef } from 'vue';
import type { BrandConfig, BrandContext, ThemeMode, PartialBrandConfig } from '../types/brand';
import { useBrandInjection } from '../brand/brand-provider';

export interface UseBrandReturn {
  /** 完整品牌配置 */
  config: ComputedRef<BrandConfig>;
  /** 品牌上下文（含运行时状态） */
  context: BrandContext;
  /** 当前主题模式 */
  themeMode: ComputedRef<ThemeMode>;
  /** 实际生效的主题（解析 auto） */
  effectiveTheme: ComputedRef<'light' | 'dark'>;
  /** 品牌名称 */
  brandName: ComputedRef<string>;
  /** 品牌 ID */
  brandId: ComputedRef<string>;
  /** 是否加载中 */
  loading: ComputedRef<boolean>;
  /** 加载错误 */
  error: ComputedRef<Error | null>;
  /** 切换主题 */
  setTheme: (mode: ThemeMode) => void;
  /** 切换到下一个主题（light → dark → auto → light） */
  toggleTheme: () => void;
  /** 更新品牌配置 */
  updateConfig: (partial: PartialBrandConfig) => void;
  /** 文案解析 */
  t: (key: string, vars?: Record<string, string>) => string;
}

export function useBrand(): UseBrandReturn {
  const injection = useBrandInjection();

  const config = computed(() => injection.context.config);
  const themeMode = computed(() => injection.themeMode.value);
  const effectiveTheme = computed(() => injection.engine.effectiveTheme);
  const brandName = computed(() => injection.context.config.text.brandName);
  const brandId = computed(() => injection.context.config.meta.id);
  const loading = computed(() => injection.loading.value);
  const error = computed(() => injection.error.value);

  function toggleTheme() {
    const modes: ThemeMode[] = ['light', 'dark', 'auto'];
    const currentIdx = modes.indexOf(injection.themeMode.value);
    const nextIdx = (currentIdx + 1) % modes.length;
    injection.setTheme(modes[nextIdx]);
  }

  function t(key: string, vars?: Record<string, string>): string {
    return injection.engine.t(key, vars);
  }

  return {
    config,
    context: injection.context,
    themeMode,
    effectiveTheme,
    brandName,
    brandId,
    loading,
    error,
    setTheme: injection.setTheme,
    toggleTheme,
    updateConfig: injection.updateConfig,
    t,
  };
}
