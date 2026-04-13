/**
 * 搜索工具测试
 */

import { describe, it, expect } from 'vitest';
import { searchEndpoints, highlightMatch } from '../src/utils/search';
import type { ApiEndpoint } from '../src/types/api-docs';

// ---- 测试数据 ----

const endpoints: ApiEndpoint[] = [
  {
    id: 'create-chat-completion',
    method: 'POST',
    path: '/v1/chat/completions',
    name: 'Create Chat Completion',
    summary: 'Creates a model response for a chat conversation.',
    mode: 'passthrough',
    groupId: 'pt-chat',
    auth: 'bearer',
    parameters: [
      { name: 'model', location: 'body', type: 'string', required: true, description: 'Model ID' },
      { name: 'messages', location: 'body', type: 'array', required: true, description: 'Messages' },
      { name: 'temperature', location: 'body', type: 'number', required: false, description: 'Sampling temp' },
    ],
    responses: [{ statusCode: 200, description: 'OK' }],
  },
  {
    id: 'list-models',
    method: 'GET',
    path: '/v1/models',
    name: 'List Models',
    summary: 'Lists the currently available models.',
    mode: 'passthrough',
    groupId: 'pt-models',
    auth: 'bearer',
    parameters: [],
    responses: [{ statusCode: 200, description: 'OK' }],
  },
  {
    id: 'list-keys',
    method: 'GET',
    path: '/api/v1/keys',
    name: 'List API Keys',
    summary: 'List all API keys for the current user.',
    mode: 'platform',
    groupId: 'pl-keys',
    auth: 'bearer',
    parameters: [
      { name: 'limit', location: 'query', type: 'integer', required: false, description: 'Max results' },
    ],
    responses: [{ statusCode: 200, description: 'OK' }],
  },
  {
    id: 'get-usage-summary',
    method: 'GET',
    path: '/api/v1/usage/summary',
    name: 'Get Usage Summary',
    summary: 'Get aggregated usage summary with cost breakdown.',
    mode: 'platform',
    groupId: 'pl-usage',
    auth: 'bearer',
    parameters: [],
    responses: [{ statusCode: 200, description: 'OK' }],
  },
];

// ============================================================
// searchEndpoints
// ============================================================

describe('searchEndpoints', () => {
  it('should return empty for empty query', () => {
    expect(searchEndpoints(endpoints, '')).toEqual([]);
    expect(searchEndpoints(endpoints, '  ')).toEqual([]);
  });

  it('should find endpoint by name', () => {
    const results = searchEndpoints(endpoints, 'chat');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].endpoint.id).toBe('create-chat-completion');
  });

  it('should find endpoint by path', () => {
    const results = searchEndpoints(endpoints, '/v1/models');
    expect(results.some((r) => r.endpoint.id === 'list-models')).toBe(true);
  });

  it('should find endpoint by summary/description', () => {
    const results = searchEndpoints(endpoints, 'cost breakdown');
    expect(results.some((r) => r.endpoint.id === 'get-usage-summary')).toBe(true);
  });

  it('should find endpoint by parameter name', () => {
    const results = searchEndpoints(endpoints, 'temperature');
    expect(results.some((r) => r.endpoint.id === 'create-chat-completion')).toBe(true);
    expect(results[0].matchType).toBe('parameter');
  });

  it('should rank exact matches higher than partial', () => {
    const results = searchEndpoints(endpoints, 'List Models');
    expect(results[0].endpoint.id).toBe('list-models');
  });

  it('should respect maxResults limit', () => {
    const results = searchEndpoints(endpoints, 'list', 1);
    expect(results).toHaveLength(1);
  });

  it('should be case-insensitive', () => {
    const upper = searchEndpoints(endpoints, 'CHAT');
    const lower = searchEndpoints(endpoints, 'chat');
    expect(upper.length).toBe(lower.length);
    expect(upper[0].endpoint.id).toBe(lower[0].endpoint.id);
  });

  it('should return matchType correctly', () => {
    const nameResults = searchEndpoints(endpoints, 'Chat Completion');
    expect(nameResults[0].matchType).toBe('name');

    const pathResults = searchEndpoints(endpoints, '/api/v1/keys');
    const keyResult = pathResults.find((r) => r.endpoint.id === 'list-keys');
    expect(keyResult?.matchType).toBe('path');
  });

  it('should return scores > 0 for all results', () => {
    const results = searchEndpoints(endpoints, 'model');
    for (const r of results) {
      expect(r.score).toBeGreaterThan(0);
    }
  });

  it('should sort by score descending', () => {
    const results = searchEndpoints(endpoints, 'usage');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });
});

// ============================================================
// highlightMatch
// ============================================================

describe('highlightMatch', () => {
  it('should wrap matching text in <mark> tags', () => {
    const result = highlightMatch('Create Chat Completion', 'Chat');
    expect(result).toBe('Create <mark>Chat</mark> Completion');
  });

  it('should be case-insensitive', () => {
    const result = highlightMatch('Create Chat Completion', 'chat');
    expect(result).toContain('<mark>');
    expect(result.toLowerCase()).toContain('<mark>chat</mark>');
  });

  it('should return original text for empty query', () => {
    expect(highlightMatch('Hello', '')).toBe('Hello');
  });

  it('should handle regex special characters', () => {
    const result = highlightMatch('path: /v1/models', '/v1');
    expect(result).toContain('<mark>/v1</mark>');
  });

  it('should highlight all occurrences', () => {
    const result = highlightMatch('model model model', 'model');
    const count = (result.match(/<mark>/g) || []).length;
    expect(count).toBe(3);
  });
});
