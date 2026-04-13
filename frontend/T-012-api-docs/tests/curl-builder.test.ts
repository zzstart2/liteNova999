/**
 * cURL 构建器测试
 */

import { describe, it, expect } from 'vitest';
import { buildCurl, quickCurl } from '../src/utils/curl-builder';

// ============================================================
// buildCurl
// ============================================================

describe('buildCurl', () => {
  it('should generate a simple GET request', () => {
    const cmd = buildCurl({ url: 'https://api.example.com/v1/models', method: 'GET' });
    expect(cmd).toContain('curl');
    expect(cmd).toContain('https://api.example.com/v1/models');
    expect(cmd).not.toContain('-X GET');
  });

  it('should include -X for non-GET methods', () => {
    const cmd = buildCurl({ url: 'https://api.example.com/v1/chat', method: 'POST' });
    expect(cmd).toContain('-X POST');
  });

  it('should include headers with -H', () => {
    const cmd = buildCurl({
      url: 'https://api.example.com',
      method: 'GET',
      headers: { Authorization: 'Bearer sk-test', 'Content-Type': 'application/json' },
    });
    expect(cmd).toContain('-H "Authorization: Bearer sk-test"');
    expect(cmd).toContain('-H "Content-Type: application/json"');
  });

  it('should include body with -d', () => {
    const body = JSON.stringify({ model: 'gpt-4o' });
    const cmd = buildCurl({ url: 'https://api.example.com', method: 'POST', body });
    expect(cmd).toContain("-d '");
    expect(cmd).toContain('"model"');
  });

  it('should format JSON body with indentation', () => {
    const body = JSON.stringify({ model: 'gpt-4o', temperature: 0.7 });
    const cmd = buildCurl({ url: 'https://api.example.com', method: 'POST', body });
    // Formatted JSON has newlines
    expect(cmd).toContain('\n');
  });

  it('should handle non-JSON body gracefully', () => {
    const cmd = buildCurl({ url: 'https://api.example.com', method: 'POST', body: 'not-json' });
    expect(cmd).toContain("-d 'not-json'");
  });

  it('should include -i when showHeaders is true', () => {
    const cmd = buildCurl({ url: 'https://api.example.com', method: 'GET', showHeaders: true });
    expect(cmd).toContain('-i');
  });

  it('should include --max-time when timeout is set', () => {
    const cmd = buildCurl({ url: 'https://api.example.com', method: 'GET', timeout: 30 });
    expect(cmd).toContain('--max-time 30');
  });

  it('should include -N when noBuffer is true (for SSE)', () => {
    const cmd = buildCurl({ url: 'https://api.example.com', method: 'GET', noBuffer: true });
    expect(cmd).toContain('-N');
  });

  it('should use line continuations for multi-part commands', () => {
    const cmd = buildCurl({
      url: 'https://api.example.com',
      method: 'POST',
      headers: { Authorization: 'Bearer sk-test' },
      body: '{"hello":"world"}',
    });
    expect(cmd).toContain(' \\\n');
  });

  it('should NOT use line continuations for very simple commands', () => {
    const cmd = buildCurl({ url: 'https://api.example.com', method: 'GET' });
    expect(cmd).not.toContain('\\');
  });
});

// ============================================================
// quickCurl
// ============================================================

describe('quickCurl', () => {
  it('should generate a complete cURL for a POST endpoint', () => {
    const cmd = quickCurl(
      'https://api.lite999.com',
      'POST',
      '/v1/chat/completions',
      'sk-lite-key',
      { model: 'gpt-4o' }
    );
    expect(cmd).toContain('https://api.lite999.com/v1/chat/completions');
    expect(cmd).toContain('Bearer sk-lite-key');
    expect(cmd).toContain('Content-Type: application/json');
    expect(cmd).toContain('"model"');
  });

  it('should generate a GET request without body', () => {
    const cmd = quickCurl('https://api.lite999.com', 'GET', '/v1/models', 'sk-lite-key');
    expect(cmd).toContain('/v1/models');
    expect(cmd).not.toContain('-d');
    expect(cmd).not.toContain('Content-Type');
  });

  it('should strip trailing slashes from baseUrl', () => {
    const cmd = quickCurl('https://api.lite999.com///', 'GET', '/v1/models', 'sk-key');
    expect(cmd).toContain('https://api.lite999.com/v1/models');
    expect(cmd).not.toContain('///');
  });

  it('should skip body for GET even if provided', () => {
    const cmd = quickCurl('https://api.lite999.com', 'GET', '/v1/models', 'sk-key', { foo: 'bar' });
    expect(cmd).not.toContain('-d');
  });

  it('should include DELETE method', () => {
    const cmd = quickCurl('https://api.lite999.com', 'DELETE', '/api/v1/keys/abc', 'sk-key');
    expect(cmd).toContain('-X DELETE');
  });
});
