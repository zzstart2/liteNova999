/**
 * Vue 3 品牌 Provider
 *
 * 通过 provide/inject 向组件树注入响应式品牌上下文
 */

import {
  defineComponent,
  provide,
  inject,
  ref,
  reactive,
  computed,
  onMounted,
  onUnmounted,
  watch,
  h,
  type InjectionKey,
  type Ref,
  type PropType,
} from 'vue';

import type {
  BrandConfig,
  BrandContext,
  ThemeMode,
  PartialBrandConfig,
  ConfigLoadOptions,
} from '../types/brand';
import { BrandEngine } from './brand-engine';
import { loadBrandConfig, loadBrandConfigSync } from './config-loader';

// ============================================================
// Injection Key
// ============================================================

export interface BrandInjection {
  /** 品牌引擎实例 */
  engine: BrandEngine;
  /** 响应式品牌上下文 */
  context: BrandContext;
  /** 当前主题模式 */
  themeMode: Ref<ThemeMode>;
  /** 是否加载中 */
  loading: Ref<boolean>;
  /** 加载错误 */
  error: Ref<Error | null>;
  /** 切换主题 */
  setTheme: (mode: ThemeMode) => void;
  /** 更新配置 */
  updateConfig: (partial: PartialBrandConfig) => void;
}

export const BRAND_INJECTION_KEY: InjectionKey<BrandInjection> =
  Symbol('brand-injection');

// ============================================================
// Provider Component
// ============================================================

export const BrandProvider = defineComponent({
  name: 'BrandProvider',

  props: {
    /** 静态配置覆盖 */
    config: {
      type: Object as PropType<PartialBrandConfig>,
      default: undefined,
    },
    /** 配置加载选项（启用远程加载） */
    loadOptions: {
      type: Object as PropType<ConfigLoadOptions>,
      default: undefined,
    },
    /** 初始主题模式 */
    theme: {
      type: String as PropType<ThemeMode>,
      default: 'light',
    },
    /** 挂载目标 CSS 选择器或 Element */
    mountTarget: {
      type: [String, Object] as PropType<string | HTMLElement>,
      default: undefined,
    },
  },

  emits: ['config-loaded', 'config-error', 'theme-changed'],

  setup(props, { slots, emit }) {
    // 1. 同步初始化（避免闪烁）
    const initialConfig = loadBrandConfigSync(props.config);
    const engine = new BrandEngine(initialConfig);

    if (props.theme) {
      engine.setThemeMode(props.theme);
    }

    // 2. 响应式状态
    const themeMode = ref<ThemeMode>(engine.themeMode);
    const loading = ref(false);
    const error = ref<Error | null>(null);
    const context = reactive<BrandContext>({ ...engine.context });

    function syncContext() {
      const ctx = engine.context;
      Object.assign(context, ctx);
      themeMode.value = engine.themeMode;
    }

    // 3. 主题切换
    function setTheme(mode: ThemeMode) {
      engine.setThemeMode(mode);
      syncContext();
      emit('theme-changed', mode);
    }

    // 4. 配置更新
    function updateConfig(partial: PartialBrandConfig) {
      engine.updateConfig(partial);
      syncContext();
    }

    // 5. 监听 props 变化
    watch(
      () => props.theme,
      (newTheme) => {
        if (newTheme && newTheme !== engine.themeMode) {
          setTheme(newTheme);
        }
      }
    );

    watch(
      () => props.config,
      (newConfig) => {
        if (newConfig) {
          engine.updateConfig(newConfig);
          syncContext();
        }
      },
      { deep: true }
    );

    // 6. 挂载
    onMounted(async () => {
      // 解析挂载目标
      let target: HTMLElement | undefined;
      if (typeof props.mountTarget === 'string') {
        target = document.querySelector(props.mountTarget) as HTMLElement;
      } else if (props.mountTarget instanceof HTMLElement) {
        target = props.mountTarget;
      }

      // 挂载 CSS 变量
      engine.mount(target);

      // 异步加载远程配置
      if (props.loadOptions?.remoteUrl) {
        loading.value = true;
        try {
          const result = await loadBrandConfig(props.loadOptions, props.config);
          engine.replaceConfig(result.config);
          engine.mount(target); // 重新挂载更新后的变量
          syncContext();
          emit('config-loaded', result);
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          error.value = e;
          emit('config-error', e);
        } finally {
          loading.value = false;
        }
      }
    });

    onUnmounted(() => {
      engine.destroy();
    });

    // 7. Provide
    const injection: BrandInjection = {
      engine,
      context: context as BrandContext,
      themeMode,
      loading,
      error,
      setTheme,
      updateConfig,
    };

    provide(BRAND_INJECTION_KEY, injection);

    return () => (slots.default ? slots.default() : null);
  },
});

// ============================================================
// Inject Helper
// ============================================================

/**
 * 在子组件中注入品牌上下文（必须在 BrandProvider 下使用）
 */
export function useBrandInjection(): BrandInjection {
  const injection = inject(BRAND_INJECTION_KEY);
  if (!injection) {
    throw new Error(
      '[useBrandInjection] BrandProvider not found in component tree. ' +
        'Wrap your app with <BrandProvider>.'
    );
  }
  return injection;
}
