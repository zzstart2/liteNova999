# LITE999 Component Library

> PRJ-LITE999-T-003 · Component Specifications
> Version 1.0 · Generated from spec: Nova Blue #3354FF · Inter / Source Han Sans

---

## Table of Contents

1. [Button](#1-button)
2. [Input](#2-input)
3. [Card](#3-card)
4. [Badge](#4-badge)
5. [Modal](#5-modal)
6. [Toast](#6-toast)
7. [Avatar](#7-avatar)
8. [Nav](#8-nav)

---

## 1. Button

### CSS

```css
/* ==========================================================================
   Button Component
   ========================================================================== */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  line-height: 1;
  text-decoration: none;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
  user-select: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---- Primary ---- */
.btn-primary {
  background-color: var(--color-primary-500);
  color: #FFFFFF;
  border-color: var(--color-primary-500);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-600);
  border-color: var(--color-primary-600);
}

.btn-primary:active:not(:disabled) {
  background-color: var(--color-primary-700);
}

/* ---- Secondary ---- */
.btn-secondary {
  background-color: var(--color-neutral-0);
  color: var(--color-neutral-700);
  border-color: var(--color-neutral-200);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-neutral-50);
  border-color: var(--color-neutral-300);
}

/* ---- Ghost ---- */
.btn-ghost {
  background-color: transparent;
  color: var(--color-neutral-700);
}

.btn-ghost:hover:not(:disabled) {
  background-color: var(--color-neutral-100);
}

/* ---- Danger ---- */
.btn-danger {
  background-color: var(--color-error-500);
  color: #FFFFFF;
  border-color: var(--color-error-500);
}

.btn-danger:hover:not(:disabled) {
  background-color: var(--color-error-600);
  border-color: var(--color-error-600);
}

/* ---- Sizes ---- */
.btn-sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
}

.btn-lg {
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-base);
}

/* ---- Loading State ---- */
.btn-loading {
  position: relative;
  color: transparent;
}

.btn-loading::after {
  content: "";
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### HTML

```html
<!-- Primary Button -->
<button class="btn btn-primary">Primary</button>

<!-- Secondary Button -->
<button class="btn btn-secondary">Secondary</button>

<!-- Ghost Button -->
<button class="btn btn-ghost">Ghost</button>

<!-- Danger Button -->
<button class="btn btn-danger">Delete</button>

<!-- Small Size -->
<button class="btn btn-primary btn-sm">Small</button>

<!-- Large Size -->
<button class="btn btn-primary btn-lg">Large</button>

<!-- Loading State -->
<button class="btn btn-primary btn-loading" disabled>Loading...</button>

<!-- Icon + Text -->
<button class="btn btn-primary">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
  Add Item
</button>
```

---

## 2. Input

### CSS

```css
/* ==========================================================================
   Input Component
   ========================================================================== */

.form-input {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  color: var(--color-text-primary);
  background-color: var(--color-neutral-0);
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-md);
  transition: border-color var(--duration-fast) var(--ease-default),
              box-shadow var(--duration-fast) var(--ease-default);
}

.form-input::placeholder {
  color: var(--color-neutral-400);
}

.form-input:hover:not(:disabled) {
  border-color: var(--color-neutral-400);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-200);
}

.form-input:disabled {
  background-color: var(--color-neutral-100);
  cursor: not-allowed;
  opacity: 0.7;
}

/* ---- Error State ---- */
.form-input-error {
  border-color: var(--color-error-500);
}

.form-input-error:focus {
  border-color: var(--color-error-500);
  box-shadow: 0 0 0 3px var(--color-error-100);
}

/* ---- Textarea ---- */
.form-textarea {
  min-height: 100px;
  resize: vertical;
}

/* ---- Label ---- */
.form-label {
  display: block;
  margin-bottom: var(--space-1);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-neutral-700);
}

.form-helper {
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-neutral-600);
}

.form-error-text {
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-error-600);
}
```

### HTML

```html
<!-- Basic Input -->
<div>
  <label class="form-label" for="email">Email</label>
  <input type="email" id="email" class="form-input" placeholder="you@example.com">
</div>

<!-- Input with Error -->
<div>
  <label class="form-label" for="username">Username</label>
  <input type="text" id="username" class="form-input form-input-error" value="invalid-user!">
  <p class="form-error-text">Only letters and numbers allowed</p>
</div>

<!-- Disabled Input -->
<input type="text" class="form-input" disabled placeholder="Disabled">

<!-- Textarea -->
<textarea class="form-input form-textarea" placeholder="Enter description..."></textarea>

<!-- Select -->
<select class="form-input">
  <option>Option 1</option>
  <option>Option 2</option>
  <option>Option 3</option>
</select>
```

---

## 3. Card

### CSS

```css
/* ==========================================================================
   Card Component
   ========================================================================== */

.card {
  background-color: var(--color-neutral-0);
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.card-body {
  padding: var(--space-6);
}

.card-header {
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-neutral-200);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}

.card-footer {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-neutral-200);
  background-color: var(--color-neutral-50);
}

/* ---- Interactive / Hoverable ---- */
.card-interactive {
  cursor: pointer;
  transition: transform var(--duration-fast) var(--ease-default),
              box-shadow var(--duration-fast) var(--ease-default);
}

.card-interactive:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* ---- Elevated ---- */
.card-elevated {
  border: none;
  box-shadow: var(--shadow-sm);
}
```

### HTML

```html
<!-- Default Card -->
<div class="card">
  <div class="card-body">
    <h3>Card Title</h3>
    <p>This is the card content.</p>
  </div>
</div>

<!-- Card with Header/Footer -->
<div class="card">
  <div class="card-header">Project Details</div>
  <div class="card-body">
    <p>Card body content here.</p>
  </div>
  <div class="card-footer">
    <button class="btn btn-primary">Action</button>
  </div>
</div>

<!-- Interactive Card -->
<div class="card card-interactive">
  <div class="card-body">
    <h3>Hover Me</h3>
    <p>Click to navigate.</p>
  </div>
</div>

<!-- Elevated Card -->
<div class="card card-elevated">
  <div class="card-body">
    <h3>Elevated</h3>
    <p>With shadow, no border.</p>
  </div>
</div>
```

---

## 4. Badge

### CSS

```css
/* ==========================================================================
   Badge Component
   ========================================================================== */

.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  line-height: 1;
  border-radius: var(--radius-full);
}

/* ---- Variants ---- */
.badge-info {
  background-color: var(--color-info-100);
  color: var(--color-info-700);
}

.badge-success {
  background-color: var(--color-success-100);
  color: var(--color-success-700);
}

.badge-warning {
  background-color: var(--color-warning-100);
  color: var(--color-warning-700);
}

.badge-error {
  background-color: var(--color-error-100);
  color: var(--color-error-700);
}

.badge-neutral {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-700);
}

