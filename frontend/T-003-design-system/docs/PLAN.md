# T-003 Design System — Implementation Plan

## Overview

Frontend implementation of the liteNova999 design system, translating the UI team's design spec into a production-ready Vue 3 + TypeScript component library with CSS custom property tokens.

## Architecture

### Layer Stack

```
┌─────────────────────────────────────────┐
│  Vue Components (LnButton, LnModal...) │  ← Consumer-facing API
├─────────────────────────────────────────┤
│  Composables (useTheme, useToast...)    │  ← State & behavior logic
├─────────────────────────────────────────┤
│  Base CSS (reset, global, utilities)    │  ← Foundation styles
├─────────────────────────────────────────┤
│  Themes (light.css, dark.css)           │  ← Theme-specific overrides
├─────────────────────────────────────────┤
│  CSS Tokens (colors, typography, etc.)  │  ← Design variables
├─────────────────────────────────────────┤
│  TS Types & Token Objects               │  ← Type-safe programmatic access
└─────────────────────────────────────────┘
```

### CSS Import Order

```
1. reset.css        → Clean slate
2. tokens/index.css → All CSS custom properties
3. themes/light.css → Light mode defaults
4. themes/dark.css  → Dark mode overrides
5. base/global.css  → Global element styles
6. base/utilities.css → Utility classes
7. (Component scoped styles are self-contained)
```

### Design Decisions

1. **CSS Custom Properties over CSS-in-JS**: Maximum performance, works with any framework, SSR-friendly.
2. **Scoped component styles**: Each Vue component uses `<style scoped>` to prevent style leaks.
3. **Shared composable state**: `useToast` uses module-level reactive state so toasts are shared across components.
4. **No external runtime deps**: Pure Vue 3 + CSS, zero bundle overhead from third-party UI libs.
5. **`data-theme` attribute**: Theme switching uses attribute selectors on `<html>` for CSS cascade control.
6. **`Ln` prefix**: All components and CSS classes use `ln-` prefix to avoid naming collisions.

### Theme System

- **3 modes**: `light`, `dark`, `system`
- **Detection**: `prefers-color-scheme` media query
- **Persistence**: `localStorage` with `ln-theme-mode` key
- **Application**: `data-theme` attribute on `document.documentElement`
- **Transitions**: Smooth CSS transitions unless `prefers-reduced-motion` is set
- **API**: Both imperative (`theme-manager.ts`) and reactive (`useTheme` composable)

### Component Design

Each component follows these principles:
- `<script setup lang="ts">` with typed props and emits
- CSS custom properties for all colors/sizes (dark mode just works)
- ARIA attributes and keyboard navigation
- Slots for content projection
- Minimal props with sensible defaults
- No internal HTTP calls or side effects

## Source Mapping

| Design Spec Section | Implementation |
|---|---|
| §3 Color System | `tokens/colors.css`, `tokens/tokens.ts` |
| §4 Typography | `tokens/typography.css`, `tokens/tokens.ts` |
| §5 Spacing & Grid | `tokens/spacing.css`, `tokens/tokens.ts` |
| §6 Shadows | `tokens/spacing.css`, `tokens/tokens.ts` |
| §7.1 Button | `components/LnButton.vue` |
| §7.2 Input | `components/LnInput.vue` |
| §7.3 Card | `components/LnCard.vue` |
| §7.4 Navbar | `components/LnNavbar.vue` |
| §7.5 Badge | `components/LnBadge.vue` |
| §7.6 Modal | `components/LnModal.vue` |
| §7.7 Toast | `components/LnToast.vue` |
| §7.8 Table | `components/LnTable.vue` |
| §8 Icons | `components/LnIcon.vue` |
| §9 Motion | `tokens/spacing.css` (transitions), `composables/use-reduced-motion.ts` |
| §10 A11y | Built into every component |
| §3.5 Dark Mode | `themes/dark.css`, `themes/theme-manager.ts` |

## Quality Checklist

- [x] All tokens from design spec faithfully translated
- [x] TypeScript strict mode, no `any`
- [x] Full dark mode support via CSS custom properties
- [x] Accessible (WCAG AA): focus visible, ARIA, keyboard nav
- [x] Tree-shakeable barrel exports
- [x] Zero external runtime dependencies
- [x] Tests for theme manager, token values, composables
- [x] prefers-reduced-motion respected
