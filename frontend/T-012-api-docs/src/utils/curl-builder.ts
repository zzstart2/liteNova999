/**
 * cURL 命令构建器
 *
 * 独立的 cURL 命令生成工具，支持各种选项
 */

export interface CurlOptions {
  /** 请求 URL */
  url: string;
  /** HTTP 方法 */
  method: string;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体 (字符串) */
  body?: string;
  /** 是否压缩 JSON 输出 (jq) */
  pretty?: boolean;
  /** 是否显示响应头 */
  showHeaders?: boolean;
  /** 超时 (秒) */
  timeout?: number;
  /** 是否使用 -N 禁用缓冲 (SSE) */
  noBuffer?: boolean;
}

/**
 * 构建 cURL 命令字符串
 */
export function buildCurl(options: CurlOptions): string {
  const parts: string[] = ['curl'];

  // 方法
  if (options.method && options.method !== 'GET') {
    parts.push(`-X ${options.method}`);
  }

  // URL
  parts.push(`"${options.url}"`);

  // Headers
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      parts.push(`-H "${key}: ${value}"`);
    }
  }

  // Body
  if (options.body) {
    try {
      const obj = JSON.parse(options.body);
      const formatted = JSON.stringify(obj, null, 2);
      parts.push(`-d '${formatted}'`);
    } catch {
      parts.push(`-d '${options.body}'`);
    }
  }

  // Options
  if (options.showHeaders) {
    parts.push('-i');
  }

  if (options.timeout) {
    parts.push(`--max-time ${options.timeout}`);
  }

  if (options.noBuffer) {
    parts.push('-N');
  }

  // Join with line continuations
  if (parts.length <= 3) {
    return parts.join(' ');
  }

  return parts.join(' \\\n  ');
}

/**
 * 从端点信息快速生成 cURL
 */
export function quickCurl(
  baseUrl: string,
  method: string,
  path: string,
  authToken: string,
  body?: unknown
): string {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${authToken}`,
  };

  let bodyStr: string | undefined;
  if (body && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    bodyStr = JSON.stringify(body);
  }

  return buildCurl({
    url: `${baseUrl.replace(/\/+$/, '')}${path}`,
    method,
    headers,
    body: bodyStr,
  });
}
