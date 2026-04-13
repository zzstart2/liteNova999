<script setup lang="ts">
/**
 * HeroSection - 主视觉区
 */
import type { HeroData } from '../types/landing';
import CtaButton from '../components/CtaButton.vue';

defineProps<{
  data: HeroData;
}>();
</script>

<template>
  <section class="hero" id="hero">
    <!-- 背景装饰 -->
    <div class="hero__bg" aria-hidden="true">
      <div class="hero__gradient" />
      <div class="hero__grid" />
    </div>

    <div class="hero__content">
      <!-- 徽章 -->
      <div v-if="data.badge" class="hero__badge">
        {{ data.badge }}
      </div>

      <!-- 标题 -->
      <h1 class="hero__title">{{ data.title }}</h1>

      <!-- 副标题 -->
      <p class="hero__subtitle">{{ data.subtitle }}</p>

      <!-- CTA 按钮 -->
      <div class="hero__actions">
        <CtaButton
          :label="data.primaryCta.label"
          :href="data.primaryCta.href"
          :external="data.primaryCta.external"
          variant="primary"
          size="lg"
        />
        <CtaButton
          v-if="data.secondaryCta"
          :label="data.secondaryCta.label"
          :href="data.secondaryCta.href"
          :external="data.secondaryCta.external"
          variant="secondary"
          size="lg"
        />
      </div>

      <!-- 信任标志（可选 slot） -->
      <div class="hero__trust">
        <slot name="trust" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  min-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 120px 24px 80px;
  overflow: hidden;
}

/* 背景装饰 */
.hero__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.hero__gradient {
  position: absolute;
  top: -40%;
  left: 50%;
  transform: translateX(-50%);
  width: 800px;
  height: 800px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    var(--brand-primary-100, rgba(59, 130, 246, 0.15)) 0%,
    transparent 70%
  );
  filter: blur(60px);
}

.hero__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--brand-border, #e5e7eb) 1px, transparent 1px),
    linear-gradient(90deg, var(--brand-border, #e5e7eb) 1px, transparent 1px);
  background-size: 60px 60px;
  opacity: 0.3;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 100%);
}

/* 内容 */
.hero__content {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 800px;
}

.hero__badge {
  display: inline-block;
  margin-bottom: 24px;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--brand-primary-700, #1d4ed8);
  background: var(--brand-primary-50, #eff6ff);
  border: 1px solid var(--brand-primary-200, #bfdbfe);
  border-radius: var(--brand-radius-full, 9999px);
}

.hero__title {
  margin: 0;
  font-size: 56px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--brand-text-primary, #111827);
  text-wrap: balance;
}

.hero__subtitle {
  margin: 20px auto 0;
  max-width: 600px;
  font-size: 19px;
  line-height: 1.6;
  color: var(--brand-text-secondary, #6b7280);
}

.hero__actions {
  margin-top: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.hero__trust {
  margin-top: 48px;
}

/* Responsive */
@media (max-width: 768px) {
  .hero {
    min-height: auto;
    padding: 100px 20px 60px;
  }

  .hero__title {
    font-size: 36px;
  }

  .hero__subtitle {
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  .hero__title {
    font-size: 30px;
  }

  .hero__actions {
    flex-direction: column;
  }
}
</style>
