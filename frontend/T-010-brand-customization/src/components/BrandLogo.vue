<script setup lang="ts">
/**
 * BrandLogo - 品牌 Logo 组件
 *
 * 根据品牌配置渲染对应的 Logo，支持多变体、主题适配、尺寸控制
 */

import { computed, ref } from 'vue';
import type { LogoVariant, LogoAsset } from '../types/brand';
import { useBrandInjection } from '../brand/brand-provider';

const props = withDefaults(
  defineProps<{
    /** Logo 变体 */
    variant?: LogoVariant;
    /** 宽度 (px 或 CSS 值) */
    width?: number | string;
    /** 高度 (px 或 CSS 值) */
    height?: number | string;
    /** 是否自动适配暗色主题 */
    autoTheme?: boolean;
    /** alt 文字覆盖 */
    alt?: string;
    /** 自定义 class */
    class?: string;
  }>(),
  {
    variant: 'full',
    autoTheme: true,
  }
);

const injection = useBrandInjection();
const loadError = ref(false);

/** 解析 Logo 资源 */
const logoAsset = computed<LogoAsset | undefined>(() => {
  const logoConfig = injection.context.config.logo;
  const effectiveTheme = injection.engine.effectiveTheme;

  // 暗色主题优先使用 dark 变体
  if (props.autoTheme && effectiveTheme === 'dark' && logoConfig.dark) {
    const darkAsset = logoConfig.dark[props.variant];
    if (darkAsset) return darkAsset;
  }

  // 标准变体
  return logoConfig[props.variant];
});

/** 计算样式 */
const style = computed(() => {
  const s: Record<string, string> = {};
  const asset = logoAsset.value;

  if (props.width) {
    s.width = typeof props.width === 'number' ? `${props.width}px` : props.width;
  } else if (asset?.width) {
    s.width = `${asset.width}px`;
  }

  if (props.height) {
    s.height = typeof props.height === 'number' ? `${props.height}px` : props.height;
  } else if (asset?.height) {
    s.height = `${asset.height}px`;
  }

  return s;
});

/** Alt 文字 */
const altText = computed(() => {
  return props.alt || logoAsset.value?.alt || injection.context.config.text.brandName;
});

/** 是否为内联 SVG */
const isSvgInline = computed(() => {
  const asset = logoAsset.value;
  if (!asset) return false;
  return asset.type === 'svg' && asset.src.includes('<svg');
});

function onImgError() {
  loadError.value = true;
}
</script>

<template>
  <div
    class="brand-logo"
    :class="[`brand-logo--${variant}`, props.class]"
    :style="style"
    role="img"
    :aria-label="altText"
  >
    <!-- 内联 SVG -->
    <div
      v-if="isSvgInline && logoAsset"
      class="brand-logo__svg"
      v-html="logoAsset.src"
    />

    <!-- URL 或 Base64 图片 -->
    <img
      v-else-if="logoAsset && !loadError"
      :src="logoAsset.src"
      :alt="altText"
      class="brand-logo__img"
      @error="onImgError"
    />

    <!-- Fallback: 品牌名称文字 -->
    <span v-else class="brand-logo__fallback">
      {{ injection.context.config.text.brandName }}
    </span>
  </div>
</template>

<style scoped>
.brand-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-logo__svg {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.brand-logo__svg :deep(svg) {
  width: 100%;
  height: 100%;
}

.brand-logo__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.brand-logo__fallback {
  font-weight: 700;
  font-size: 1.25em;
  color: var(--brand-primary, #3b82f6);
  white-space: nowrap;
}
</style>