/* ---- Dot Indicator ---- */
.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
}
```

### HTML

```html
<span class="badge badge-info">Info</span>
<span class="badge badge-success">Active</span>
<span class="badge badge-warning">Pending</span>
<span class="badge badge-error">Failed</span>
<span class="badge badge-neutral">Draft</span>

<!-- With Dot -->
<span class="badge badge-success">
  <span class="badge-dot"></span>
  Online
</span>
```

---

## 5. Modal

### CSS

```css
/* ==========================================================================
   Modal Component
   ========================================================================== */

.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: var(--z-modal);
  animation: fadeIn var(--duration-fast) var(--ease-out);
}

.modal {
  width: 100%;
  max-width: 480px;
  background-color: var(--color-neutral-0);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  animation: slideUp var(--duration-normal) var(--ease-out);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-neutral-200);
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-neutral-900);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-neutral-500);
  cursor: pointer;
  transition: background-color var(--duration-fast);
}

.modal-close:hover {
  background-color: var(--color-neutral-100);
}

.modal-body {
  padding: var(--space-6);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-neutral-200);
  background-color: var(--color-neutral-50);
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
}

/* ---- Animations ---- */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### HTML

```html
<div class="modal-overlay" role="dialog" aria-modal="true">
  <div class="modal">
    <div class="modal-header">
      <h2 class="modal-title">Confirm Action</h2>
      <button class="modal-close" aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <p>Are you sure you want to proceed with this action? This cannot be undone.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary">Cancel</button>
      <button class="btn btn-danger">Confirm</button>
    </div>
  </div>
</div>
```

---

## 6. Toast

### CSS

