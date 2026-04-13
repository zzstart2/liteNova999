<script setup lang="ts">
/**
 * DateRangePicker - 日期范围选择器
 *
 * 预设快捷范围 + 自定义日期输入
 */

import { ref, computed } from 'vue';
import type { PresetRange, DateRange } from '../../types/usage';

const props = withDefaults(
  defineProps<{
    modelValue: PresetRange;
    customRange?: DateRange | null;
  }>(),
  {
    modelValue: '30d',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: PresetRange): void;
  (e: 'custom-range', range: DateRange): void;
}>();

const presets: { value: PresetRange; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '1y', label: '1Y' },
];

const showCustom = ref(false);
const customStart = ref('');
const customEnd = ref('');

function selectPreset(preset: PresetRange) {
  showCustom.value = false;
  emit('update:modelValue', preset);
}

function openCustom() {
  showCustom.value = true;
  // 预填当前范围
  if (props.customRange) {
    customStart.value = props.customRange.start.split('T')[0];
    customEnd.value = props.customRange.end.split('T')[0];
  } else {
    const now = new Date();
    customEnd.value = now.toISOString().split('T')[0];
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    customStart.value = start.toISOString().split('T')[0];
  }
}

function applyCustom() {
  if (customStart.value && customEnd.value) {
    emit('custom-range', {
      start: new Date(customStart.value).toISOString(),
      end: new Date(customEnd.value + 'T23:59:59').toISOString(),
    });
    showCustom.value = false;
  }
}
</script>

<template>
  <div class="date-range-picker">
    <div class="preset-group">
      <button
        v-for="preset in presets"
        :key="preset.value"
        :class="['preset-btn', { active: modelValue === preset.value && !showCustom }]"
        @click="selectPreset(preset.value)"
      >
        {{ preset.label }}
      </button>
      <button
        :class="['preset-btn', { active: modelValue === 'custom' || showCustom }]"
        @click="openCustom"
      >
        Custom
      </button>
    </div>

    <!-- 自定义范围面板 -->
    <div v-if="showCustom" class="custom-panel">
      <input
        v-model="customStart"
        type="date"
        class="date-input"
      />
      <span class="date-sep">→</span>
      <input
        v-model="customEnd"
        type="date"
        class="date-input"
      />
      <button class="apply-btn" @click="applyCustom">Apply</button>
    </div>
  </div>
</template>

<style scoped>
.date-range-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-group {
  display: flex;
  gap: 4px;
  background: var(--brand-surface, #f9fafb);
  border: 1px solid var(--brand-border, #e5e7eb);
  border-radius: var(--brand-radius, 8px);
  padding: 3px;
}

.preset-btn {
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--brand-text-secondary, #6b7280);
  background: transparent;
  border: none;
  border-radius: calc(var(--brand-radius, 8px) - 2px);
  cursor: pointer;
  transition: all 0.15s;
}

.preset-btn:hover {
  color: var(--brand-text-primary, #111827);
  background: var(--brand-bg, #ffffff);
}

.preset-btn.active {
  color: var(--brand-primary, #3b82f6);
  background: var(--brand-bg, #ffffff);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  font-weight: 600;
}

.custom-panel {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-input {
  padding: 5px 8px;
  font-size: 12px;
  border: 1px solid var(--brand-border, #e5e7eb);
  border-radius: var(--brand-radius-sm, 6px);
  background: var(--brand-bg, #ffffff);
  color: var(--brand-text-primary, #111827);
}

.date-sep {
  color: var(--brand-text-secondary, #6b7280);
  font-size: 12px;
}

.apply-btn {
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 500;
  color: white;
  background: var(--brand-primary, #3b82f6);
  border: none;
  border-radius: var(--brand-radius-sm, 6px);
  cursor: pointer;
  transition: opacity 0.15s;
}

.apply-btn:hover {
  opacity: 0.9;
}
</style>
