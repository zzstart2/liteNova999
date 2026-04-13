<script setup lang="ts">
/**
 * FooterSection - 页脚
 *
 * Logo + 链接列组 + 社交图标 + 版权
 */
import type { FooterLinkGroup, SocialLink } from '../types/landing';

defineProps<{
  groups: FooterLinkGroup[];
  socials: SocialLink[];
  brandName?: string;
  copyright?: string;
}>();
</script>

<template>
  <footer class="footer">
    <div class="footer__inner">
      <!-- 上部：品牌 + 链接列 -->
      <div class="footer__top">
        <!-- 品牌列 -->
        <div class="footer__brand-col">
          <a href="/" class="footer__brand">{{ brandName || 'Lite999' }}</a>
          <p class="footer__brand-desc">
            Unified API gateway for every LLM provider.
          </p>
          <div class="footer__socials">
            <a
              v-for="social in socials"
              :key="social.platform"
              :href="social.href"
              target="_blank"
              rel="noopener noreferrer"
              class="footer__social-link"
              :aria-label="social.platform"
              :title="social.platform"
            >
              {{ social.icon }}
            </a>
          </div>
        </div>

        <!-- 链接列 -->
        <div
          v-for="group in groups"
          :key="group.title"
          class="footer__link-col"
        >
          <h4 class="footer__col-title">{{ group.title }}</h4>
          <ul class="footer__link-list">
            <li v-for="link in group.links" :key="link.href">
              <a
                :href="link.href"
                :target="link.external ? '_blank' : undefined"
                :rel="link.external ? 'noopener noreferrer' : undefined"
                class="footer__link"
              >
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <!-- 下部：版权 -->
      <div class="footer__bottom">
        <p class="footer__copyright">
          {{ copyright || `© ${new Date().getFullYear()} ${brandName || 'Lite999'}. All rights reserved.` }}
        </p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  padding: 64px 24px 32px;
  background: var(--brand-bg, #ffffff);
  border-top: 1px solid var(--brand-border, #e5e7eb);
}

.footer__inner {
  max-width: 1200px;
  margin: 0 auto;
}

.footer__top {
  display: grid;
  grid-template-columns: 2fr repeat(auto-fit, minmax(140px, 1fr));
  gap: 48px 32px;
  margin-bottom: 48px;
}

.footer__brand-col {
  max-width: 280px;
}

.footer__brand {
  font-size: 20px;
  font-weight: 800;
  color: var(--brand-text-primary, #111827);
  text-decoration: none;
  letter-spacing: -0.025em;
}

.footer__brand-desc {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--brand-text-secondary, #6b7280);
}

.footer__socials {
  margin-top: 20px;
  display: flex;
  gap: 12px;
}

.footer__social-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  font-size: 18px;
  background: var(--brand-surface, #f9fafb);
  border: 1px solid var(--brand-border, #e5e7eb);
  border-radius: 50%;
  text-decoration: none;
  transition: all 0.15s;
}

.footer__social-link:hover {
  background: var(--brand-primary-50, #eff6ff);
  border-color: var(--brand-primary-200, #bfdbfe);
  transform: translateY(-1px);
}

.footer__col-title {
  margin: 0 0 16px;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--brand-text-primary, #111827);
}

.footer__link-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.footer__link {
  font-size: 14px;
  color: var(--brand-text-secondary, #6b7280);
  text-decoration: none;
  transition: color 0.15s;
}

.footer__link:hover {
  color: var(--brand-primary, #3b82f6);
}

.footer__bottom {
  padding-top: 24px;
  border-top: 1px solid var(--brand-divider, #f3f4f6);
}

.footer__copyright {
  margin: 0;
  font-size: 13px;
  color: var(--brand-text-disabled, #d1d5db);
  text-align: center;
}

@media (max-width: 768px) {
  .footer__top {
    grid-template-columns: 1fr 1fr;
  }

  .footer__brand-col {
    grid-column: 1 / -1;
    max-width: none;
  }
}

@media (max-width: 480px) {
  .footer__top {
    grid-template-columns: 1fr;
  }
}
</style>
