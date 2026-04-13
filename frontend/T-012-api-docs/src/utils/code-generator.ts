/**
 * 多语言代码示例生成器
 *
 * 根据 API 端点和参数值生成 cURL / Python / JavaScript / Go 代码片段
 */

import type { ApiEndpoint, CodeExample, CodeLanguage } from '../types/api-docs';

export interface CodeGenContext {
  /** API Base URL */
  baseUrl: string;
  /** Authorization 值 */
  authValue: string;
  /** 路径参数值 */
  pathParams?: Record<string, string>;
  /** Query 参数值 */
  queryParams?: Record<string, string>;
  /** Body JSON 字符串 */
  body?: string;
  /** 是否流式 */
  streaming?: boolean;
}

// ============================================================
// URL 构建
// ============================================================

function buildUrl(
  baseUrl: string,
  path: string,
  pathParams?: Record<string, string>,
  queryParams?: Record<string, string>
): string {
  let url = `${baseUrl.replace(/\/+$/, '')}${path}`;

  // 替换路径参数
  if (pathParams) {
    for (const [key, value] of Object.entries(pathParams)) {
      url = url.replace(`{${key}}`, encodeURIComponent(value));
    }
  }

  // 添加查询参数
  if (queryParams) {
    const entries = Object.entries(queryParams).filter(([, v]) => v !== '' && v !== undefined);
    if (entries.length > 0) {
      const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      url += `?${qs}`;
    }
  }

  return url;
}

// ============================================================
// cURL
// ============================================================

function generateCurl(endpoint: ApiEndpoint, ctx: CodeGenContext): string {
  const url = buildUrl(ctx.baseUrl, endpoint.path, ctx.pathParams, ctx.queryParams);
  const lines: string[] = [`curl ${url}`];

  lines.push(`  -H "Authorization: Bearer ${ctx.authValue}"`);

  if (endpoint.requestContentType) {
    lines.push(`  -H "Content-Type: ${endpoint.requestContentType}"`);
  }

  if (endpoint.method !== 'GET') {
    lines.push(`  -X ${endpoint.method}`);
  }

  if (ctx.body && endpoint.method !== 'GET') {
    // 整理 JSON 为紧凑型一行或多行
    try {
      const obj = JSON.parse(ctx.body);
      const formatted = JSON.stringify(obj, null, 2);
      lines.push(`  -d '${formatted}'`);
    } catch {
      lines.push(`  -d '${ctx.body}'`);
    }
  }

  return lines.join(' \\\n');
}

// ============================================================
// Python
// ============================================================

function generatePython(endpoint: ApiEndpoint, ctx: CodeGenContext): string {
  const url = buildUrl(ctx.baseUrl, endpoint.path, ctx.pathParams);
  const hasBody = ctx.body && endpoint.method !== 'GET';
  const hasQuery = ctx.queryParams && Object.keys(ctx.queryParams).length > 0;

  const lines: string[] = [];

  // 判断是否为 OpenAI 兼容的 chat completion
  if (endpoint.id === 'create-chat-completion') {
    lines.push('from openai import OpenAI');
    lines.push('');
    lines.push('client = OpenAI(');
    lines.push(`    api_key="${ctx.authValue}",`);
    lines.push(`    base_url="${ctx.baseUrl}${endpoint.path.replace('/chat/completions', '')}",`);
    lines.push(')');
    lines.push('');

    if (ctx.streaming) {
      lines.push('stream = client.chat.completions.create(');
      if (hasBody) {
        try {
          const obj = JSON.parse(ctx.body!);
          obj.stream = true;
          for (const [k, v] of Object.entries(obj)) {
            lines.push(`    ${k}=${pythonValue(v)},`);
          }
        } catch {
          lines.push(`    # body: ${ctx.body}`);
        }
      }
      lines.push(')');
      lines.push('');
      lines.push('for chunk in stream:');
      lines.push('    if chunk.choices[0].delta.content:');
      lines.push('        print(chunk.choices[0].delta.content, end="")');
    } else {
      lines.push('response = client.chat.completions.create(');
      if (hasBody) {
        try {
          const obj = JSON.parse(ctx.body!);
          for (const [k, v] of Object.entries(obj)) {
            lines.push(`    ${k}=${pythonValue(v)},`);
          }
        } catch {
          lines.push(`    # body: ${ctx.body}`);
        }
      }
      lines.push(')');
      lines.push('');
      lines.push('print(response.choices[0].message.content)');
    }

    return lines.join('\n');
  }

  // 通用 requests 模式
  lines.push('import requests');
  lines.push('');
  lines.push(`url = "${url}"`);
  lines.push('headers = {');
  lines.push(`    "Authorization": "Bearer ${ctx.authValue}",`);
  if (endpoint.requestContentType) {
    lines.push(`    "Content-Type": "${endpoint.requestContentType}",`);
  }
  lines.push('}');

  if (hasQuery) {
    lines.push(`params = ${pythonValue(ctx.queryParams)}`);
  }

  if (hasBody) {
    try {
      const obj = JSON.parse(ctx.body!);
      lines.push(`data = ${pythonValue(obj)}`);
    } catch {
      lines.push(`data = ${ctx.body}`);
    }
  }

  lines.push('');
  const method = endpoint.method.toLowerCase();
  const args = [`url`, `headers=headers`];
  if (hasQuery) args.push('params=params');
  if (hasBody) args.push('json=data');
  lines.push(`response = requests.${method}(${args.join(', ')})`);
  lines.push('print(response.json())');

  return lines.join('\n');
}

