/**
 * PRJ-LITE999-T-012 API 文档站 — 类型定义
 *
 * 覆盖端点描述、参数、响应、分组、Playground 等全部数据结构
 */

// ============================================================
// 基础枚举
// ============================================================

/** HTTP 方法 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** API 模式 */
export type ApiMode = 'passthrough' | 'platform';

/** 参数位置 */
export type ParamLocation = 'path' | 'query' | 'header' | 'body';

/** 参数/字段数据类型 */
export type DataType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null'
  | 'file';

/** 认证方式 */
export type AuthType = 'bearer' | 'api-key' | 'none';

/** 代码语言 */
export type CodeLanguage = 'curl' | 'python' | 'javascript' | 'go';

// ============================================================
// 参数/字段
// ============================================================

/** 单个参数或字段 */
export interface ApiParam {
  /** 参数名 */
  name: string;
  /** 位置 */
  location: ParamLocation;
  /** 数据类型 */
  type: DataType;
  /** 是否必填 */
  required: boolean;
  /** 描述 */
  description: string;
  /** 默认值 */
  defaultValue?: string | number | boolean | null;
  /** 枚举值 */
  enum?: string[];
  /** 示例值 */
  example?: unknown;
  /** 子字段（object / array 类型） */
  children?: ApiParam[];
  /** 是否已废弃 */
  deprecated?: boolean;
  /** 最小值 */
  minimum?: number;
  /** 最大值 */
  maximum?: number;
}

// ============================================================
// 响应
// ============================================================

/** 单个响应定义 */
export interface ApiResponse {
  /** HTTP 状态码 */
  statusCode: number;
  /** 状态描述 */
  description: string;
  /** 响应 Content-Type */
  contentType?: string;
  /** 响应 Body 字段结构 */
  schema?: ApiParam[];
  /** 示例响应 JSON */
  example?: unknown;
}

// ============================================================
// 端点
// ============================================================

/** 单个 API 端点 */
export interface ApiEndpoint {
  /** 唯一 ID (如 'chat-completions', 'list-keys') */
  id: string;
  /** HTTP 方法 */
  method: HttpMethod;
  /** 路径 (如 '/v1/chat/completions') */
  path: string;
  /** 端点名称 (如 'Create Chat Completion') */
  name: string;
  /** 简短描述 */
  summary: string;
  /** 详细描述 (支持 Markdown) */
  description?: string;
  /** 所属 API 模式 */
  mode: ApiMode;
  /** 所属分组 ID */
  groupId: string;
  /** 认证方式 */
  auth: AuthType;
  /** 请求参数 */
  parameters: ApiParam[];
  /** 请求 Body Content-Type */
  requestContentType?: string;
  /** 响应列表 */
  responses: ApiResponse[];
  /** 是否支持流式响应 (SSE) */
  streaming?: boolean;
  /** 标签 (beta, deprecated 等) */
  tags?: string[];
  /** 速率限制描述 */
  rateLimit?: string;
  /** 请求示例 Body */
  requestExample?: unknown;
}

// ============================================================
// 端点分组
// ============================================================

/** 端点分组 */
export interface ApiGroup {
  /** 分组 ID */
  id: string;
  /** 分组名称 */
  name: string;
  /** 分组描述 */
  description?: string;
  /** 所属 API 模式 */
  mode: ApiMode;
  /** 分组图标 (emoji) */
  icon?: string;
  /** 排序权重 */
  order: number;
}

// ============================================================
// 错误码
// ============================================================

export interface ApiErrorCode {
  /** 错误码 (如 'invalid_api_key') */
  code: string;
  /** HTTP 状态码 */
  httpStatus: number;
  /** 描述 */
  description: string;
  /** 解决建议 */
  resolution?: string;
}

// ============================================================
// 代码示例
// ============================================================

export interface CodeExample {
  /** 语言 */
  language: CodeLanguage;
  /** 语言显示名 */
  label: string;
  /** 代码内容 */
  code: string;
}

// ============================================================
// Playground
// ============================================================

/** Playground 请求配置 */
export interface PlaygroundRequest {
  /** 目标端点 */
  endpoint: ApiEndpoint;
  /** 请求头 */
  headers: Record<string, string>;
  /** 路径参数值 */
  pathParams: Record<string, string>;
  /** Query 参数值 */
  queryParams: Record<string, string>;
  /** 请求 Body (JSON 字符串) */
  body: string;
  /** 是否启用流式 */
  streaming: boolean;
}

/** Playground 响应 */
export interface PlaygroundResponse {
  /** HTTP 状态码 */
  status: number;
  /** 状态文本 */
  statusText: string;
  /** 响应头 */
  headers: Record<string, string>;
  /** 响应 Body */
  body: string;
  /** 请求耗时 (ms) */
  duration: number;
  /** 响应大小 (bytes) */
  size: number;
  /** 是否为流式响应 */
  streamed: boolean;
  /** 错误信息 */
  error?: string;
}

// ============================================================
// 搜索
// ============================================================

export interface SearchResult {
  /** 端点 */
  endpoint: ApiEndpoint;
  /** 匹配类型 */
  matchType: 'name' | 'path' | 'description' | 'parameter';
  /** 匹配的关键词 */
  matchedText: string;
  /** 相关度评分 */
  score: number;
}

// ============================================================
// 文档站配置
// ============================================================

export interface ApiDocsConfig {
  /** 文档站标题 */
  title: string;
  /** API Base URL */
  baseUrl: string;
  /** 默认 API 模式 */
  defaultMode: ApiMode;
  /** 是否启用 Playground */
  playgroundEnabled: boolean;
  /** 代码示例语言（按顺序） */
  codeLanguages: CodeLanguage[];
  /** 默认 Authorization 值 */
  defaultAuthValue: string;
  /** 是否显示速率限制 */
  showRateLimit: boolean;
  /** 是否显示废弃端点 */
  showDeprecated: boolean;
}
