<script setup lang="ts">
import type { ApiResponse as ApiResponseType } from '../../types/api-docs';
import CodeBlock from '../common/CodeBlock.vue';

defineProps<{ responses: ApiResponseType[] }>();

function statusColor(code: number): string {
  if (code < 300) return '#22c55e';
  if (code < 400) return '#f59e0b';
  if (code < 500) return '#ef4444';
  return '#dc2626';
}
</script>

<template>
  <div class="response-section">
    <h3 class="response-section__title">Responses</h3>
    <div
      v-for="resp in responses"
      :key="resp.statusCode"
      class="response-item"
    >
      <div class="response-item__header">
        <span
          class="status-code"
          :style="{ color: statusColor(resp.statusCode), borderColor: statusColor(resp.statusCode) }"
        >
          {{ resp.statusCode }}
        </span>
        <span class="response-desc">{{ resp.description }}</span>
        <span v-if="resp.contentType" class="content-type">{{ resp.contentType }}</span>
      </div>
      <CodeBlock
        v-if="resp.example"
        :code="JSON.stringify(resp.example, null, 2)"
        language="json"
        max-height="300px"
      />
    </div>
  </div>
</template>

<style scoped>
.response-section { margin-bottom: 32px; }
.response-section__title {
  margin: 0 0 16px; font-size: 18px; font-weight: 700;
  color: var(--brand-text-primary, #111827);
}
.response-item { margin-bottom: 16px; }
.response-item__header {
  display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
}
.status-code {
  font-family: 'SF Mono', monospace; font-size: 13px; font-weight: 700;
  padding: 2px 8px; border: 1px solid; border-radius: 4px;
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.response-desc { font-size: 14px; color: var(--brand-text-secondary, #6b7280); }
.content-type {
  font-size: 11px; color: #94a3b8; font-family: monospace;
  padding: 1px 6px; background: var(--brand-surface, #f9fafb); border-radius: 3px;
}
</style>
