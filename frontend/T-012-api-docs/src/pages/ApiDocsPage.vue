<script setup lang="ts">
/**
 * ApiDocsPage - API 文档站主页
 *
 * 完整页面布局：侧边栏 + 端点详情
 */
import type { ApiDocsConfig } from '../types/api-docs';
import { useApiDocs } from '../composables/use-api-docs';
import DocsSidebar from '../components/navigation/DocsSidebar.vue';
import EndpointPage from './EndpointPage.vue';

const props = defineProps<{
  /** 文档站配置覆盖 */
  configOverrides?: Partial<ApiDocsConfig>;
}>();

const {
  config,
  mode,
  setMode,
  groups,
  endpoints,
  selectedEndpoint,
  selectEndpoint,
  searchQuery,
  searchResults,
  isSearching,
} = useApiDocs(props.configOverrides);
</script>

<template>
  <div class="api-docs-page">
    <DocsSidebar
      :mode="mode"
      :groups="groups"
      :endpoints="endpoints"
      :selected-id="selectedEndpoint?.id ?? null"
      :search-query="searchQuery"
      :search-results="searchResults"
      :is-searching="isSearching"
      @set-mode="setMode"
      @select="selectEndpoint"
      v-model:search-query="searchQuery"
    />

    <main class="api-docs-content">
      <template v-if="selectedEndpoint">
        <EndpointPage :endpoint="selectedEndpoint" :config="config" />
      </template>

      <template v-else>
        <div class="empty-state">
          <h2>Select an endpoint</h2>
          <p>Choose an endpoint from the sidebar to view its documentation.</p>
        </div>
      </template>
    </main>
  </div>
</template>

<style>
/* Global resets for API docs */
.api-docs-page {
  display: flex;
  min-height: 100vh;
  font-family: system-ui, -apple-system, sans-serif;
}

.api-docs-content {
  flex: 1;
  min-width: 0;
  background: var(--brand-bg, #ffffff);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: var(--brand-text-secondary, #6b7280);
}

.empty-state h2 {
  margin: 0 0 8px;
  font-size: 20px;
  color: var(--brand-text-primary, #111827);
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}
</style>