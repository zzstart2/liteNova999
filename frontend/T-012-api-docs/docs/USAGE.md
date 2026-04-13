# API 文档站 — 使用文档

## 快速开始

### 1. 嵌入页面

```vue
<script setup>
import ApiDocsPage from './pages/ApiDocsPage.vue';
</script>

<template>
  <ApiDocsPage />
</template>
```

默认会展示 Passthrough 模式的端点。

### 2. 集成品牌系统 (T-010)

```vue
<template>
  <BrandProvider :config="brandConfig" theme="auto">
    <ApiDocsPage />
  </BrandProvider>
</template>
```

所有颜色通过 CSS 变量 (`--brand-*`) 继承品牌配置。

### 3. 自定义配置

```vue
<script setup>
import type { ApiDocsConfig } from './types/api-docs';
import ApiDocsPage from './pages/ApiDocsPage.vue';

const myConfig: Partial<ApiDocsConfig> = {
  title: 'My API Docs',
  baseUrl: 'https://my-api.com',
  playgroundEnabled: true,
  defaultMode: 'platform',
  defaultAuthValue: 'my-secret-key',
  codeLanguages: ['curl', 'python'],
};
</script>

<template>
  <ApiDocsPage :config-overrides="myConfig" />
</template>
```

## 组件层级

```
ApiDocsPage (主页面)
├── DocsSidebar (侧边栏)
│   ├── 模式切换 (Passthrough / Platform)
│   ├── 搜索框
│   └── 导航树 (分组 + 端点)
└── EndpointPage (端点详情)
    ├── EndpointHeader (方法+路径+名称)
    ├── AuthSection (认证说明)
    ├── ParameterTable (参数表)
    ├── ResponseSchema (响应结构)
    ├── CodeExamples (多语言代码)
    └── PlaygroundPanel (交互式 Playground)
```

## 代码示例生成

```ts
import { generateCodeExamples } from './utils/code-generator';

const examples = generateCodeExamples(endpoint, {
  baseUrl: 'https://api.lite999.com',
  authValue: 'sk-...',
  body: JSON.stringify({ model: 'gpt-4o', messages: [] }),
});
// => [{ language: 'curl', code: '...' }, { language: 'python', code: '...' }, ...]
```

## Playground

```ts
import { usePlayground } from './composables/use-playground';

const { state, requestBody, response, send } = usePlayground(
  'https://api.lite999.com',
  'sk-lite-...'
);

// 初始化端点
initFromEndpoint(endpoint);

// 发送请求
await send();

// 流式响应
// state === 'streaming' 时，streamBuffer 实时更新
```

## 搜索

```ts
import { searchEndpoints } from './utils/search';

const results = searchEndpoints(allEndpoints, 'chat completion');
// => [{ endpoint, matchType: 'name', matchedText: 'Chat Completion', score: 80 }, ...]
```

## 端点数据结构

每个端点包含：

- `id` — 唯一标识
- `method` — GET/POST/PUT/DELETE
- `path` — 路径模板，如 `/v1/chat/completions`
- `parameters` — 参数列表，含类型、位置、描述、示例
- `responses` — 响应列表，含状态码、示例
- `streaming` — 是否支持 SSE 流式
- `auth` — 认证方式

## 双模式

| 模式 | 用途 | 端点示例 |
|------|------|----------|
| `passthrough` | OpenAI 兼容透传 | `/v1/chat/completions` |
| `platform` | 平台管理接口 | `/api/v1/keys` |

切换模式会自动过滤侧边栏分组。

## 国际化

文案已抽取至数据文件中：
- `data/passthrough-endpoints.ts` — 原生透传端点定义
- `data/platform-endpoints.ts` — 平台端点定义
- `data/error-codes.ts` — 错误码

修改这些文件即可本地化或扩展端点。