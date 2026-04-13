<script setup lang="ts">
/**
 * JsonEditor - 简易 JSON 编辑器
 *
 * textarea 实现，含格式化/校验
 */
import { ref, watch, computed } from 'vue';

const props = defineProps<{ modelValue: string; readonly?: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const internal = ref(props.modelValue);
const error = ref('');

watch(() => props.modelValue, (v) => { internal.value = v; });

function onInput(e: Event) {
  const val = (e.target as HTMLTextAreaElement).value;
  internal.value = val;
  emit('update:modelValue', val);
  try { JSON.parse(val); error.value = ''; } catch (err: any) { error.value = err.message; }
}

function format() {
  try {
    const obj = JSON.parse(internal.value);
    const formatted = JSON.stringify(obj, null, 2);
    internal.value = formatted;
    emit('update:modelValue', formatted);
    error.value = '';
  } catch (err: any) { error.value = err.message; }
}

const lineCount = computed(() => internal.value.split('\n').length);
</script>

<template>
  <div class="json-editor" :class="{ 'json-editor--error': !!error }">
    <div class="json-editor__toolbar">
      <span class="json-editor__label">JSON Body</span>
      <span v-if="error" class="json-editor__error" :title="error">⚠ Invalid JSON</span>
      <button v-if="!readonly" class="json-editor__fmt" @click="format">Format</button>
    </div>
    <div class="json-editor__body">
      <div class="json-editor__gutter">
        <div v-for="i in lineCount" :key="i" class="gutter-line">{{ i }}</div>
      </div>
      <textarea
        class="json-editor__textarea"
        :value="internal"
        :readonly="readonly"
        spellcheck="false"
        @input="onInput"
      />
    </div>
  </div>
</template>

<style scoped>
.json-editor {
  border: 1px solid var(--brand-border, #e5e7eb);
  border-radius: var(--brand-radius, 8px);
  overflow: hidden;
  background: #1e1e2e;
}
.json-editor--error { border-color: var(--brand-danger, #ef4444); }
.json-editor__toolbar {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; background: #181825; border-bottom: 1px solid #313244;
}
.json-editor__label { font-size: 11px; font-weight: 600; color: #a6adc8; flex: 1; }
.json-editor__error { font-size: 11px; color: #f38ba8; }
.json-editor__fmt {
  padding: 2px 8px; font-size: 10px; font-weight: 600;
  color: #a6adc8; background: #313244; border: none; border-radius: 4px; cursor: pointer;
}
.json-editor__fmt:hover { color: #cdd6f4; }
.json-editor__body { display: flex; min-height: 120px; max-height: 350px; }
.json-editor__gutter {
  padding: 12px 8px; text-align: right; user-select: none; flex-shrink: 0;
  font-family: 'SF Mono', monospace; font-size: 12px; line-height: 1.6; color: #585b70;
  border-right: 1px solid #313244; background: #181825;
}
.gutter-line { min-width: 20px; }
.json-editor__textarea {
  flex: 1; padding: 12px; border: none; outline: none; resize: none;
  font-family: 'SF Mono', SFMono-Regular, monospace; font-size: 13px; line-height: 1.6;
  color: #cdd6f4; background: transparent; tab-size: 2; overflow: auto;
}
</style>
