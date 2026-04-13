<script setup lang="ts">
/**
 * RequestEditor - 请求编辑器
 *
 * 包含 Auth 输入、路径参数、Query 参数、流式切换、Body 编辑
 * 从 PlaygroundPanel 中拆出的请求配置区域
 */
import type { ApiEndpoint, ApiParam } from '../../types/api-docs';
import JsonEditor from '../common/JsonEditor.vue';

const props = defineProps<{
  endpoint: ApiEndpoint;
  authToken: string;
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
  requestBody: string;
  streaming: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:authToken', v: string): void;
  (e: 'update:pathParams', v: Record<string, string>): void;
  (e: 'update:queryParams', v: Record<string, string>): void;
  (e: 'update:requestBody', v: string): void;
  (e: 'update:streaming', v: boolean): void;
}>();

function getPathParamDefs(endpoint: ApiEndpoint): ApiParam[] {
  return endpoint.parameters.filter((p) => p.location === 'path');
}

function getQueryParamDefs(endpoint: ApiEndpoint): ApiParam[] {
  return endpoint.parameters.filter((p) => p.location === 'query');
}

function updatePathParam(key: string, value: string) {
  emit('update:pathParams', { ...props.pathParams, [key]: value });
}

function updateQueryParam(key: string, value: string) {
  emit('update:queryParams', { ...props.queryParams, [key]: value });
}
</script>

<template>
  <div class="request-editor">
    <!-- Auth -->
    <div class="re-field">
      <label class="re-label">
        🔒 Authorization
        <span class="re-hint">Bearer token</span>
      </label>
      <input
        class="re-input"
        type="password"
        :value="authToken"
        placeholder="sk-lite-..."
        autocomplete="off"
        @input="emit('update:authToken', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Path params -->
    <div v-for="param in getPathParamDefs(endpoint)" :key="param.name" class="re-field">
      <label class="re-label">
        {{ param.name }}
        <span class="re-hint">path · {{ param.type }}</span>
        <span v-if="param.required" class="re-required">required</span>
      </label>
      <input
        class="re-input"
        :value="pathParams[param.name] || ''"
        :placeholder="String(param.example || param.defaultValue || '')"
        @input="updatePathParam(param.name, ($event.target as HTMLInputElement).value)"
      />
      <p v-if="param.description" class="re-desc">{{ param.description }}</p>
    </div>

    <!-- Query params -->
    <div v-for="param in getQueryParamDefs(endpoint)" :key="param.name" class="re-field">
      <label class="re-label">
        {{ param.name }}
        <span class="re-hint">query · {{ param.type }}</span>
        <span v-if="param.required" class="re-required">required</span>
      </label>
      <input
        v-if="!param.enum"
        class="re-input"
        :value="queryParams[param.name] || ''"
        :placeholder="String(param.example || param.defaultValue || '')"
        @input="updateQueryParam(param.name, ($event.target as HTMLInputElement).value)"
      />
      <select
        v-else
        class="re-input"
        :value="queryParams[param.name] || ''"
        @change="updateQueryParam(param.name, ($event.target as HTMLSelectElement).value)"
      >
        <option value="">-- select --</option>
        <option v-for="opt in param.enum" :key="opt" :value="opt">{{ opt }}</option>
      </select>
      <p v-if="param.description" class="re-desc">{{ param.description }}</p>
    </div>

    <!-- Stream toggle -->
    <div v-if="endpoint.streaming" class="re-field re-field--row">
      <label class="re-label">⚡ Stream (SSE)</label>
      <label class="re-toggle">
        <input
          type="checkbox"
          :checked="streaming"
          @change="emit('update:streaming', ($event.target as HTMLInputElement).checked)"
        />
        <span class="re-toggle__track" />
      </label>
    </div>

    <!-- Body -->
    <div v-if="endpoint.method !== 'GET'" class="re-field">
      <label class="re-label">Request Body</label>
      <JsonEditor
        :model-value="requestBody"
        @update:model-value="emit('update:requestBody', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.request-editor { display: flex; flex-direction: column; gap: 14px; }
.re-field { display: flex; flex-direction: column; gap: 4px; }
.re-field--row { flex-direction: row; align-items: center; justify-content: space-between; }
.re-label {
  font-size: 12px; font-weight: 600; color: var(--brand-text-secondary, #6b7280);
  display: flex; align-items: center; gap: 6px;
}
.re-hint { font-weight: 400; color: #94a3b8; font-size: 11px; }
.re-required { font-size: 10px; font-weight: 700; color: #dc2626; text-transform: uppercase; }
.re-input {
  padding: 8px 12px; font-size: 13px; font-family: 'SF Mono', monospace;
  border: 1px solid var(--brand-border, #e5e7eb); border-radius: 6px;
  background: var(--brand-bg, #ffffff); color: var(--brand-text-primary, #111827);
  transition: border-color 0.15s;
}
.re-input:focus { outline: none; border-color: var(--brand-primary, #3b82f6); }
.re-desc { font-size: 11px; color: #94a3b8; margin: 0; }

.re-toggle { position: relative; display: inline-block; }
.re-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
.re-toggle__track {
  display: block; width: 36px; height: 20px; background: #d1d5db;
  border-radius: 10px; cursor: pointer; transition: background 0.2s; position: relative;
}
.re-toggle__track::after {
  content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
  background: #fff; border-radius: 50%; transition: transform 0.2s;
}
.re-toggle input:checked + .re-toggle__track { background: var(--brand-primary, #3b82f6); }
.re-toggle input:checked + .re-toggle__track::after { transform: translateX(16px); }
</style>
