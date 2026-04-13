<script setup lang="ts">
/**
 * NavTree - 导航树
 *
 * 分组 + 端点列表，可折叠分组
 */
import { ref } from 'vue';
import type { ApiGroup, ApiEndpoint } from '../../types/api-docs';
import MethodBadge from '../common/MethodBadge.vue';

const props = defineProps<{
  groups: ApiGroup[];
  endpoints: ApiEndpoint[];
  selectedId: string | null;
}>();

const emit = defineEmits<{
  (e: 'select', id: string): void;
}>();

// 分组折叠状态 — 默认全部展开
const collapsed = ref<Set<string>>(new Set());

function toggleGroup(groupId: string) {
  if (collapsed.value.has(groupId)) {
    collapsed.value.delete(groupId);
  } else {
    collapsed.value.add(groupId);
  }
}

function endpointsForGroup(groupId: string): ApiEndpoint[] {
  return props.endpoints.filter((ep) => ep.groupId === groupId);
}

function isCollapsed(groupId: string): boolean {
  return collapsed.value.has(groupId);
}
</script>

<template>
  <nav class="nav-tree" role="navigation" aria-label="API endpoints">
    <div v-for="group in groups" :key="group.id" class="nav-group">
      <button
        class="nav-group__header"
        :aria-expanded="!isCollapsed(group.id)"
        @click="toggleGroup(group.id)"
      >
        <span class="nav-group__arrow" :class="{ collapsed: isCollapsed(group.id) }">▾</span>
        <span v-if="group.icon" class="nav-group__icon">{{ group.icon }}</span>
        <span class="nav-group__name">{{ group.name }}</span>
        <span class="nav-group__count">{{ endpointsForGroup(group.id).length }}</span>
      </button>

      <div v-show="!isCollapsed(group.id)" class="nav-group__items" role="list">
        <button
          v-for="ep in endpointsForGroup(group.id)"
          :key="ep.id"
          :class="['nav-item', { 'nav-item--active': selectedId === ep.id }]"
          role="listitem"
          @click="emit('select', ep.id)"
        >
          <MethodBadge :method="ep.method" />
          <span class="nav-item__name" :title="ep.name">{{ ep.name }}</span>
          <span v-if="ep.tags?.includes('beta')" class="nav-item__tag">β</span>
          <span v-if="ep.tags?.includes('deprecated')" class="nav-item__tag nav-item__tag--dep">⚠</span>
        </button>
      </div>
    </div>

    <div v-if="groups.length === 0" class="nav-tree__empty">
      No endpoints available
    </div>
  </nav>
</template>

<style scoped>
.nav-tree { padding: 4px 0; }
.nav-group { margin-bottom: 4px; }

.nav-group__header {
  width: 100%; display: flex; align-items: center; gap: 6px;
  padding: 6px 8px; border: none; background: transparent; cursor: pointer;
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--brand-text-secondary, #6b7280); border-radius: 6px;
  transition: background 0.1s;
}
.nav-group__header:hover { background: var(--brand-surface, #f9fafb); }

.nav-group__arrow {
  font-size: 10px; transition: transform 0.15s; width: 12px; text-align: center;
}
.nav-group__arrow.collapsed { transform: rotate(-90deg); }
.nav-group__icon { font-size: 13px; }
.nav-group__name { flex: 1; text-align: left; }
.nav-group__count {
  font-size: 10px; font-weight: 600; color: #94a3b8;
  background: var(--brand-surface, #f9fafb); padding: 0 5px; border-radius: 3px;
}

.nav-group__items { padding: 2px 0 4px 8px; }

.nav-item {
  width: 100%; display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border: none; background: transparent;
  cursor: pointer; text-align: left; border-radius: 6px;
  transition: background 0.1s; font-size: 13px;
  color: var(--brand-text-primary, #111827);
}
.nav-item:hover { background: var(--brand-surface, #f9fafb); }
.nav-item--active {
  background: var(--brand-primary-50, #eff6ff);
  color: var(--brand-primary, #3b82f6); font-weight: 600;
}
.nav-item__name {
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.nav-item__tag {
  font-size: 9px; font-weight: 700; color: #8b5cf6;
  background: #f5f3ff; padding: 1px 4px; border-radius: 3px;
}
.nav-item__tag--dep { color: #f59e0b; background: #fffbeb; }

.nav-tree__empty {
  padding: 24px 12px; text-align: center; font-size: 13px;
  color: var(--brand-text-secondary, #6b7280);
}
</style>
