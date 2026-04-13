# 品牌定制化配置系统 — 使用文档

## 快速开始

### 1. 安装 Provider

在应用根组件包裹 `BrandProvider`：

```vue
<!-- App.vue -->
<script setup lang="ts">
import { BrandProvider } from './brand';
import brandConfig from '../config/brand.default.json';
</script>

<template>
  <BrandProvider :config="brandConfig" theme="auto">
    <router-view />
  </BrandProvider>
</template>
```

### 2. 使用品牌色彩

CSS 变量会自动注入到 `:root`，直接在 CSS 中引用：

```css
.button-primary {
  background-color: var(--brand-primary);
  color: white;
  border-radius: var(--brand-radius);
}

.button-primary:hover {
  background-color: var(--brand-primary-600);
}

.card {
  background: var(--brand-surface);
  border: 1px solid var(--brand-border);
  color: var(--brand-text-primary);
}
```

或在组件中使用 Hook：

```vue
<script setup lang="ts">
import { useBrandColor } from './hooks/use-brand-color';

const { colors, getShade, getTextColor, cssVar } = useBrandColor();
</script>

<template>
  <div :style="{ backgroundColor: colors.primary, color: getTextColor(colors.primary) }">
    Primary Color Block
  </div>
</template>
```

### 3. 使用品牌文案

```vue
<script setup lang="ts">
import { useBrandText } from './hooks/use-brand-text';

const { brandName, slogan, copyright, t } = useBrandText();
</script>

<template>
  <header>
    <h1>{{ brandName }}</h1>
    <p>{{ slogan }}</p>
  </header>

  <nav>
    <a href="/">{{ t('nav.home') }}</a>
    <a href="/about">{{ t('nav.about') }}</a>
  </nav>

  <footer>
    <p>{{ copyright }}</p>
    <a href="/terms">{{ t('footer.terms') }}</a>
  </footer>
</template>
```

或使用 `BrandText` 组件：

```vue
<template>
  <BrandText text-key="nav.home" tag="a" />
  <BrandText text-key="footer.copyright" tag="p" />
  <BrandText text-key="greeting" :vars="{ name: userName }" />
</template>
```

### 4. 使用品牌 Logo

```vue
<template>
  <!-- 完整 Logo -->
  <BrandLogo variant="full" :height="40" />

  <!-- 仅图标 -->
  <BrandLogo variant="icon" :width="32" :height="32" />

  <!-- 暗色模式自动切换 -->
  <BrandLogo variant="full" auto-theme />
</template>
```

## 主题切换

```vue
<script setup lang="ts">
import { useBrand } from './hooks/use-brand';

const { themeMode, effectiveTheme, setTheme, toggleTheme } = useBrand();
</script>

<template>
  <span>Current: {{ effectiveTheme }}</span>
  <button @click="setTheme('light')">☀️ Light</button>
  <button @click="setTheme('dark')">🌙 Dark</button>
  <button @click="setTheme('auto')">🔄 Auto</button>
  <button @click="toggleTheme">Toggle</button>
</template>
```

## 远程配置加载

支持从后端 API 动态加载品牌配置（多租户/白标场景）：

```vue
<BrandProvider
  :config="staticOverrides"
  :load-options="{
    remoteUrl: '/api/brand/config',
    remoteHeaders: { 'X-Tenant-Id': tenantId },
    cacheKey: `brand_${tenantId}`,
    cacheTTL: 86400000,
    timeout: 5000,
  }"
  @config-loaded="onLoaded"
  @config-error="onError"
>
  <template #default>
    <router-view />
  </template>
</BrandProvider>
```

加载流程：
1. 先用静态配置同步渲染（避免闪烁）
2. 异步加载远程配置
3. 加载成功后自动合并并更新 UI
4. 失败时降级使用本地缓存
5. 缓存也没有则保持静态配置

## 运行时动态更新

