<script setup lang="ts">
/**
 * CodeBlock - 代码高亮块 + 一键复制
 *
 * 使用纯 CSS 样式（无 Shiki/Prism 依赖），可后续接入高亮库
 */
import CopyButton from './CopyButton.vue';

defineProps<{
  code: string;
  language?: string;
  maxHeight?: string;
}>();
</script>

<template>
  <div class="code-block">
    <div class="code-block__header">
      <span v-if="language" class="code-block__lang">{{ language }}</span>
      <CopyButton :text="code" />
    </div>
    <pre class="code-block__pre" :style="{ maxHeight: maxHeight || '400px' }"><code>{{ code }}</code></pre>
  </div>
</template>

<style scoped>
.code-block {
  border: 1px solid var(--brand-border, #e5e7eb);
  border-radius: var(--brand-radius, 8px);
  overflow: hidden;
  background: #1e1e2e;
}
.code-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #181825;
  border-bottom: 1px solid #313244;
}
.code-block__lang {
  font-size: 11px;
  font-weight: 600;
  color: #a6adc8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.code-block__pre {
  margin: 0;
  padding: 16px;
  overflow: auto;
  font-family: 'SF Mono', SFMono-Regular, 'Cascadia Code', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #cdd6f4;
  tab-size: 2;
}
</style>
