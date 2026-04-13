<script setup lang="ts">
/**
 * ResponseViewer - 响应查看器
 *
 * 展示状态码、耗时、大小、响应体；支持流式输出实时渲染
 */
import type { PlaygroundResponse } from '../../types/api-docs';
import CodeBlock from '../common/CodeBlock.vue';
import CopyButton from '../common/CopyButton.vue';

defineProps<{
  response: PlaygroundResponse | null;
  streamBuffer: string;
  isStreaming: boolean;
}>();

function statusColor(code: number): string {
  if (code < 300) return '#22c55e';
  if (code < 400) return '#f59e0b';
  if (code < 500) return '#ef4444';
  return '#dc2626';
}

function statusBg(code: number): string {
  if (code < 300) return '#f0fdf4';
  if (code < 400) return '#fffbeb';
  return '#fef2f2';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function tryFormatJson(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
</script>

<template>
  <!-- Streaming output -->
  <div v-if="isStreaming && streamBuffer" class="rv-stream">
    <div class="rv-stream__header">
      <span class="rv-stream__dot" />
      <span class="rv-stream__label">Live Stream</span>
    </div>
    <pre class="rv-stream__output">{{ streamBuffer }}</pre>
  </div>

  <!-- Final response -->
  <div v-if="response" class="rv-response">
    <div class="rv-header">
      <span
        class="rv-status"
        :style="{ color: statusColor(response.status), background: statusBg(response.status) }"
      >
        {{ response.status }} {{ response.statusText }}
      </span>
      <span class="rv-meta">{{ response.duration }}ms</span>
      <span class="rv-meta">{{ formatBytes(response.size) }}</span>
      <span v-if="response.streamed" class="rv-tag rv-tag--stream">SSE</span>
      <CopyButton :text="response.body" label="Copy" />
    </div>

    <!-- Error -->
    <div v-if="response.error" class="rv-error">
      <span class="rv-error__icon">⚠️</span>
      {{ response.error }}
    </div>

    <!-- Response body -->
    <template v-else>
      <!-- Response headers (collapsible) -->
      <details v-if="Object.keys(response.headers).length > 0" class="rv-headers">
        <summary class="rv-headers__toggle">Response Headers ({{ Object.keys(response.headers).length }})</summary>
        <div class="rv-headers__list">
          <div v-for="(val, key) in response.headers" :key="key" class="rv-headers__item">
            <span class="rv-headers__key">{{ key }}:</span>
            <span class="rv-headers__val">{{ val }}</span>
          </div>
        </div>
      </details>

      <!-- Body -->
      <CodeBlock :code="tryFormatJson(response.body)" language="json" max-height="500px" />
    </template>
  </div>
</template>

<style scoped>
.rv-response { margin-top: 16px; }

.rv-header {
  display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap;
}
.rv-status {
  font-family: 'SF Mono', monospace; font-size: 14px; font-weight: 700;
  padding: 3px 10px; border-radius: 6px;
}
.rv-meta { font-size: 12px; color: #94a3b8; font-family: monospace; }
.rv-tag {
  font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 3px;
  text-transform: uppercase;
}
.rv-tag--stream { color: #8b5cf6; background: #f5f3ff; }

.rv-error {
  padding: 14px; background: #fef2f2; color: #dc2626;
  border: 1px solid #fecaca; border-radius: 8px; font-size: 13px;
  display: flex; align-items: flex-start; gap: 8px;
}
.rv-error__icon { flex-shrink: 0; }

.rv-headers { margin-bottom: 12px; }
.rv-headers__toggle {
  font-size: 12px; font-weight: 600; color: var(--brand-text-secondary, #6b7280);
  cursor: pointer; user-select: none; padding: 4px 0;
}
.rv-headers__toggle:hover { color: var(--brand-text-primary, #111827); }
.rv-headers__list {
  padding: 8px 12px; margin-top: 4px; background: var(--brand-surface, #f9fafb);
  border-radius: 6px; font-family: 'SF Mono', monospace; font-size: 11px;
}
.rv-headers__item { display: flex; gap: 8px; padding: 2px 0; }
.rv-headers__key { color: var(--brand-primary, #3b82f6); font-weight: 600; white-space: nowrap; }
.rv-headers__val { color: var(--brand-text-primary, #111827); word-break: break-all; }

/* Stream live output */
.rv-stream { margin-top: 12px; }
.rv-stream__header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.rv-stream__dot {
  width: 8px; height: 8px; background: #22c55e; border-radius: 50%;
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.rv-stream__label { font-size: 12px; font-weight: 600; color: #22c55e; }
.rv-stream__output {
  margin: 0; padding: 14px; font-family: 'SF Mono', monospace; font-size: 13px;
  background: #1e1e2e; color: #a6e3a1; border-radius: 8px;
  overflow-x: auto; max-height: 350px; line-height: 1.5;
}
</style>