function pythonValue(val: unknown): string {
  if (val === null) return 'None';
  if (val === true) return 'True';
  if (val === false) return 'False';
  if (typeof val === 'string') return `"${val}"`;
  if (Array.isArray(val)) {
    return `[${val.map(pythonValue).join(', ')}]`;
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val as Record<string, unknown>)
      .map(([k, v]) => `"${k}": ${pythonValue(v)}`)
      .join(', ');
    return `{${entries}}`;
  }
  return String(val);
}

// ============================================================
// JavaScript (Node.js)
// ============================================================

function generateJavaScript(endpoint: ApiEndpoint, ctx: CodeGenContext): string {
  const url = buildUrl(ctx.baseUrl, endpoint.path, ctx.pathParams, ctx.queryParams);
  const hasBody = ctx.body && endpoint.method !== 'GET';

  const lines: string[] = [];

  // OpenAI SDK 模式
  if (endpoint.id === 'create-chat-completion') {
    lines.push('import OpenAI from "openai";');
    lines.push('');
    lines.push('const client = new OpenAI({');
    lines.push(`  apiKey: "${ctx.authValue}",`);
    lines.push(`  baseURL: "${ctx.baseUrl}${endpoint.path.replace('/chat/completions', '')}",`);
    lines.push('});');
    lines.push('');

    if (ctx.streaming) {
      lines.push('const stream = await client.chat.completions.create({');
      if (hasBody) {
        try {
          const obj = JSON.parse(ctx.body!);
          obj.stream = true;
          for (const [k, v] of Object.entries(obj)) {
            lines.push(`  ${k}: ${JSON.stringify(v)},`);
          }
        } catch {/**/}
      }
      lines.push('});');
      lines.push('');
      lines.push('for await (const chunk of stream) {');
      lines.push('  process.stdout.write(chunk.choices[0]?.delta?.content || "");');
      lines.push('}');
    } else {
      lines.push('const response = await client.chat.completions.create({');
      if (hasBody) {
        try {
          const obj = JSON.parse(ctx.body!);
          for (const [k, v] of Object.entries(obj)) {
            lines.push(`  ${k}: ${JSON.stringify(v)},`);
          }
        } catch {/**/}
      }
      lines.push('});');
      lines.push('');
      lines.push('console.log(response.choices[0].message.content);');
    }

    return lines.join('\n');
  }

  // 通用 fetch 模式
  lines.push(`const response = await fetch("${url}", {`);
  lines.push(`  method: "${endpoint.method}",`);
  lines.push('  headers: {');
  lines.push(`    "Authorization": "Bearer ${ctx.authValue}",`);
  if (endpoint.requestContentType) {
    lines.push(`    "Content-Type": "${endpoint.requestContentType}",`);
  }
  lines.push('  },');
  if (hasBody) {
    lines.push(`  body: JSON.stringify(${ctx.body}),`);
  }
  lines.push('});');
  lines.push('');
  lines.push('const data = await response.json();');
  lines.push('console.log(data);');

  return lines.join('\n');
}

// ============================================================
// Go
// ============================================================

function generateGo(endpoint: ApiEndpoint, ctx: CodeGenContext): string {
  const url = buildUrl(ctx.baseUrl, endpoint.path, ctx.pathParams, ctx.queryParams);
  const hasBody = ctx.body && endpoint.method !== 'GET';

  const lines: string[] = [
    'package main',
    '',
    'import (',
    '	"fmt"',
    '	"io"',
    '	"net/http"',
  ];

  if (hasBody) {
    lines.push('	"strings"');
  }

  lines.push(')');
  lines.push('');
  lines.push('func main() {');

  if (hasBody) {
    try {
      const formatted = JSON.stringify(JSON.parse(ctx.body!), null, 2);
      lines.push(`	body := strings.NewReader(\`${formatted}\`)`);
    } catch {
      lines.push(`	body := strings.NewReader(\`${ctx.body}\`)`);
    }
    lines.push(`	req, _ := http.NewRequest("${endpoint.method}", "${url}", body)`);
  } else {
    lines.push(`	req, _ := http.NewRequest("${endpoint.method}", "${url}", nil)`);
  }

  lines.push(`	req.Header.Set("Authorization", "Bearer ${ctx.authValue}")`);
  if (endpoint.requestContentType) {
    lines.push(`	req.Header.Set("Content-Type", "${endpoint.requestContentType}")`);
  }
  lines.push('');
  lines.push('	resp, err := http.DefaultClient.Do(req)');
  lines.push('	if err != nil {');
  lines.push('		panic(err)');
  lines.push('	}');
  lines.push('	defer resp.Body.Close()');
  lines.push('');
  lines.push('	result, _ := io.ReadAll(resp.Body)');
  lines.push('	fmt.Println(string(result))');
  lines.push('}');

  return lines.join('\n');
}

// ============================================================
// 公共 API
// ============================================================

const GENERATORS: Record<CodeLanguage, (ep: ApiEndpoint, ctx: CodeGenContext) => string> = {
  curl: generateCurl,
  python: generatePython,
  javascript: generateJavaScript,
  go: generateGo,
};

const LABELS: Record<CodeLanguage, string> = {
  curl: 'cURL',
  python: 'Python',
  javascript: 'Node.js',
  go: 'Go',
};

/**
 * 为指定端点生成所有语言的代码示例
 */
export function generateCodeExamples(
  endpoint: ApiEndpoint,
  ctx: CodeGenContext,
  languages: CodeLanguage[] = ['curl', 'python', 'javascript', 'go']
): CodeExample[] {
  return languages.map((lang) => ({
    language: lang,
    label: LABELS[lang],
    code: GENERATORS[lang](endpoint, ctx),
  }));
}

/**
 * 生成单个语言的代码
 */
export function generateCode(
  endpoint: ApiEndpoint,
  ctx: CodeGenContext,
  language: CodeLanguage
): string {
  return GENERATORS[language](endpoint, ctx);
}
