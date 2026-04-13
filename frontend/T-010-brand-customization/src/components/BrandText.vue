<script setup lang="ts">
/**
 * BrandText - 品牌文案组件
 *
 * 声明式渲染品牌文案，支持插值变量和默认 slot fallback
 */

import { computed } from 'vue';
import { useBrandInjection } from '../brand/brand-provider';

const props = withDefaults(
  defineProps<{
    /** 文案 key (如 'footer.copyright', 'brandName') */
    textKey: string;
    /** 插值变量 */
    vars?: Record<string, string>;
    /** 渲染标签 */
    tag?: string;
    /** key 不存在时使用 slot 内容作为 fallback */
    fallback?: boolean;
  }>(),
  {
    tag: 'span',
    fallback: true,
  }
);

const injection = useBrandInjection();

const resolved = computed(() => {
  const text = injection.engine.t(props.textKey, props.vars);
  // 如果解析结果等于 key 本身，说明未找到
  return text !== props.textKey ? text : null;
});

const hasText = computed(() => resolved.value !== null);
</script>

<template>
  <component :is="tag" class="brand-text">
    <template v-if="hasText">{{ resolved }}</template>
    <template v-else-if="fallback">
      <slot>{{ textKey }}</slot>
    </template>
    <template v-else>{{ textKey }}</template>
  </component>
</template>

<style scoped>
.brand-text {
  /* 继承父级样式，不添加额外样式 */
}
</style>
