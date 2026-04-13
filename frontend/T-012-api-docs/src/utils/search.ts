/**
 * 端点全文搜索
 *
 * 支持按端点名、路径、描述、参数名搜索
 */

import type { ApiEndpoint, SearchResult } from '../types/api-docs';

/**
 * 搜索端点列表
 *
 * @param endpoints 所有端点
 * @param query 搜索关键词
 * @param maxResults 最大返回数
 * @returns 按相关度排序的搜索结果
 */
export function searchEndpoints(
  endpoints: ApiEndpoint[],
  query: string,
  maxResults = 20
): SearchResult[] {
  if (!query || query.trim().length === 0) return [];

  const q = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  for (const endpoint of endpoints) {
    let bestScore = 0;
    let matchType: SearchResult['matchType'] = 'name';
    let matchedText = '';

    // 1. 名称匹配（最高权重）
    const nameScore = scoreMatch(endpoint.name.toLowerCase(), q);
    if (nameScore > bestScore) {
      bestScore = nameScore * 10;
      matchType = 'name';
      matchedText = endpoint.name;
    }

    // 2. 路径匹配
    const pathScore = scoreMatch(endpoint.path.toLowerCase(), q);
    if (pathScore * 8 > bestScore) {
      bestScore = pathScore * 8;
      matchType = 'path';
      matchedText = endpoint.path;
    }

    // 3. 描述匹配
    const summaryScore = scoreMatch(endpoint.summary.toLowerCase(), q);
    if (summaryScore * 5 > bestScore) {
      bestScore = summaryScore * 5;
      matchType = 'description';
      matchedText = endpoint.summary;
    }

    if (endpoint.description) {
      const descScore = scoreMatch(endpoint.description.toLowerCase(), q);
      if (descScore * 3 > bestScore) {
        bestScore = descScore * 3;
        matchType = 'description';
        matchedText = endpoint.description.slice(0, 100);
      }
    }

    // 4. 参数名匹配
    for (const param of endpoint.parameters) {
      const paramScore = scoreMatch(param.name.toLowerCase(), q);
      if (paramScore * 4 > bestScore) {
        bestScore = paramScore * 4;
        matchType = 'parameter';
        matchedText = param.name;
      }

      // 搜索子字段
      if (param.children) {
        for (const child of param.children) {
          const childScore = scoreMatch(child.name.toLowerCase(), q);
          if (childScore * 3 > bestScore) {
            bestScore = childScore * 3;
            matchType = 'parameter';
            matchedText = `${param.name}.${child.name}`;
          }
        }
      }
    }

    if (bestScore > 0) {
      results.push({
        endpoint,
        matchType,
        matchedText,
        score: bestScore,
      });
    }
  }

  // 按评分排序
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, maxResults);
}

/**
 * 简单字符串匹配评分
 * - 完全匹配 → 100
 * - 前缀匹配 → 80
 * - 包含匹配 → 50
 * - 不匹配 → 0
 */
function scoreMatch(text: string, query: string): number {
  if (text === query) return 100;
  if (text.startsWith(query)) return 80;
  if (text.includes(query)) return 50;

  // 多词匹配：所有词都出现则得分
  const words = query.split(/\s+/);
  if (words.length > 1) {
    const allPresent = words.every((w) => text.includes(w));
    if (allPresent) return 40;
  }

  return 0;
}

/**
 * 高亮匹配的文本片段
 */
export function highlightMatch(text: string, query: string): string {
  if (!query) return text;

  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
    'gi'
  );
  return text.replace(regex, '<mark>$1</mark>');
}
