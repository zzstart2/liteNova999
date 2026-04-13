<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ text: string; label?: string }>();
const copied = ref(false);

async function copy() {
  try {
    await navigator.clipboard.writeText(props.text);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch { /* noop */ }
}
</script>

<template>
  <button class="copy-btn" :class="{ 'copy-btn--done': copied }" @click="copy" :title="label || 'Copy'">
    {{ copied ? '✓ Copied' : label || 'Copy' }}
  </button>
</template>

<style scoped>
.copy-btn {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--brand-text-secondary, #6b7280);
  background: var(--brand-surface, #f9fafb);
  border: 1px solid var(--brand-border, #e5e7eb);
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s;
}
.copy-btn:hover { border-color: var(--brand-primary, #3b82f6); color: var(--brand-primary, #3b82f6); }
.copy-btn--done { color: var(--brand-success, #22c55e); border-color: var(--brand-success, #22c55e); }
</style>
