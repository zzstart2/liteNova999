# T-003: liteNova999 Design System

> Vue 3 + TypeScript design system implementation based on the [design spec](../../workspace-ui-prjlite999/projects/liteNova999/design-system/DESIGN-SYSTEM.md).

## What's Included

- **Design Tokens** — CSS custom properties + typed TypeScript objects for colors, typography, spacing, radius, shadows, transitions, and z-index
- **Theme System** — Light/dark mode with system preference detection, manual toggle, localStorage persistence, and smooth transitions
- **9 Vue Components** — Button, Input, Card, Badge, Modal, Toast, Navbar, Table, Icon
- **4 Composables** — `useTheme`, `useToast`, `useModal`, `useReducedMotion`
- **CSS Base** — Modern reset, global styles, utility classes
- **Logo Assets** — 4 SVG variants (full-color, icon-only, mono-dark, mono-white)
- **Tests** — Theme manager, token validation, composable behavior

## Quick Start

```ts
// 1. Import CSS (in order)
import './tasks/T-003-design-system/src/base/reset.css';
import './tasks/T-003-design-system/src/tokens/index.css';
import './tasks/T-003-design-system/src/themes/light.css';
import './tasks/T-003-design-system/src/themes/dark.css';
import './tasks/T-003-design-system/src/base/global.css';
import './tasks/T-003-design-system/src/base/utilities.css';

// 2. Init theme
import { initTheme } from './tasks/T-003-design-system/src';
initTheme();

// 3. Use components
import { LnButton, LnCard, useTheme } from './tasks/T-003-design-system/src';
```

## File Structure

```
T-003-design-system/
├── docs/           → PLAN.md, USAGE.md
├── config/         → Default configuration
├── src/
│   ├── types/      → TypeScript token types
│   ├── tokens/     → CSS custom properties + TS token objects
│   ├── themes/     → Light/dark CSS + theme manager
│   ├── base/       → Reset, global styles, utilities
│   ├── components/ → 9 Vue components (Ln-prefixed)
│   ├── composables/→ 4 composables
│   ├── assets/     → Logo SVGs
│   └── index.ts    → Barrel exports
├── tests/          → Vitest test suites
└── README.md       → This file
```

## Key Design Decisions

- **Zero external runtime deps** — Pure Vue 3 + CSS
- **CSS custom properties** — Theme-aware, SSR-friendly, no CSS-in-JS
- **Tree-shakeable** — Import only what you need
- **WCAG AA accessible** — Focus management, ARIA, keyboard nav
- **`prefers-reduced-motion`** respected globally

## Documentation

- [Implementation Plan](./docs/PLAN.md)
- [Usage Guide](./docs/USAGE.md)
- [Design Spec](../../workspace-ui-prjlite999/projects/liteNova999/design-system/DESIGN-SYSTEM.md)
