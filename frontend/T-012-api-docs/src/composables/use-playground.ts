/**
 * usePlayground - Playground 状态管理
 *
 * 管理请求编辑、发送、流式响应、状态追踪
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import type {
  ApiEndpoint,
  PlaygroundRequest,
  PlaygroundResponse,
} from '../types/api-docs';
import { buildCurl } from '../utils/curl-builder';

export type PlaygroundState = 'idle' | 'sending' | 'streaming' | 'done' | 'error';

export interface UsePlaygroundReturn {
  /** 当前状态 */
  state: Ref<PlaygroundState>;
  /** 请求 Body (JSON 字符串) */
  requestBody: Ref<string>;
  /** Auth token */
  authToken: Ref<string>;
  /** 路径参数 */
  pathParams: Ref<Record<string, string>>;
  /** Query 参数 */
  queryParams: Ref<Record<string, string>>;
  /** 是否启用流式 */
  streaming: Ref<boolean>;
  /** 响应数据 */
  response: Ref<PlaygroundResponse | null>;
  /** 流式输出缓冲 */
  streamBuffer: Ref<string>;
  /** 生成的 cURL 命令 */
  curlCommand: ComputedRef<string>;
  /** 发送请求 */
  send: () => Promise<void>;
  /** 取消请求 */
  cancel: () => void;
  /** 重置 */
  reset: () => void;
  /** 用端点信息初始化 */
  initFromEndpoint: (endpoint: ApiEndpoint) => void;
}

export function usePlayground(
  baseUrl: string,
  defaultAuth: string
): UsePlaygroundReturn {
  const state = ref<PlaygroundState>('idle');
  const requestBody = ref('{}');
  const authToken = ref(defaultAuth);
  const pathParams = ref<Record<string, string>>({});
  const queryParams = ref<Record<string, string>>({});
  const streaming = ref(false);
  const response = ref<PlaygroundResponse | null>(null);
  const streamBuffer = ref('');

  let currentEndpoint: ApiEndpoint | null = null;
  let abortController: AbortController | null = null;

  // ---- 从端点初始化 ----
  function initFromEndpoint(endpoint: ApiEndpoint) {
    currentEndpoint = endpoint;
    state.value = 'idle';
    response.value = null;
    streamBuffer.value = '';

    // 设置默认 body
    if (endpoint.requestExample) {
      requestBody.value = JSON.stringify(endpoint.requestExample, null, 2);
    } else {
      requestBody.value = '{}';
    }

    // 提取路径参数
    const pathParamMatches = endpoint.path.match(/\{(\w+)\}/g);
    const pp: Record<string, string> = {};
    if (pathParamMatches) {
      for (const match of pathParamMatches) {
        const name = match.slice(1, -1);
        const paramDef = endpoint.parameters.find((p) => p.name === name && p.location === 'path');
        pp[name] = paramDef?.example?.toString() || '';
      }
    }
    pathParams.value = pp;

    // 提取 query 参数默认值
    const qp: Record<string, string> = {};
    for (const param of endpoint.parameters.filter((p) => p.location === 'query')) {
      if (param.example !== undefined) {
        qp[param.name] = String(param.example);
      }
    }
    queryParams.value = qp;

    // 流式
    streaming.value = !!endpoint.streaming;
  }

  // ---- 构建 URL ----
  function buildRequestUrl(): string {
    if (!currentEndpoint) return baseUrl;

    let path = currentEndpoint.path;
    for (const [key, value] of Object.entries(pathParams.value)) {
      path = path.replace(`{${key}}`, encodeURIComponent(value));
    }

    let url = `${baseUrl.replace(/\/+$/, '')}${path}`;

    const qEntries = Object.entries(queryParams.value).filter(([, v]) => v !== '');
    if (qEntries.length > 0) {
      url += '?' + qEntries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    }

    return url;
  }

  // ---- cURL ----
  const curlCommand = computed(() => {
    if (!currentEndpoint) return '';

    const headers: Record<string, string> = {
      Authorization: `Bearer ${authToken.value}`,
    };
    if (currentEndpoint.requestContentType) {
      headers['Content-Type'] = currentEndpoint.requestContentType;
    }

    return buildCurl({
      url: buildRequestUrl(),
      method: currentEndpoint.method,
      headers,
      body: currentEndpoint.method !== 'GET' ? requestBody.value : undefined,
      noBuffer: streaming.value,
    });
  });

  // ---- 发送请求 ----
  async function send() {
    if (!currentEndpoint) return;

    abortController = new AbortController();
    state.value = 'sending';
    response.value = null;
    streamBuffer.value = '';

    const url = buildRequestUrl();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${authToken.value}`,
    };
    if (currentEndpoint.requestContentType) {
      headers['Content-Type'] = currentEndpoint.requestContentType;
    }

    const startTime = performance.now();

    try {
      const fetchOptions: RequestInit = {
        method: currentEndpoint.method,
        headers,
        signal: abortController.signal,
      };

      if (currentEndpoint.method !== 'GET' && requestBody.value) {
        fetchOptions.body = requestBody.value;
      }

      const res = await fetch(url, fetchOptions);
      const duration = Math.round(performance.now() - startTime);

      // 收集响应头
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        resHeaders[key] = value;
      });

      if (streaming.value && res.body && res.headers.get('content-type')?.includes('text/event-stream')) {
        // 流式响应
        state.value = 'streaming';
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        let fullBody = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullBody += chunk;
          streamBuffer.value += chunk;
        }

        response.value = {
          status: res.status,
          statusText: res.statusText,
          headers: resHeaders,
          body: fullBody,
          duration,
          size: new Blob([fullBody]).size,
          streamed: true,
        };
      } else {
        // 普通响应
        const body = await res.text();

        response.value = {
          status: res.status,
          statusText: res.statusText,
          headers: resHeaders,
          body,
          duration,
          size: new Blob([body]).size,
          streamed: false,
        };
      }

      state.value = 'done';
    } catch (err: any) {
      if (err.name === 'AbortError') {
        state.value = 'idle';
        return;
      }

      const duration = Math.round(performance.now() - startTime);
      response.value = {
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: '',
        duration,
        size: 0,
        streamed: false,
        error: err.message || String(err),
      };
      state.value = 'error';
    } finally {
      abortController = null;
    }
  }

  // ---- 取消 ----
  function cancel() {
    abortController?.abort();
    abortController = null;
    state.value = 'idle';
  }

  // ---- 重置 ----
  function reset() {
    cancel();
    response.value = null;
    streamBuffer.value = '';
    state.value = 'idle';
  }

  return {
    state,
    requestBody,
    authToken,
    pathParams,
    queryParams,
    streaming,
    response,
    streamBuffer,
    curlCommand,
    send,
    cancel,
    reset,
    initFromEndpoint,
  };
}
