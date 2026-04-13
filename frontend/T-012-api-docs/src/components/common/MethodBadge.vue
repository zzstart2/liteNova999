<script setup lang="ts">
import type { HttpMethod } from '../../types/api-docs';
defineProps<{ method: HttpMethod }>();
const colorMap: Record<HttpMethod, string> = {
  GET: '#22c55e',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  PATCH: '#8b5cf6',
  DELETE: '#ef4444',
};
</script>

<template>
  <span class="method-badge" :style="{ '--badge-color': colorMap[method] }">
    {{ method }}
  </span>
</template>

<style scoped>
.method-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  font-family: 'SF Mono', SFMono-Regular, monospace;
  letter-spacing: 0.04em;
  color: var(--badge-color);
  background: color-mix(in srgb, var(--badge-color) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--badge-color) 25%, transparent);
  border-radius: 4px;
  white-space: nowrap;
  line-height: 1.5;
}
</style>
