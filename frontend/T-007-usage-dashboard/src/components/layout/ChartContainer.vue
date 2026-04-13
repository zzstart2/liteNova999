<script setup lang="ts">
/**
 * ChartContainer - 图表容器组件
 *
 * 统一的图表外壳：标题、加载状态、空态、错误态
 */

defineProps<{
  /** 图表标题 */
  title: string;
  /** 副标题 */
  subtitle?: string;
  /** 是否加载中 */
  loading?: boolean;
  /** 是否无数据 */
  empty?: boolean;
  /** 错误信息 */
  error?: string | null;
  /** 容器高度 */
  height?: string;
}>();

defineEmits<{
  (e: 'retry'): void;
}>();
</script>

<template>
  <div class="chart-container" :style="{ height: height || '360px' }">
    <!-- 标题栏 -->
    <div class="chart-header">
      <div class="chart-title-group">
        <h3 class="chart-title">{{ title }}</h3>
        <span v-if="subtitle" class="chart-subtitle">{{ subtitle }}</span>
      </div>
      <div class="chart-actions">
        <slot name="actions" />
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="chart-body">
      <!-- 加载态 -->
      <div v-if="loading" class="chart-loading">
        <div class="loading-spinner" />
        <span class="loading-text">Loading...</span>
      </div>

      <!-- 错误态 -->
      <div v-else-if="error" class="chart-error">
        <span class="error-icon">⚠️</span>
        <span class="error-text">{{ error }}</span>
        <button class="retry-btn" @click="$emit('retry')">Retry</button>
      </div>

      <!-- 空态 -->
      <div v-else-if="empty" class="chart-empty">
        <span class="empty-icon">📊</span>
        <span class="empty-text">No data available</span>
      </div>

      <!-- 正常内容 -->
      <slot v-else />
    </div>
  </div>
</template>

<style scoped>
.chart-container {
  background: var(--brand-surface, #f9fafb);
  border: 1px solid var(--brand-border, #e5e7eb);
  border-radius: var(--brand-radius-lg, 12px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 0;
  flex-shrink: 0;
}

.chart-title-group {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.chart-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--brand-text-primary, #111827);
}

.chart-subtitle {
  font-size: 12px;
  color: var(--brand-text-secondary, #6b7280);
}

.chart-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-body {
  flex: 1;
  position: relative;
  min-height: 0;
  padding: 12px 8px 8px;
}

/* States */
.chart-loading,
.chart-error,
.chart-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--brand-border, #e5e7eb);
  border-top-color: var(--brand-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text,
.error-text,
.empty-text {
  font-size: 13px;
  color: var(--brand-text-secondary, #6b7280);
}

.error-icon,
.empty-icon {
  font-size: 24px;
}

.retry-btn {
  margin-top: 4px;
  padding: 4px 16px;
  font-size: 12px;
  color: var(--brand-primary, #3b82f6);
  background: transparent;
  border: 1px solid var(--brand-primary, #3b82f6);
  border-radius: var(--brand-radius, 8px);
  cursor: pointer;
  transition: all 0.15s;
}

.retry-btn:hover {
  background: var(--brand-primary, #3b82f6);
  color: white;
}
</style>
