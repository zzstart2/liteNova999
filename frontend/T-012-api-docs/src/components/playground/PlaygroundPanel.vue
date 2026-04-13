<script setup lang="ts">
/**
 * PlaygroundPanel - 交互式 Playground
 */
import { watch } from 'vue';
import type { ApiEndpoint } from '../../types/api-docs';
import { usePlayground } from '../../composables/use-playground';
import JsonEditor from '../common/JsonEditor.vue';
import CodeBlock from '../common/CodeBlock.vue';
import CopyButton from '../common/CopyButton.vue';

const props = defineProps<{
  endpoint: ApiEndpoint;
  baseUrl: string;
  defaultAuth: string;
}>();

const {
  state, requestBody, authToken, pathParams, queryParams, streaming,
  response, streamBuffer, curlCommand, send, cancel, reset, initFromEndpoint,
} = usePlayground(props.baseUrl, props.defaultAuth);

watch(() => props.endpoint, (ep) => initFromEndpoint(ep), { immediate: true });

function statusColor(code: number): string {
  if (code < 300) return '#22c55e';
  if (code < 400) return '#f59e0b';
  return '#ef4444';
}
</script>

<template>
  <div class="playground">
    <h3 class="playground__title">
      ⚡ Playground
      <span class="playground__status" :class="`status--${state}`">{{ state }}</span>
    </h3>

    <!-- Auth -->
    <div class="pg-field">
      <label class="pg-label">Authorization</label>
      <input v-model="authToken" class="pg-input" placeholder="sk-lite-..." />
    </div>

    <!-- Path params -->
    <div v-for="(val, key) in pathParams" :key="key" class="pg-field">
      <label class="pg-label">{{ key }} <span class="pg-hint">(path)</span></label>
      <input v-model="pathParams[key]" class="pg-input" />
    </div>

    <!-- Query params -->
    <div v-for="(val, key) in queryParams" :key="key" class="pg-field">
      <label class="pg-label">{{ key }} <span class="pg-hint">(query)</span></label>
      <input v-model="queryParams[key]" class="pg-input" />
    </div>

    <!-- Stream toggle -->
    <div v-if="endpoint.streaming" class="pg-field pg-field--row">
      <label class="pg-label">Stream (SSE)</label>
      <input type="checkbox" v-model="streaming" />
    </div>

    <!-- Body -->
    <div v-if="endpoint.method !== 'GET'" class="pg-field">
      <JsonEditor v-model="requestBody" />
    </div>

    <!-- Actions -->
    <div class="pg-actions">
      <button
        class="pg-btn pg-btn--send"
        :disabled="state === 'sending' || state === 'streaming'"
        @click="send"
      >
        {{ state === 'sending' ? 'Sending...' : state === 'streaming' ? 'Streaming...' : 'Send Request' }}
      </button>
      <button
        v-if="state === 'sending' || state === 'streaming'"
        class="pg-btn pg-btn--cancel"
        @click="cancel"
      >
        Cancel
      </button>
      <button class="pg-btn pg-btn--reset" @click="reset">Reset</button>
    </div>

    <!-- cURL -->
    <div class="pg-curl">
      <div class="pg-curl__head">
        <span class="pg-label">cURL</span>
        <CopyButton :text="curlCommand" />
      </div>
      <pre class="pg-curl__code">{{ curlCommand }}</pre>
    </div>

    <!-- Response -->
    <div v-if="response" class="pg-response">
      <div class="pg-response__header">
        <span
          class="pg-response__status"
          :style="{ color: statusColor(response.status) }"
        >
          {{ response.status }} {{ response.statusText }}
        </span>
        <span class="pg-response__meta">{{ response.duration }}ms · {{ response.size }} bytes</span>
        <span v-if="response.streamed" class="pg-response__tag">streamed</span>
      </div>

      <div v-if="response.error" class="pg-response__error">
        ⚠️ {{ response.error }}
      </div>

      <CodeBlock
        v-else
        :code="response.body"
        language="json"
        max-height="400px"
      />
    </div>

    <!-- Stream buffer -->
    <div v-if="state === 'streaming' && streamBuffer" class="pg-stream">
      <div class="pg-label">Live stream output:</div>
      <pre class="pg-stream__output">{{ streamBuffer }}</pre>
    </div>
  </div>
</template>

<style scoped>
.playground {
  padding: 20px; background: var(--brand-surface, #f9fafb);
  border: 1px solid var(--brand-border, #e5e7eb); border-radius: var(--brand-radius-lg, 12px);
}
.playground__title {
  margin: 0 0 16px; font-size: 18px; font-weight: 700;
  color: var(--brand-text-primary, #111827); display: flex; align-items: center; gap: 10px;
}
.playground__status {
  font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;
  text-transform: uppercase;
}
.status--idle { color: #6b7280; background: #f3f4f6; }
.status--sending { color: #3b82f6; background: #eff6ff; }
.status--streaming { color: #8b5cf6; background: #f5f3ff; }
.status--done { color: #22c55e; background: #f0fdf4; }
.status--error { color: #ef4444; background: #fef2f2; }

.pg-field { margin-bottom: 12px; }
.pg-field--row { display: flex; align-items: center; gap: 8px; }
.pg-label { display: block; font-size: 12px; font-weight: 600; color: var(--brand-text-secondary, #6b7280); margin-bottom: 4px; }
.pg-hint { font-weight: 400; color: #94a3b8; }
.pg-input {
  width: 100%; padding: 8px 12px; font-size: 13px; font-family: 'SF Mono', monospace;
  border: 1px solid var(--brand-border, #e5e7eb); border-radius: 6px;
  background: var(--brand-bg, #ffffff); color: var(--brand-text-primary, #111827);
}

.pg-actions { display: flex; gap: 8px; margin-bottom: 16px; }
.pg-btn {
  padding: 8px 20px; font-size: 13px; font-weight: 600; border: none;
  border-radius: 6px; cursor: pointer; transition: all 0.15s;
}
.pg-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.pg-btn--send { background: var(--brand-primary, #3b82f6); color: #fff; }
.pg-btn--send:hover:not(:disabled) { background: var(--brand-primary-600, #2563eb); }
.pg-btn--cancel { background: var(--brand-danger, #ef4444); color: #fff; }
.pg-btn--reset { background: var(--brand-surface, #f9fafb); color: var(--brand-text-secondary, #6b7280); border: 1px solid var(--brand-border, #e5e7eb); }

.pg-curl { margin-bottom: 16px; }
.pg-curl__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.pg-curl__code {
  margin: 0; padding: 12px; font-family: 'SF Mono', monospace; font-size: 12px;
  line-height: 1.5; color: #cdd6f4; background: #1e1e2e; border-radius: 6px;
  overflow-x: auto; white-space: pre-wrap; word-break: break-all;
}

.pg-response { margin-top: 16px; }
.pg-response__header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.pg-response__status { font-size: 15px; font-weight: 700; font-family: 'SF Mono', monospace; }
.pg-response__meta { font-size: 12px; color: #94a3b8; }
.pg-response__tag { font-size: 10px; font-weight: 700; color: #8b5cf6; background: #f5f3ff; padding: 2px 6px; border-radius: 3px; }
.pg-response__error { padding: 12px; background: #fef2f2; color: #dc2626; border-radius: 6px; font-size: 13px; }

.pg-stream { margin-top: 12px; }
.pg-stream__output {
  margin: 4px 0 0; padding: 12px; font-family: 'SF Mono', monospace; font-size: 12px;
  background: #1e1e2e; color: #a6e3a1; border-radius: 6px; overflow-x: auto; max-height: 300px;
}
</style>
