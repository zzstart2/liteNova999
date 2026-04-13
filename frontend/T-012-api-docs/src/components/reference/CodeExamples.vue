<script setup lang="ts">
/**
 * CodeExamples - 多语言代码示例面板
 */
import { ref, computed, watch } from 'vue';
import type { ApiEndpoint, CodeLanguage } from '../../types/api-docs';
import { generateCodeExamples, type CodeGenContext } from '../../utils/code-generator';
import CodeBlock from '../common/CodeBlock.vue';

const props = defineProps<{
  endpoint: ApiEndpoint;
  baseUrl: string;
  authValue: string;
  body?: string;
  languages?: CodeLanguage[];
}>();

const activeLang = ref<CodeLanguage>('curl');
const ctx = computed<CodeGenContext>(() => ({
  baseUrl: props.baseUrl,
  authValue: props.authValue,
  body: props.body || (props.endpoint.requestExample ? JSON.stringify(props.endpoint.requestExample, null, 2) : undefined),
}));
const examples = computed(() => generateCodeExamples(props.endpoint, ctx.value, props.languages));
const activeCode = computed(() => examples.value.find((e) => e.language === activeLang.value)?.code || '');
const activeLabel = computed(() => examples.value.find((e) => e.language === activeLang.value)?.label || '');
</script>

<template>
  <div class="code-examples">
    <h3 class="code-examples__title">Code Examples</h3>
    <div class="code-examples__tabs">
      <button
        v-for="ex in examples"
        :key="ex.language"
        :class="['tab-btn', { active: activeLang === ex.language }]"
        @click="activeLang = ex.language"
      >
        {{ ex.label }}
      </button>
    </div>
    <CodeBlock :code="activeCode" :language="activeLabel" max-height="500px" />
  </div>
</template>

<style scoped>
.code-examples { margin-bottom: 32px; }
.code-examples__title {
  margin: 0 0 12px; font-size: 18px; font-weight: 700;
  color: var(--brand-text-primary, #111827);
}
.code-examples__tabs { display: flex; gap: 2px; margin-bottom: 8px; }
.tab-btn {
  padding: 6px 14px; font-size: 12px; font-weight: 500;
  color: var(--brand-text-secondary, #6b7280); background: var(--brand-surface, #f9fafb);
  border: 1px solid var(--brand-border, #e5e7eb); border-bottom: none;
  border-radius: 6px 6px 0 0; cursor: pointer; transition: all 0.15s;
}
.tab-btn:hover { color: var(--brand-text-primary, #111827); }
.tab-btn.active {
  color: #cdd6f4; background: #1e1e2e; border-color: #1e1e2e;
  font-weight: 600;
}
</style>
