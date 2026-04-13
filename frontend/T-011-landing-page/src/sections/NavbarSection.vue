<script setup lang="ts">
/**
 * NavbarSection - 导航栏
 *
 * 粘性置顶，滚动时添加背景模糊效果，移动端汉堡菜单
 */
import { ref, onMounted, onUnmounted } from 'vue';
import type { NavLink, CtaConfig } from '../types/landing';
import CtaButton from '../components/CtaButton.vue';

defineProps<{
  links: NavLink[];
  cta: CtaConfig;
  /** 品牌名（通过品牌系统注入） */
  brandName?: string;
}>();

const scrolled = ref(false);
const mobileMenuOpen = ref(false);

function onScroll() {
  scrolled.value = window.scrollY > 20;
}

function toggleMobile() {
  mobileMenuOpen.value = !mobileMenuOpen.value;
}

function closeMobile() {
  mobileMenuOpen.value = false;
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll);
});
</script>

<template>
  <nav
    class="navbar"
    :class="{ 'navbar--scrolled': scrolled, 'navbar--open': mobileMenuOpen }"
    role="navigation"
    aria-label="Main navigation"
  >
    <div class="navbar__inner">
      <!-- Logo / Brand -->
      <a href="/" class="navbar__brand" @click="closeMobile">
        <span class="navbar__brand-text">{{ brandName || 'Lite999' }}</span>
      </a>

      <!-- Desktop nav -->
      <div class="navbar__links">
        <a
          v-for="link in links"
          :key="link.href"
          :href="link.href"
          :target="link.external ? '_blank' : undefined"
          :rel="link.external ? 'noopener noreferrer' : undefined"
          class="navbar__link"
        >
          {{ link.label }}
        </a>
      </div>

      <!-- CTA -->
      <div class="navbar__cta">
        <CtaButton :label="cta.label" :href="cta.href" variant="primary" size="sm" />
      </div>

      <!-- Mobile hamburger -->
      <button
        class="navbar__hamburger"
        :aria-expanded="mobileMenuOpen"
        aria-label="Toggle menu"
        @click="toggleMobile"
      >
        <span /><span /><span />
      </button>
    </div>

    <!-- Mobile menu -->
    <div v-if="mobileMenuOpen" class="navbar__mobile">
      <a
        v-for="link in links"
        :key="link.href"
        :href="link.href"
        class="navbar__mobile-link"
        @click="closeMobile"
      >
        {{ link.label }}
      </a>
      <CtaButton :label="cta.label" :href="cta.href" variant="primary" size="md" block />
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  transition: all 0.25s ease;
}

.navbar--scrolled {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--brand-border, #e5e7eb);
}

.navbar__inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 32px;
}

.navbar--scrolled .navbar__inner {
  padding: 12px 24px;
}

.navbar__brand {
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.navbar__brand-text {
  font-size: 20px;
  font-weight: 800;
  color: var(--brand-text-primary, #111827);
  letter-spacing: -0.025em;
}

.navbar__links {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.navbar__link {
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--brand-text-secondary, #6b7280);
  text-decoration: none;
  border-radius: var(--brand-radius-sm, 6px);
  transition: color 0.15s, background 0.15s;
}

.navbar__link:hover {
  color: var(--brand-text-primary, #111827);
  background: var(--brand-surface, #f9fafb);
}

.navbar__cta {
  flex-shrink: 0;
}

/* Mobile hamburger */
.navbar__hamburger {
  display: none;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: none;
  border: none;
  cursor: pointer;
}

.navbar__hamburger span {
  display: block;
  width: 20px;
  height: 2px;
  background: var(--brand-text-primary, #111827);
  border-radius: 1px;
  transition: all 0.2s;
}

.navbar--open .navbar__hamburger span:nth-child(1) {
  transform: rotate(45deg) translate(4px, 4px);
}
.navbar--open .navbar__hamburger span:nth-child(2) {
  opacity: 0;
}
.navbar--open .navbar__hamburger span:nth-child(3) {
  transform: rotate(-45deg) translate(4px, -4px);
}

/* Mobile menu */
.navbar__mobile {
  display: none;
  padding: 16px 24px 24px;
  flex-direction: column;
  gap: 8px;
}

.navbar__mobile-link {
  display: block;
  padding: 12px 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--brand-text-primary, #111827);
  text-decoration: none;
  border-bottom: 1px solid var(--brand-divider, #f3f4f6);
}

@media (max-width: 768px) {
  .navbar__links,
  .navbar__cta {
    display: none;
  }

  .navbar__hamburger {
    display: flex;
    margin-left: auto;
  }

  .navbar__mobile {
    display: flex;
  }

  .navbar--open {
    background: var(--brand-bg, #ffffff);
  }
}
</style>
