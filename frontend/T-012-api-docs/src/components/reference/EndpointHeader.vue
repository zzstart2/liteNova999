<script setup lang="ts">
import type { ApiEndpoint } from '../../types/api-docs';
import MethodBadge from '../common/MethodBadge.vue';
import CopyButton from '../common/CopyButton.vue';

defineProps<{ endpoint: ApiEndpoint }>();
</script>

<template>
  <div class="endpoint-header">
    <div class="endpoint-header__top">
      <MethodBadge :method="endpoint.method" />
      <code class="endpoint-header__path">{{ endpoint.path }}</code>
      <CopyButton :text="endpoint.path" label="Copy" />
      <span v-if="endpoint.streaming" class="endpoint-header__tag tag--stream">SSE</span>
      <span v-for="tag in endpoint.tags" :key="tag" class="endpoint-header__tag">{{ tag }}</span>
    </div>
    <h1 class="endpoint-header__name">{{ endpoint.name }}</h1>
    <p class="endpoint-header__summary">{{ endpoint.summary }}</p>
    <div v-if="endpoint.description" class="endpoint-header__desc" v-html="endpoint.description.replace(/\n/g, '<br>')" />
  </div>
</template>

<style scoped>
.endpoint-header { margin-bottom: 32px; }
.endpoint-header__top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.endpoint-header__path {
  font-family: 'SF Mono', monospace; font-size: 14px; font-weight: 600;
  color: var(--brand-text-primary, #111827); background: var(--brand-surface, #f9fafb);
  padding: 4px 10px; border-radius: 6px; border: 1px solid var(--brand-border, #e5e7eb);
}
.endpoint-header__tag {
  padding: 2px 8px; font-size: 10px; font-weight: 700; text-transform: uppercase;
  color: var(--brand-text-secondary, #6b7280); background: var(--brand-surface, #f9fafb);
  border: 1px solid var(--brand-border, #e5e7eb); border-radius: 4px;
}
.tag--stream { color: #8b5cf6; background: #f5f3ff; border-color: #c4b5fd; }
.endpoint-header__name {
  margin: 0 0 8px; font-size: 28px; font-weight: 800; letter-spacing: -0.025em;
  color: var(--brand-text-primary, #111827);
}
.endpoint-header__summary {
  margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: var(--brand-text-secondary, #6b7280);
}
.endpoint-header__desc {
  font-size: 14px; line-height: 1.7; color: var(--brand-text-secondary, #6b7280);
  padding: 16px; background: var(--brand-surface, #f9fafb); border-radius: var(--brand-radius, 8px);
  border-left: 3px solid var(--brand-primary, #3b82f6);
}
</style>
