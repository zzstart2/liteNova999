/**
 * API 文档站默认配置
 */

import type { ApiDocsConfig } from '../src/types/api-docs';

export const DEFAULT_API_DOCS_CONFIG: ApiDocsConfig = {
  title: 'Lite999 API Reference',
  baseUrl: 'https://api.lite999.com',
  defaultMode: 'passthrough',
  playgroundEnabled: true,
  codeLanguages: ['curl', 'python', 'javascript', 'go'],
  defaultAuthValue: 'sk-lite-your-key-here',
  showRateLimit: true,
  showDeprecated: false,
};