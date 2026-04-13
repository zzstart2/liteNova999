<script setup lang="ts">
/**
 * EndpointPage - 单端点详情页
 */
import { computed } from 'vue';
import type { ApiEndpoint, ApiDocsConfig } from '../types/api-docs';
import EndpointHeader from '../components/reference/EndpointHeader.vue';
import AuthSection from '../components/reference/AuthSection.vue';
import ParameterTable from '../components/reference/ParameterTable.vue';
import ResponseSchema from '../components/reference/ResponseSchema.vue';
import CodeExamples from '../components/reference/CodeExamples.vue';
import PlaygroundPanel from '../components/playground/PlaygroundPanel.vue';

const props = defineProps<{
  endpoint: ApiEndpoint;
  config: ApiDocsConfig;
}>();

const pathParams = computed(() => props.endpoint.parameters.filter(p => p.location === 'path'));
const queryParams = computed(() => props.endpoint.parameters.filter(p => p.location === 'query'));
const bodyParams = computed(() => props.endpoint.parameters.filter(p => p.location === 'body'));
</script>

<template>
  <article class="endpoint-page">
    <EndpointHeader :endpoint="endpoint" />
    <AuthSection :auth="endpoint.auth" />

    <ParameterTable
      v-if="pathParams.length > 0"
      :parameters="pathParams"
      title="Path Parameters"
    />
    <ParameterTable
      v-if="queryParams.length > 0"
      :parameters="queryParams"
      title="Query Parameters"
    />
    <ParameterTable
      v-if="bodyParams.length > 0"
      :parameters="bodyParams"
      title="Request Body"
    />

    <ResponseSchema :responses="endpoint.responses" />

    <CodeExamples
      :endpoint="endpoint"
      :base-url="config.baseUrl"
      :auth-value="config.defaultAuthValue"
      :languages="config.codeLanguages"
    />

    <PlaygroundPanel
      v-if="config.playgroundEnabled"
      :endpoint="endpoint"
      :base-url="config.baseUrl"
      :default-auth="config.defaultAuthValue"
    />
  </article>
</template>

<style scoped>
.endpoint-page {
  max-width: 860px;
  padding: 32px 40px;
}

@media (max-width: 768px) {
  .endpoint-page { padding: 20px; }
}
</style>
