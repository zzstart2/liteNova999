<script setup lang="ts">
/**
 * BrandColorPreview - 品牌色彩预览组件
 *
 * 展示当前品牌的所有语义色及其色阶，用于开发调试和品牌审查
 */

import { computed } from 'vue';
import type { ColorShade, BrandColors } from '../types/brand';
import { getContrastTextColor } from '../brand/color-utils';
import { useBrandInjection } from '../brand/brand-provider';

const injection = useBrandInjection();

const SHADES: ColorShade[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const colorEntries = computed(() => {
  const colors = injection.context.config.color.colors;
  const palettes = injection.context.palettes;

  return (Object.keys(colors) as (keyof BrandColors)[]).map((name) => ({
    name,
    base: colors[name],
    shades: SHADES.map((shade) => ({
      shade,
      hex: palettes[name]?.[shade] || colors[name],
      textColor: getContrastTextColor(palettes[name]?.[shade] || colors[name]),
    })),
  }));
});

const themeColors = computed(() => {
  const tc = injection.context.themeColors;
  return Object.entries(tc).map(([name, value]) => ({
    name,
    value,
  }));
});
</script>

<template>
  <div class="brand-color-preview">
    <h3 class="preview-title">Brand Colors</h3>

    <!-- 语义色 & 色阶 -->
    <div
      v-for="entry in colorEntries"
      :key="entry.name"
      class="color-row"
    >
      <div class="color-label">{{ entry.name }}</div>
      <div class="color-shades">
        <div
          v-for="shade in entry.shades"
          :key="shade.shade"
          class="shade-cell"
          :style="{
            backgroundColor: shade.hex,
            color: shade.textColor,
          }"
          :title="`${entry.name}-${shade.shade}: ${shade.hex}`"
        >
          <span class="shade-number">{{ shade.shade }}</span>
          <span class="shade-hex">{{ shade.hex }}</span>
        </div>
      </div>
    </div>

    <!-- 主题色 -->
    <h3 class="preview-title" style="margin-top: 24px">Theme Colors</h3>
    <div class="theme-colors">
      <div
        v-for="tc in themeColors"
        :key="tc.name"
        class="theme-cell"
        :style="{ backgroundColor: tc.value }"
      >
        <span class="theme-name">{{ tc.name }}</span>
        <span class="theme-value">{{ tc.value }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.brand-color-preview {
  padding: 16px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
}

.preview-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 12px;
  color: var(--brand-text-primary, #111827);
}

.color-row {
  display: flex;
  align-items: stretch;
  margin-bottom: 4px;
}

.color-label {
  width: 80px;
  display: flex;
  align-items: center;
  font-weight: 500;
  text-transform: capitalize;
  color: var(--brand-text-secondary, #6b7280);
  flex-shrink: 0;
}

.color-shades {
  display: flex;
  flex: 1;
  gap: 2px;
}

.shade-cell {
  flex: 1;
  padding: 8px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  min-width: 0;
  cursor: default;
  transition: transform 0.15s;
}

.shade-cell:hover {
  transform: scale(1.05);
  z-index: 1;
}

.shade-number {
  font-size: 11px;
  font-weight: 600;
}

.shade-hex {
  font-size: 9px;
  opacity: 0.8;
  font-family: monospace;
}

.theme-colors {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
}

.theme-cell {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--brand-border, #e5e7eb);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.theme-name {
  font-weight: 500;
  font-size: 12px;
  mix-blend-mode: difference;
  color: white;
}

.theme-value {
  font-family: monospace;
  font-size: 11px;
  mix-blend-mode: difference;
  color: white;
  opacity: 0.8;
}
</style>
