<script setup lang="ts">
/**
 * LnNavbar — liteNova999 Navbar Component
 *
 * Sticky navbar with backdrop blur, logo slot, nav links, and mobile hamburger menu.
 */

import { ref } from 'vue';

export interface NavLink {
  label: string;
  href: string;
  active?: boolean;
}

export interface LnNavbarProps {
  /** Navigation links */
  links?: NavLink[];
}

const props = withDefaults(defineProps<LnNavbarProps>(), {
  links: () => [],
});

defineEmits<{
  'link-click': [link: NavLink, event: MouseEvent];
}>();

const isMobileMenuOpen = ref(false);

function toggleMobileMenu(): void {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
}

function closeMobileMenu(): void {
  isMobileMenuOpen.value = false;
}
</script>

<template>
  <nav class="ln-navbar" role="navigation" aria-label="Main navigation">
    <div class="ln-navbar__inner">
      <!-- Logo -->
      <div class="ln-navbar__logo">
        <slot name="logo" />
      </div>

      <!-- Desktop nav -->
      <div class="ln-navbar__nav" role="menubar">
        <a
          v-for="link in links"
          :key="link.href"
          :href="link.href"
          :class="['ln-navbar__link', { 'ln-navbar__link--active': link.active }]"
          role="menuitem"
          @click="$emit('link-click', link, $event)"
        >
          {{ link.label }}
        </a>
        <slot name="actions" />
      </div>

      <!-- Mobile hamburger -->
      <button
        class="ln-navbar__hamburger"
        :aria-expanded="isMobileMenuOpen"
        aria-label="Toggle navigation menu"
        @click="toggleMobileMenu"
      >
        <span :class="['ln-navbar__hamburger-icon', { 'ln-navbar__hamburger-icon--open': isMobileMenuOpen }]">
          <span />
          <span />
          <span />
        </span>
      </button>
    </div>

    <!-- Mobile menu -->
    <Transition name="ln-mobile-menu">
      <div
        v-if="isMobileMenuOpen"
        class="ln-navbar__mobile"
        role="menu"
      >
        <a
          v-for="link in links"
          :key="link.href"
          :href="link.href"
          :class="['ln-navbar__mobile-link', { 'ln-navbar__mobile-link--active': link.active }]"
          role="menuitem"
          @click="closeMobileMenu(); $emit('link-click', link, $event)"
        >
          {{ link.label }}
        </a>
        <slot name="mobile-actions" />
      </div>
    </Transition>
  </nav>
</template>

<style scoped>
.ln-navbar {
  height: 64px;
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-neutral-100);
}

/* Dark mode */
:global([data-theme="dark"]) .ln-navbar {
  background: rgba(17, 24, 39, 0.8);
  border-bottom-color: var(--color-neutral-700);
}

.ln-navbar__inner {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 var(--space-8);
  max-width: var(--max-content-width);
  margin: 0 auto;
}

.ln-navbar__logo {
  flex-shrink: 0;
}

.ln-navbar__nav {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  margin-left: auto;
}

.ln-navbar__link {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color var(--duration-normal) var(--ease-out);
  padding: var(--space-2) 0;
}

.ln-navbar__link:hover,
.ln-navbar__link--active {
  color: var(--color-primary-500);
}

.ln-navbar__link:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
  border-radius: 2px;
}

/* Hamburger button */
.ln-navbar__hamburger {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-left: auto;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
}

.ln-navbar__hamburger:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

.ln-navbar__hamburger-icon {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 20px;
}

.ln-navbar__hamburger-icon span {
  display: block;
  height: 2px;
  background: var(--color-text-primary);
  border-radius: 1px;
  transition: all var(--duration-normal) var(--ease-out);
  transform-origin: center;
}

.ln-navbar__hamburger-icon--open span:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}

.ln-navbar__hamburger-icon--open span:nth-child(2) {
  opacity: 0;
}

.ln-navbar__hamburger-icon--open span:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

/* Mobile menu */
.ln-navbar__mobile {
  display: none;
  flex-direction: column;
  padding: var(--space-4) var(--space-8);
  background: var(--color-bg-card);
  border-bottom: 1px solid var(--color-border);
}

.ln-navbar__mobile-link {
  display: block;
  padding: var(--space-3) 0;
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
  text-decoration: none;
  border-bottom: 1px solid var(--color-border);
  transition: color var(--duration-normal) var(--ease-out);
}

.ln-navbar__mobile-link:last-child {
  border-bottom: none;
}

.ln-navbar__mobile-link:hover,
.ln-navbar__mobile-link--active {
  color: var(--color-primary-500);
}

/* Mobile transition */
.ln-mobile-menu-enter-active,
.ln-mobile-menu-leave-active {
  transition:
    opacity var(--duration-normal) var(--ease-out),
    transform var(--duration-normal) var(--ease-out);
}

.ln-mobile-menu-enter-from,
.ln-mobile-menu-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Responsive */
@media (max-width: 767px) {
  .ln-navbar__inner {
    padding: 0 var(--space-4);
  }

  .ln-navbar__nav {
    display: none;
  }

  .ln-navbar__hamburger {
    display: flex;
  }

  .ln-navbar__mobile {
    display: flex;
  }
}
</style>
