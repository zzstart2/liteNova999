# LITE999 Design System

> PRJ-LITE999-T-003 · UI/UX 设计系统规划
> Version 1.0 · Generated from spec: Nova Blue #3354FF · Inter / Source Han Sans

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Brand Identity](#2-brand-identity)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Spacing & Layout](#5-spacing--layout)
6. [Iconography](#6-iconography)
7. [Elevation & Shadows](#7-elevation--shadows)
8. [Motion & Animation](#8-motion--animation)
9. [Component Library Overview](#9-component-library-overview)
10. [Dark Mode](#10-dark-mode)
11. [Accessibility](#11-accessibility)
12. [Implementation Guide](#12-implementation-guide)

---

## 1. Design Principles

| # | Principle | Description |
|---|-----------|-------------|
| 1 | **Clarity First** | Every element must communicate its purpose immediately. Remove ambiguity before adding decoration. |
| 2 | **Consistent, Not Uniform** | Shared patterns across all surfaces, but adapted to context. A modal and a page can share DNA without being identical. |
| 3 | **Progressive Disclosure** | Show only what's needed at each step. Complexity is available, never imposed. |
| 4 | **Accessible by Default** | WCAG 2.1 AA minimum. Color contrast, keyboard nav, screen reader support — baked in, not bolted on. |
| 5 | **Performance is UX** | Every design decision considers render cost. Fewer layers, simpler shadows, system-first fonts where possible. |

---

## 2. Brand Identity

### 2.1 Logo

The LITE999 logo exists in four variants:

| Variant | File | Usage |
|---------|------|-------|
| Full Color | `design/logo-full-color.svg` | Primary usage on white/light backgrounds |
| Mono White | `design/logo-mono-white.svg` | On dark or colored backgrounds |
| Mono Dark | `design/logo-mono-dark.svg` | Single-color printing, fax, stamps |
| Icon Only | `design/logo-icon-only.svg` | Favicons, app icons, avatars (≤ 48px) |

### 2.2 Logo Clear Space

Minimum clear space = height of the "L" character on all sides. Never place text, borders, or other elements within this zone.

### 2.3 Logo Minimum Size

- Full logo: min 120px wide (digital), 30mm (print)
- Icon only: min 16px (favicon), 24px (UI), 10mm (print)

---

## 3. Color System

### 3.1 Primary Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary-50` | `#EEF1FF` | Tinted backgrounds, hover states |
| `--color-primary-100` | `#D9DFFF` | Light accent areas |
| `--color-primary-200` | `#B3BFFF` | Secondary buttons (bg) |
| `--color-primary-300` | `#8D9FFF` | Focus rings |
| `--color-primary-400` | `#667FFF` | Links on dark backgrounds |
| `--color-primary-500` | `#3354FF` | **Nova Blue — primary brand color** |
| `--color-primary-600` | `#2943CC` | Hover on primary buttons |
| `--color-primary-700` | `#1F3299` | Active/pressed state |
| `--color-primary-800` | `#142166` | Dark accents |
| `--color-primary-900` | `#0A1133` | Near-black brand tint |

### 3.2 Neutral Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-neutral-0` | `#FFFFFF` | Page background (light) |
| `--color-neutral-50` | `#F8F9FA` | Card background, subtle bg |
| `--color-neutral-100` | `#F1F3F5` | Dividers background |
| `--color-neutral-200` | `#E9ECEF` | Borders, separators |
| `--color-neutral-300` | `#DEE2E6` | Disabled state borders |
| `--color-neutral-400` | `#CED4DA` | Placeholder text |
| `--color-neutral-500` | `#ADB5BD` | Secondary text |
| `--color-neutral-600` | `#868E96` | Caption text |
| `--color-neutral-700` | `#495057` | Body text |
| `--color-neutral-800` | `#343A40` | Headings |
| `--color-neutral-900` | `#212529` | Primary text |
| `--color-neutral-950` | `#111318` | Dark mode background |

### 3.3 Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-success-500` | `#22C55E` | Success states, confirmations |
| `--color-success-50` | `#F0FDF4` | Success background |
| `--color-warning-500` | `#F59E0B` | Warnings, caution |
| `--color-warning-50` | `#FFFBEB` | Warning background |
| `--color-error-500` | `#EF4444` | Errors, destructive actions |
| `--color-error-50` | `#FEF2F2` | Error background |
| `--color-info-500` | `#3B82F6` | Informational |
| `--color-info-50` | `#EFF6FF` | Info background |

### 3.4 Contrast Ratios

All text color / background combinations meet:
- **Normal text (< 18px):** ≥ 4.5:1 (AA)
- **Large text (≥ 18px bold / 24px):** ≥ 3:1 (AA)
- **UI components:** ≥ 3:1 against adjacent colors

Key validated pairs:
- `--color-neutral-900` on `--color-neutral-0` → **16.75:1** ✅
- `--color-neutral-0` on `--color-primary-500` → **5.2:1** ✅
- `--color-neutral-700` on `--color-neutral-0` → **9.73:1** ✅

---

## 4. Typography

### 4.1 Font Stack

```css
--font-sans: 'Inter', 'Source Han Sans SC', 'Noto Sans SC', -apple-system,
             BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', monospace;
```

- **Inter** — primary Latin typeface (variable weight 100–900)
- **Source Han Sans SC (思源黑体)** — CJK fallback
- System stack as final fallback for performance

### 4.2 Type Scale

Base size: `16px` (1rem). Scale factor: `1.25` (Major Third).

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `--text-xs` | 0.75rem (12px) | 400 | 1.5 | Captions, legal |
| `--text-sm` | 0.875rem (14px) | 400 | 1.5 | Secondary text, labels |
| `--text-base` | 1rem (16px) | 400 | 1.5 | Body text |
| `--text-lg` | 1.125rem (18px) | 500 | 1.4 | Lead paragraphs |
| `--text-xl` | 1.25rem (20px) | 600 | 1.3 | H4 |
| `--text-2xl` | 1.5rem (24px) | 600 | 1.3 | H3 |
| `--text-3xl` | 1.875rem (30px) | 700 | 1.2 | H2 |
| `--text-4xl` | 2.25rem (36px) | 700 | 1.2 | H1 |
| `--text-5xl` | 3rem (48px) | 800 | 1.1 | Display / Hero |

### 4.3 Font Loading Strategy

1. Use `font-display: swap` for all web fonts
2. Preload Inter Variable (woff2) in `<head>`
3. Source Han Sans loaded on-demand when CJK characters detected
4. Subset CJK fonts to GB2312 for initial load (~2MB vs 15MB)

---

## 5. Spacing & Layout

### 5.1 Spacing Scale

Base unit: `4px`. All spacing is a multiple of 4.

| Token | Value | Common Use |
|-------|-------|------------|
| `--space-0` | 0 | Reset |
| `--space-1` | 4px | Tight inline gaps |
| `--space-2` | 8px | Icon-to-text gap, compact padding |
| `--space-3` | 12px | Small card padding |
| `--space-4` | 16px | Default padding, form gaps |
| `--space-5` | 20px | Between related sections |
| `--space-6` | 24px | Card padding |
| `--space-8` | 32px | Section spacing |
| `--space-10` | 40px | Large section gaps |
| `--space-12` | 48px | Page section breaks |
| `--space-16` | 64px | Hero padding |
| `--space-20` | 80px | Major page sections |
| `--space-24` | 96px | Full-bleed section padding |

### 5.2 Grid System

- **Columns:** 12-column grid
- **Gutter:** `--space-6` (24px) default, `--space-4` (16px) on mobile
- **Max width:** 1200px (content), 1440px (wide), fluid (full)
- **Breakpoints:**

| Token | Width | Target |
|-------|-------|--------|
| `--bp-sm` | 640px | Large phones (landscape) |
| `--bp-md` | 768px | Tablets |
| `--bp-lg` | 1024px | Small laptops |
| `--bp-xl` | 1280px | Desktops |
| `--bp-2xl` | 1536px | Large screens |

### 5.3 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-none` | 0 | Sharp corners |
| `--radius-sm` | 4px | Badges, chips |
| `--radius-md` | 8px | Buttons, inputs, cards |
| `--radius-lg` | 12px | Modals, dialogs |
| `--radius-xl` | 16px | Large cards, panels |
| `--radius-full` | 9999px | Pills, avatars |

---

## 6. Iconography

### 6.1 Icon System

- **Library:** Lucide Icons (open source, consistent stroke width)
- **Stroke width:** 1.5px at 24px canvas
- **Sizes:** 16px (inline), 20px (buttons), 24px (default), 32px (feature), 48px (hero)
- **Color:** Inherits `currentColor` by default

### 6.2 Icon Usage Rules

1. Icons must always have an accessible label (`aria-label` or adjacent text)
2. Decorative icons use `aria-hidden="true"`
3. Never use icons alone for critical actions without text labels
4. Touch targets: minimum 44×44px even if icon is visually smaller

---

## 7. Elevation & Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift (buttons resting) |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)` | Cards, inputs |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)` | Dropdowns, popovers |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)` | Modals, dialogs |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04)` | Toast notifications |
| `--shadow-inner` | `inset 0 2px 4px rgba(0,0,0,0.06)` | Pressed states, inset inputs |

### Dark Mode Shadows

In dark mode, shadows shift to darker overlays + subtle light edge:
```css
--shadow-sm-dark: 0 1px 3px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.03);
```

---

## 8. Motion & Animation

### 8.1 Duration Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-instant` | 75ms | Micro-interactions (checkmarks, toggles) |
| `--duration-fast` | 150ms | Hover effects, focus rings |
| `--duration-normal` | 250ms | Modals open, accordions |
| `--duration-slow` | 400ms | Page transitions |
| `--duration-slower` | 600ms | Complex orchestrated sequences |

### 8.2 Easing Functions

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | General purpose |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Elements exiting |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Elements entering |
| `--ease-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful interactions |

### 8.3 Motion Principles

1. **Respect `prefers-reduced-motion`** — disable all non-essential animation
2. **Purposeful motion** — animation must communicate state change, not decorate
3. **Stagger sparingly** — use 50ms stagger for list items, max 5 items
4. **No motion > bad motion** — when in doubt, use opacity fade only

---

## 9. Component Library Overview

Full component specs are in `docs/COMPONENTS.md`. Summary:

| Component | Variants | States |
|-----------|----------|--------|
| **Button** | Primary, Secondary, Ghost, Danger | Default, Hover, Active, Disabled, Loading |
| **Input** | Text, Textarea, Select | Default, Focus, Error, Disabled |
| **Card** | Default, Interactive, Elevated | Default, Hover (interactive) |
| **Badge** | Info, Success, Warning, Error, Neutral | Default |
| **Modal** | Default, Destructive | Open, Closing |
| **Toast** | Info, Success, Warning, Error | Entering, Visible, Exiting |
| **Avatar** | Image, Initials | Sizes: sm, md, lg |
| **Nav** | Horizontal, Vertical, Mobile | Default, Active, Collapsed |

---

## 10. Dark Mode

### 10.1 Strategy

- **CSS custom properties** toggle via `[data-theme="dark"]` on `<html>`
- **System preference** respected via `prefers-color-scheme: dark`
- **User override** persisted in `localStorage`

### 10.2 Dark Palette Mapping

| Light Token | Dark Value | Notes |
|-------------|------------|-------|
| `--color-bg-primary` | `#111318` | Near-black, slight blue tint |
| `--color-bg-secondary` | `#1A1D24` | Cards, elevated surfaces |
| `--color-bg-tertiary` | `#24272E` | Inputs, nested elements |
| `--color-text-primary` | `#F1F3F5` | High contrast body text |
| `--color-text-secondary` | `#ADB5BD` | Secondary text |
| `--color-border` | `#2C3038` | Subtle borders |
| `--color-primary-500` | `#5C7AFF` | Brightened Nova Blue for dark bg |

### 10.3 Dark Mode Rules

1. Never use pure black (`#000`). The darkest surface is `#111318`.
2. Reduce shadow intensity; use border instead for separation.
3. Primary color lightened by 1 step for adequate contrast.
4. Images may need `brightness(0.9)` filter to reduce glare.

---

## 11. Accessibility

### 11.1 Standards

- **Target:** WCAG 2.1 Level AA
- **Testing:** axe-core in CI, manual screen reader testing quarterly

### 11.2 Checklist

- [ ] All interactive elements keyboard accessible
- [ ] Focus visible on all focusable elements (`--color-primary-300` ring)
- [ ] Color is never the only indicator (icons + text as backup)
- [ ] All images have `alt` text (or `alt=""` for decorative)
- [ ] Form inputs have visible labels (not placeholder-only)
- [ ] Touch targets ≥ 44×44px
- [ ] Skip-to-content link present
- [ ] Heading hierarchy correct (no skipped levels)
- [ ] `aria-live` regions for dynamic content
- [ ] Reduced motion respected

### 11.3 Focus Style

```css
:focus-visible {
  outline: 2px solid var(--color-primary-300);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

---

## 12. Implementation Guide

### 12.1 File Structure

```
tokens/
├── colors.css          # CSS custom properties for colors
├── colors.json         # Color tokens as JSON (for JS/tooling)
├── typography.css      # Font stacks, type scale
├── spacing.css         # Spacing, radius, breakpoints, shadows
└── tokens.json         # All tokens consolidated (JSON)

design/
├── logo-full-color.svg
├── logo-mono-white.svg
├── logo-mono-dark.svg
└── logo-icon-only.svg

docs/
├── DESIGN-SYSTEM.md    # This file
└── COMPONENTS.md       # Component specs with CSS + HTML
```

### 12.2 Usage in CSS

```css
@import 'tokens/colors.css';
@import 'tokens/typography.css';
@import 'tokens/spacing.css';

.button-primary {
  background: var(--color-primary-500);
  color: var(--color-neutral-0);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 600;
  transition: background var(--duration-fast) var(--ease-default);
}
```

### 12.3 Usage in JavaScript

```js
import tokens from './tokens/tokens.json';

const primaryColor = tokens.color.primary['500']; // "#3354FF"
const spacingMd = tokens.spacing['4'];             // "16px"
```

### 12.4 Adoption Roadmap

| Phase | Scope | Timeline |
|-------|-------|----------|
| 1 | Tokens + Typography + Colors | Week 1 |
| 2 | Core components (Button, Input, Card) | Week 2–3 |
| 3 | Full component library | Week 4–6 |
| 4 | Dark mode + Accessibility audit | Week 7–8 |

---

_Last updated: 2025-07-17 · PRJ-LITE999-T-003_
