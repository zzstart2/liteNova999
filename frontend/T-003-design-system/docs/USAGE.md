# T-003 Design System — Usage Guide

## Quick Start

### 1. Import CSS Tokens

Add the design system CSS to your app entry point (e.g., `main.ts` or `App.vue`):

```ts
// main.ts
import '@/tasks/T-003-design-system/src/base/reset.css';
import '@/tasks/T-003-design-system/src/tokens/index.css';
import '@/tasks/T-003-design-system/src/themes/light.css';
import '@/tasks/T-003-design-system/src/themes/dark.css';
import '@/tasks/T-003-design-system/src/base/global.css';
import '@/tasks/T-003-design-system/src/base/utilities.css';
```

### 2. Initialize Theme

```ts
// main.ts
import { initTheme } from '@/tasks/T-003-design-system/src';

const app = createApp(App);
// Initialize theme before mount for flicker-free loading
initTheme();
app.mount('#app');
```

### 3. Use Components

```vue
<script setup lang="ts">
import { LnButton, LnCard, LnInput } from '@/tasks/T-003-design-system/src';
</script>

<template>
  <LnCard hoverable>
    <template #header>
      <h3>Login</h3>
    </template>

    <LnInput label="Email" placeholder="you@example.com" />
    <LnInput label="Password" type="password" class="ln-mt-4" />

    <template #footer>
      <LnButton variant="primary">Sign In</LnButton>
      <LnButton variant="ghost">Cancel</LnButton>
    </template>
  </LnCard>
</template>
```

---

## Components

### LnButton

```vue
<LnButton variant="primary" size="md" :loading="isLoading" @click="handleClick">
  Save Changes
</LnButton>
```

**Props:**
| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'outline' \| 'ghost' \| 'danger'` | `'primary'` | Visual variant |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size |
| `loading` | `boolean` | `false` | Shows spinner, disables interaction |
| `disabled` | `boolean` | `false` | Disabled state |
| `as` | `'button' \| 'a'` | `'button'` | Rendered element |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | HTML type attribute |

### LnInput

```vue
<LnInput
  v-model="email"
  label="Email"
  placeholder="you@example.com"
  :error="emailError"
/>
```

**Props:**
| Prop | Type | Default | Description |
|---|---|---|---|
| `modelValue` | `string` | `''` | v-model value |
| `label` | `string` | — | Label text |
| `placeholder` | `string` | — | Placeholder |
| `error` | `string` | — | Error message (triggers error style) |
| `disabled` | `boolean` | `false` | Disabled state |
| `size` | `'md' \| 'lg'` | `'md'` | Size |
| `type` | `string` | `'text'` | HTML input type |
| `required` | `boolean` | `false` | Required field |

### LnCard

```vue
<LnCard hoverable>
  <template #header><h4>Title</h4></template>
  <p>Card content</p>
  <template #footer><LnButton>Action</LnButton></template>
</LnCard>
```

**Props:**
| Prop | Type | Default | Description |
|---|---|---|---|
| `hoverable` | `boolean` | `false` | Hover lift effect |
| `borderless` | `boolean` | `false` | Remove border |

**Slots:** `default` (body), `header`, `footer`

### LnBadge

```vue
<LnBadge variant="success">Active</LnBadge>
```

**Props:**
| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `'default' \| 'primary' \| 'success' \| 'warning' \| 'error'` | `'default'` | Semantic variant |

### LnModal

```vue
<LnModal v-model="showModal" title="Confirm" size="md">
  <p>Are you sure?</p>
  <template #footer>
    <LnButton variant="ghost" @click="showModal = false">Cancel</LnButton>
    <LnButton @click="confirm">Confirm</LnButton>
  </template>
</LnModal>
```

**Props:**
| Prop | Type | Default | Description |
|---|---|---|---|
| `modelValue` | `boolean` | `false` | v-model open state |
| `size` | `'md' \| 'lg'` | `'md'` | Width (480px / 640px) |
| `title` | `string` | — | Header title |
| `closeOnBackdrop` | `boolean` | `true` | Close on backdrop click |
| `closeOnEscape` | `boolean` | `true` | Close on Escape key |
| `showClose` | `boolean` | `true` | Show X button |

### LnToast

Place once in your App root:

```vue
<template>
  <LnToast />
</template>
```

Then use the composable anywhere:

```ts
const { success, error } = useToast();
success('Saved!', 'Your changes have been saved.');
error('Failed', 'Could not save changes.');
```

### LnNavbar

```vue
<LnNavbar :links="[
  { label: 'Home', href: '/', active: true },
  { label: 'Features', href: '/features' },
]">
  <template #logo>
    <img src="@/assets/logo.svg" alt="liteNova999" height="32" />
  </template>
  <template #actions>
    <LnButton size="sm">Get Started</LnButton>
  </template>
</LnNavbar>
```

### LnTable

```vue
<LnTable
  :columns="[
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'status', label: 'Status' },
  ]"
  :rows="users"
  hoverable
  @row-click="onRowClick"
>
  <template #cell-status="{ value }">
    <LnBadge :variant="value === 'Active' ? 'success' : 'default'">
      {{ value }}
    </LnBadge>
  </template>
</LnTable>
```

### LnIcon

```vue
<LnIcon size="md" label="Settings">
  <svg><!-- icon SVG --></svg>
</LnIcon>
```

---

## Composables

### useTheme

```ts
const { mode, resolvedTheme, isDark, setMode, toggle } = useTheme();

// Toggle dark mode
toggle();

// Set specific mode
setMode('dark');
setMode('system'); // follows OS preference
```

### useToast

```ts
const { toasts, add, remove, clear, success, error, warning, info } = useToast();

// Add with full options
add({ type: 'warning', title: 'Heads up', message: 'Detail text', duration: 8000 });
```

### useModal

```ts
const { isOpen, open, close, toggle } = useModal({
  closeOnEscape: true,
  lockScroll: true,
  onClose: () => console.log('closed'),
});
```

### useReducedMotion

```ts
const { prefersReducedMotion } = useReducedMotion();
// Use to conditionally skip animations
```

---

## Using Tokens in CSS

```css
.my-component {
  color: var(--color-text-primary);
  background: var(--color-bg-card);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  transition: all var(--duration-normal) var(--ease-out);
}
```

## Using Tokens in TypeScript

```ts
import { colors, spacing, radius } from '@/tasks/T-003-design-system/src';

// For dynamic styles, charts, etc.
const chartColor = colors.primary[500]; // '#3354FF'
```

---

## Dark Mode

Dark mode works automatically through CSS custom properties. When `data-theme="dark"` is set on `<html>`, all components adapt. No component-level changes needed.

To add dark mode support to custom CSS:

```css
.my-element {
  /* Use semantic tokens — they auto-switch in dark mode */
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}
```