```css
/* ==========================================================================
   Toast Component
   ========================================================================== */

.toast-container {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  z-index: var(--z-toast);
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  width: 360px;
  max-width: calc(100vw - var(--space-12));
  padding: var(--space-4);
  background-color: var(--color-neutral-900);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  color: var(--color-neutral-0);
  animation: slideInRight var(--duration-normal) var(--ease-out);
}

.toast-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.toast-content {
  flex: 1;
}

.toast-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-1);
}

.toast-message {
  font-size: var(--text-sm);
  color: var(--color-neutral-300);
  line-height: var(--leading-relaxed);
}

.toast-close {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: var(--color-neutral-400);
  cursor: pointer;
  padding: 0;
}

/* ---- Variants ---- */
.toast-success { background-color: var(--color-success-600); }
.toast-warning { background-color: var(--color-warning-600); }
.toast-error   { background-color: var(--color-error-600); }

/* ---- Animation ---- */
@keyframes slideInRight {
  from { opacity: 0; transform: translateX(100%); }
  to { opacity: 1; transform: translateX(0); }
}
```

### HTML

```html
<div class="toast-container">
  <!-- Info Toast -->
  <div class="toast">
    <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
    <div class="toast-content">
      <div class="toast-title">Update Available</div>
      <div class="toast-message">A new version is ready to install.</div>
    </div>
    <button class="toast-close" aria-label="Close">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
  </div>

  <!-- Success Toast -->
  <div class="toast toast-success">
    <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
    <div class="toast-content">
      <div class="toast-title">Saved</div>
      <div class="toast-message">Your changes have been saved.</div>
    </div>
  </div>

  <!-- Error Toast -->
  <div class="toast toast-error">
    <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
    <div class="toast-content">
      <div class="toast-title">Error</div>
      <div class="toast-message">Failed to connect to the server.</div>
    </div>
  </div>
</div>
```

---

## 7. Avatar

### CSS

```css
/* ==========================================================================
   Avatar Component
   ========================================================================== */

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background-color: var(--color-primary-100);
  color: var(--color-primary-600);
  font-family: var(--font-sans);
  font-weight: var(--font-semibold);
  overflow: hidden;
  flex-shrink: 0;
}

/* ---- Sizes ---- */
.avatar-sm {
  width: 32px;
  height: 32px;
  font-size: var(--text-xs);
}

.avatar-md {
  width: 40px;
  height: 40px;
  font-size: var(--text-sm);
}

.avatar-lg {
  width: 56px;
  height: 56px;
  font-size: var(--text-base);
}

.avatar-xl {
  width: 80px;
  height: 80px;
  font-size: var(--text-xl);
}

/* ---- Image ---- */
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

### HTML

```html
<!-- Sizes -->
<span class="avatar avatar-sm">AB</span>
<span class="avatar avatar-md">CD</span>
<span class="avatar avatar-lg">EF</span>
<span class="avatar avatar-xl">GH</span>

<!-- With Image -->
<img class="avatar avatar-md" src="/avatar.jpg" alt="User Avatar">

<!-- In a list -->
<div style="display: flex; gap: 8px; align-items: center;">
  <img class="avatar avatar-sm" src="https://i.pravatar.cc/100?img=1" alt="Alice">
  <img class="avatar avatar-sm" src="https://i.pravatar.cc/100?img=2" alt="Bob">
  <img class="avatar avatar-sm" src="https://i.pravatar.cc/100?img=3" alt="Charlie">
</div>
```

---

## 8. Nav

### CSS

```css
/* ==========================================================================
   Navigation Component
   ========================================================================== */

.nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

/* ---- Horizontal ---- */
.nav-horizontal {
  flex-direction: row;
  align-items: center;
}

/* ---- Item ---- */
.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-neutral-600);
  text-decoration: none;
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--ease-default);
}

.nav-item:hover {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-900);
}

.nav-item.active {
  background-color: var(--color-primary-50);
  color: var(--color-primary-600);
}

/* ---- Icon ---- */
.nav-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* ---- Subnav ---- */
.nav-group {
  padding-left: var(--space-6);
}
```

### HTML

```html
<!-- Vertical Nav -->
<nav class="nav">
  <a href="#" class="nav-item active">
    <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
    Dashboard
  </a>
  <a href="#" class="nav-item">
    <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
    Team
  </a>
  <a href="#" class="nav-item">
    <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    Projects
  </a>
</nav>

<!-- Horizontal Nav -->
<nav class="nav nav-horizontal" style="border-bottom: 1px solid var(--color-neutral-200); padding-bottom: 0;">
  <a href="#" class="nav-item active">Overview</a>
  <a href="#" class="nav-item">Settings</a>
  <a href="#" class="nav-item">Billing</a>
</nav>
```

---

_End of Component Library_