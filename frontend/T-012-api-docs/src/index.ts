/**
 * API Docs 组件库 — 统一导出
 */

// Types
export type {
  HttpMethod, ApiMode, ParamLocation, DataType, AuthType, CodeLanguage,
  ApiParam, ApiResponse, ApiEndpoint, ApiGroup, ApiErrorCode,
  CodeExample, PlaygroundRequest, PlaygroundResponse, SearchResult, ApiDocsConfig,
} from './types/api-docs';

// Data
export { PASSTHROUGH_ENDPOINTS, PASSTHROUGH_GROUPS } from './data/passthrough-endpoints';
export { PLATFORM_ENDPOINTS, PLATFORM_GROUPS } from './data/platform-endpoints';
export { ERROR_CODES } from './data/error-codes';

// Utils
export { generateCodeExamples, generateCode } from './utils/code-generator';
export { buildCurl, quickCurl } from './utils/curl-builder';
export { searchEndpoints, highlightMatch } from './utils/search';

// Composables
export { useApiDocs } from './composables/use-api-docs';
export type { UseApiDocsReturn } from './composables/use-api-docs';
export { usePlayground } from './composables/use-playground';
export type { UsePlaygroundReturn, PlaygroundState } from './composables/use-playground';

// Config
export { DEFAULT_API_DOCS_CONFIG } from '../config/api-docs.default';

// Pages & Components
// import ApiDocsPage from './pages/ApiDocsPage.vue'
// import EndpointPage from './pages/EndpointPage.vue'