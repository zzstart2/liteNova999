<script setup lang="ts">
/**
 * SectionHeading - 区块标题组件
 *
 * 统一所有 section 的标题 + 副标题样式
 */
defineProps<{
  heading: string;
  subheading?: string;
  /** 对齐方式 */
  align?: 'center' | 'left';
  /** 浅色文字（用于深色背景区块） */
  light?: boolean;
}>();
</script>

<template>
  <div
    class="section-heading"
    :class="{
      'section-heading--center': align !== 'left',
      'section-heading--light': light,
    }"
  >
    <h2 class="section-heading__title">{{ heading }}</h2>
    <p v-if="subheading" class="section-heading__sub">{{ subheading }}</p>
  </div>
</template>

<style scoped>
.section-heading {
  margin-bottom: 48px;
}

.section-heading--center {
  text-align: center;
}

.section-heading__title {
  margin: 0;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.2;
  color: var(--brand-text-primary, #111827);
}

.section-heading__sub {
  margin: 12px 0 0;
  font-size: 17px;
  line-height: 1.6;
  color: var(--brand-text-secondary, #6b7280);
  max-width: 640px;
}

.section-heading--center .section-heading__sub {
  margin-left: auto;
  margin-right: auto;
}

.section-heading--light .section-heading__title {
  color: #ffffff;
}

.section-heading--light .section-heading__sub {
  color: rgba(255, 255, 255, 0.75);
}

@media (max-width: 640px) {
  .section-heading__title {
    font-size: 26px;
  }
  .section-heading__sub {
    font-size: 15px;
  }
  .section-heading {
    margin-bottom: 32px;
  }
}
</style>