```vue
<script setup lang="ts">
import { useBrand } from './hooks/use-brand';

const { updateConfig } = useBrand();

function applyCustomBrand() {
  updateConfig({
    color: {
      colors: {
        primary: '#0d9488',
      },
    },
    text: {
      brandName: 'Custom Brand',
      slogan: 'Dynamically Updated!',
    },
  });
}
</script>
```

## 白标配置示例

参考 `config/brand.example.json`，创建客户专属配置文件：

```json
{
  "meta": {
    "id": "client-abc",
    "tenantId": "abc-001"
  },
  "color": {
    "colors": {
      "primary": "#0d9488"
    }
  },
  "logo": {
    "full": {
      "src": "https://cdn.client-abc.com/logo.svg",
      "type": "url"
    }
  },
  "text": {
    "brandName": "Client ABC",
    "slogan": "Their Slogan Here"
  }
}
```

只需配置差异部分，其余自动继承默认配置。

## CSS 变量参考

### 语义色
| 变量 | 说明 |
|------|------|
| `--brand-primary` | 主色 |
| `--brand-secondary` | 辅色 |
| `--brand-accent` | 强调色 |
| `--brand-success` | 成功色 |
| `--brand-warning` | 警告色 |
| `--brand-danger` | 危险色 |
| `--brand-info` | 信息色 |
| `--brand-neutral` | 中性色 |

### 色阶 (每个语义色都有)
| 变量 | 说明 |
|------|------|
| `--brand-primary-50` | 最浅 |
| `--brand-primary-100` ~ `--brand-primary-400` | 浅色渐变 |
| `--brand-primary-500` | 基准色 |
| `--brand-primary-600` ~ `--brand-primary-900` | 深色渐变 |
| `--brand-primary-950` | 最深 |

### 主题色
| 变量 | 说明 |
|------|------|
| `--brand-bg` | 页面背景 |
| `--brand-surface` | 表面色（卡片等） |
| `--brand-text-primary` | 主要文字 |
| `--brand-text-secondary` | 次要文字 |
| `--brand-text-disabled` | 禁用文字 |
| `--brand-border` | 边框 |
| `--brand-divider` | 分割线 |
| `--brand-overlay` | 遮罩 |

### 圆角
| 变量 | 说明 |
|------|------|
| `--brand-radius` | 基准圆角 |
| `--brand-radius-sm` | 小圆角 |
| `--brand-radius-lg` | 大圆角 |
| `--brand-radius-xl` | 超大圆角 |
| `--brand-radius-full` | 全圆 (9999px) |

## 色彩调试

引入 `BrandColorPreview` 组件即可可视化所有品牌色彩及色阶：

```vue
<script setup>
import BrandColorPreview from './components/BrandColorPreview.vue';
</script>

<template>
  <BrandColorPreview />
</template>
```

## API 概览

### Hooks

| Hook | 用途 |
|------|------|
| `useBrand()` | 完整品牌上下文、主题切换、配置更新 |
| `useBrandColor()` | 色彩 token、色阶、对比度计算 |
| `useBrandText()` | 品牌文案、插值、存在性检查 |

### Components

| 组件 | 用途 |
|------|------|
| `<BrandProvider>` | 品牌上下文提供者（包裹应用根） |
| `<BrandLogo>` | Logo 渲染（多变体、主题适配） |
| `<BrandText>` | 声明式品牌文案渲染 |
| `<BrandColorPreview>` | 色彩预览调试工具 |

### Engine (非 Vue 场景)

```ts
import { createBrandEngine } from './brand/brand-engine';
import config from './config/brand.default.json';

const engine = createBrandEngine(config);

engine.t('brandName');           // 'Lite999'
engine.setThemeMode('dark');     // 切换暗色
engine.mount();                  // 注入 CSS 变量到 DOM
engine.on('theme-changed', cb); // 监听事件
engine.destroy();                // 清理
```
