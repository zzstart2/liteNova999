/**
 * 代码生成器测试
 */

import { describe, it, expect } from 'vitest';
import { generateCodeExamples, generateCode } from '../src/utils/code-generator';
import type { ApiEndpoint, CodeLanguage } from '../src/types/api-docs';

// ---- 测试用端点 ----

const chatEndpoint: ApiEndpoint = {
  id: 'create-chat-completion',
  method: 'POST',
  path: '/v1/chat/completions',
  name: 'Create Chat Completion',
  summary: 'Creates a chat completion.',
  mode: 'passthrough',
  groupId: 'pt-chat',
  auth: 'bearer',
  parameters: [],
  requestContentType: 'application/json',
  responses: [{ statusCode: 200, description: 'OK' }],
  streaming: true,
};

const listKeysEndpoint: ApiEndpoint = {
  id: 'list-keys',
  method: 'GET',
  path: '/api/v1/keys',
  name: 'List API Keys',
  summary: 'List all API keys.',
  mode: 'platform',
  groupId: 'pl-keys',
  auth: 'bearer',
  parameters: [
    { name: 'limit', location: 'query', type: 'integer', required: false, description: 'Max results' },
  ],
  responses: [{ statusCode: 200, description: 'OK' }],
};

const ctx = {
  baseUrl: 'https://api.lite999.com',
  authValue: 'sk-lite-test-key',
  body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'Hello' }] }),
};

// ============================================================
// generateCodeExamples
// ============================================================

describe('generateCodeExamples', () => {
  it('should generate examples for all 4 default languages', () => {
    const examples = generateCodeExamples(chatEndpoint, ctx);
    expect(examples).toHaveLength(4);
    const langs = examples.map((e) => e.language);
    expect(langs).toEqual(['curl', 'python', 'javascript', 'go']);
  });

  it('should respect custom language list', () => {
    const examples = generateCodeExamples(chatEndpoint, ctx, ['curl', 'python']);
    expect(examples).toHaveLength(2);
    expect(examples[0].language).toBe('curl');
    expect(examples[1].language).toBe('python');
  });

  it('should include label for each example', () => {
    const examples = generateCodeExamples(chatEndpoint, ctx);
    expect(examples[0].label).toBe('cURL');
    expect(examples[1].label).toBe('Python');
    expect(examples[2].label).toBe('Node.js');
    expect(examples[3].label).toBe('Go');
  });

  it('should produce non-empty code', () => {
    const examples = generateCodeExamples(chatEndpoint, ctx);
    for (const ex of examples) {
      expect(ex.code.length).toBeGreaterThan(10);
    }
  });
});

// ============================================================
// generateCode — cURL
// ============================================================

describe('generateCode: cURL', () => {
  it('should include the URL', () => {
    const code = generateCode(chatEndpoint, ctx, 'curl');
    expect(code).toContain('https://api.lite999.com/v1/chat/completions');
  });

  it('should include Authorization header', () => {
    const code = generateCode(chatEndpoint, ctx, 'curl');
    expect(code).toContain('Bearer sk-lite-test-key');
  });

  it('should include -X POST for POST methods', () => {
    const code = generateCode(chatEndpoint, ctx, 'curl');
    expect(code).toContain('-X POST');
  });

  it('should include body with -d', () => {
    const code = generateCode(chatEndpoint, ctx, 'curl');
    expect(code).toContain("-d '");
    expect(code).toContain('"model"');
  });

  it('should NOT include -X for GET endpoints', () => {
    const code = generateCode(listKeysEndpoint, { ...ctx, body: undefined }, 'curl');
    expect(code).not.toContain('-X GET');
  });
});

// ============================================================
// generateCode — Python
// ============================================================

describe('generateCode: Python', () => {
  it('should use OpenAI SDK for chat completion endpoint', () => {
    const code = generateCode(chatEndpoint, ctx, 'python');
    expect(code).toContain('from openai import OpenAI');
    expect(code).toContain('client = OpenAI(');
  });

  it('should use requests for non-chat endpoints', () => {
    const code = generateCode(listKeysEndpoint, { ...ctx, body: undefined }, 'python');
    expect(code).toContain('import requests');
  });

  it('should include auth token', () => {
    const code = generateCode(chatEndpoint, ctx, 'python');
    expect(code).toContain('sk-lite-test-key');
  });

  it('should generate streaming code when streaming=true', () => {
    const code = generateCode(chatEndpoint, { ...ctx, streaming: true }, 'python');
    expect(code).toContain('for chunk in stream');
  });
});

// ============================================================
// generateCode — JavaScript
// ============================================================

describe('generateCode: JavaScript', () => {
  it('should use OpenAI SDK for chat completion', () => {
    const code = generateCode(chatEndpoint, ctx, 'javascript');
    expect(code).toContain('import OpenAI from "openai"');
  });

  it('should use fetch for non-chat endpoints', () => {
    const code = generateCode(listKeysEndpoint, { ...ctx, body: undefined }, 'javascript');
    expect(code).toContain('fetch(');
  });

  it('should generate streaming code', () => {
    const code = generateCode(chatEndpoint, { ...ctx, streaming: true }, 'javascript');
    expect(code).toContain('for await');
  });
});

// ============================================================
// generateCode — Go
// ============================================================

describe('generateCode: Go', () => {
  it('should include package main', () => {
    const code = generateCode(chatEndpoint, ctx, 'go');
    expect(code).toContain('package main');
  });

  it('should use http.NewRequest', () => {
    const code = generateCode(chatEndpoint, ctx, 'go');
    expect(code).toContain('http.NewRequest');
  });

  it('should include strings import for POST body', () => {
    const code = generateCode(chatEndpoint, ctx, 'go');
    expect(code).toContain('"strings"');
  });

  it('should NOT include strings import for GET', () => {
    const code = generateCode(listKeysEndpoint, { ...ctx, body: undefined }, 'go');
    expect(code).not.toContain('"strings"');
  });
});

// ============================================================
// URL 构建
// ============================================================

describe('URL building', () => {
  it('should substitute path params', () => {
    const ep: ApiEndpoint = {
      ...listKeysEndpoint,
      id: 'retrieve-model',
      method: 'GET',
      path: '/v1/models/{model_id}',
    };
    const code = generateCode(ep, {
      ...ctx,
      pathParams: { model_id: 'gpt-4o' },
      body: undefined,
    }, 'curl');
    expect(code).toContain('/v1/models/gpt-4o');
    expect(code).not.toContain('{model_id}');
  });

  it('should append query params', () => {
    const code = generateCode(listKeysEndpoint, {
      ...ctx,
      queryParams: { limit: '10' },
      body: undefined,
    }, 'curl');
    expect(code).toContain('limit=10');
  });
});
