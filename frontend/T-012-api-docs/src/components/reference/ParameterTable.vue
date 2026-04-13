<script setup lang="ts">
import type { ApiParam } from '../../types/api-docs';

defineProps<{
  parameters: ApiParam[];
  title?: string;
}>();
</script>

<template>
  <div v-if="parameters.length > 0" class="param-section">
    <h3 class="param-section__title">{{ title || 'Parameters' }}</h3>
    <div class="param-table">
      <div
        v-for="param in parameters"
        :key="param.name"
        class="param-row"
        :class="{ 'param-row--deprecated': param.deprecated }"
      >
        <div class="param-row__head">
          <code class="param-name">{{ param.name }}</code>
          <span class="param-type">{{ param.type }}</span>
          <span class="param-location">{{ param.location }}</span>
          <span v-if="param.required" class="param-required">required</span>
          <span v-if="param.deprecated" class="param-deprecated">deprecated</span>
        </div>
        <div class="param-row__body">
          <p class="param-desc">{{ param.description }}</p>
          <div class="param-meta">
            <span v-if="param.defaultValue !== undefined" class="meta-item">
              Default: <code>{{ JSON.stringify(param.defaultValue) }}</code>
            </span>
            <span v-if="param.enum" class="meta-item">
              Enum: <code v-for="(e, i) in param.enum" :key="e">{{ e }}<template v-if="i < param.enum.length - 1">, </template></code>
            </span>
            <span v-if="param.minimum !== undefined" class="meta-item">Min: {{ param.minimum }}</span>
            <span v-if="param.maximum !== undefined" class="meta-item">Max: {{ param.maximum }}</span>
          </div>
        </div>

        <!-- 子字段 -->
        <div v-if="param.children && param.children.length > 0" class="param-children">
          <div
            v-for="child in param.children"
            :key="child.name"
            class="param-row param-row--child"
          >
            <div class="param-row__head">
              <code class="param-name">{{ child.name }}</code>
              <span class="param-type">{{ child.type }}</span>
              <span v-if="child.required" class="param-required">required</span>
            </div>
            <div class="param-row__body">
              <p class="param-desc">{{ child.description }}</p>
              <div v-if="child.enum" class="param-meta">
                <span class="meta-item">
                  Enum: <code v-for="(e, i) in child.enum" :key="e">{{ e }}<template v-if="i < child.enum.length - 1">, </template></code>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.param-section { margin-bottom: 32px; }
.param-section__title {
  margin: 0 0 16px; font-size: 18px; font-weight: 700;
  color: var(--brand-text-primary, #111827);
}
.param-table {
  border: 1px solid var(--brand-border, #e5e7eb);
  border-radius: var(--brand-radius, 8px);
  overflow: hidden;
}
.param-row {
  padding: 14px 16px;
  border-bottom: 1px solid var(--brand-divider, #f3f4f6);
}
.param-row:last-child { border-bottom: none; }
.param-row--deprecated { opacity: 0.5; }
.param-row--child { padding-left: 32px; background: var(--brand-surface, #f9fafb); }
.param-row__head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.param-name {
  font-family: 'SF Mono', monospace; font-size: 13px; font-weight: 600;
  color: var(--brand-primary, #3b82f6);
}
.param-type {
  font-size: 11px; font-weight: 600; color: var(--brand-text-secondary, #6b7280);
  padding: 1px 6px; background: var(--brand-surface, #f9fafb);
  border: 1px solid var(--brand-border, #e5e7eb); border-radius: 3px;
}
.param-location {
  font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;
}
.param-required {
  font-size: 10px; font-weight: 700; color: #dc2626; text-transform: uppercase;
}
.param-deprecated {
  font-size: 10px; font-weight: 700; color: #f59e0b; text-transform: uppercase;
  text-decoration: line-through;
}
.param-desc { margin: 0; font-size: 13px; line-height: 1.6; color: var(--brand-text-secondary, #6b7280); }
.param-meta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; }
.meta-item { font-size: 12px; color: #94a3b8; }
.meta-item code {
  font-family: 'SF Mono', monospace; font-size: 11px;
  padding: 1px 4px; background: var(--brand-surface, #f9fafb);
  border-radius: 3px; color: var(--brand-text-primary, #111827);
}
.param-children { border-top: 1px solid var(--brand-divider, #f3f4f6); }
</style>
