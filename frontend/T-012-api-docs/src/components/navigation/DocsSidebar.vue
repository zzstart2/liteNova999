<script setup lang="ts">
/**
 * DocsSidebar - 文档站侧边栏
 *
 * 模式切换 + 搜索 + 分组导航
 */
import type { ApiMode, ApiGroup, ApiEndpoint, SearchResult } from '../../types/api-docs';
import MethodBadge from '../common/MethodBadge.vue';

defineProps<{
  mode: ApiMode;
  groups: ApiGroup[];
  endpoints: ApiEndpoint[];
  selectedId: string | null;
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
}>();

const emit = defineEmits<{
  (e: 'set-mode', mode: ApiMode): void;
  (e: 'select', id: string): void;
  (e: 'update:searchQuery', value: string): void;
}>();

function endpointsForGroup(groupId: string, endpoints: ApiEndpoint[]): ApiEndpoint[] {
  return endpoints.filter((ep) => ep.groupId === groupId);
}
</script>

<template>
  <aside class="sidebar">
    <!-- 模式切换 -->
    <div class="sidebar__modes">
      <button
        :class="['mode-btn', { active: mode === 'passthrough' }]"
        @click="emit('set-mode', 'passthrough')"
      >
        🔀 Passthrough
      </button>
      <button
        :class="['mode-btn', { active: mode === 'platform' }]"
        @click="emit('set-mode', 'platform')"
      >
        ⚙️ Platform
      </button>
    </div>

    <!-- 搜索 -->
    <div class="sidebar__search">
      <input
        :value="searchQuery"
        class="search-input"
        placeholder="Search endpoints..."
        @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- 搜索结果 -->
    <div v-if="isSearching" class="sidebar__results">
      <div class="results-label">{{ searchResults.length }} results</div>
      <button
        v-for="result in searchResults"
        :key="result.endpoint.id"
        :class="['nav-item', { 'nav-item--active': selectedId === result.endpoint.id }]"
        @click="emit('select', result.endpoint.id)"
      >
        <MethodBadge :method="result.endpoint.method" />
        <span class="nav-item__name">{{ result.endpoint.name }}</span>
      </button>
    </div>

    <!-- 分组导航 -->
    <nav v-else class="sidebar__nav">
      <div v-for="group in groups" :key="group.id" class="nav-group">
        <div class="nav-group__title">
          <span v-if="group.icon" class="nav-group__icon">{{ group.icon }}</span>
          {{ group.name }}
        </div>
        <button
          v-for="ep in endpointsForGroup(group.id, endpoints)"
          :key="ep.id"
          :class="['nav-item', { 'nav-item--active': selectedId === ep.id }]"
          @click="emit('select', ep.id)"
        >
          <MethodBadge :method="ep.method" />
          <span class="nav-item__name">{{ ep.name }}</span>
        </button>
      </div>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 280px; height: 100vh; position: sticky; top: 0;
  border-right: 1px solid var(--brand-border, #e5e7eb);
  background: var(--brand-bg, #ffffff); overflow-y: auto;
  display: flex; flex-direction: column; flex-shrink: 0;
}
.sidebar__modes { display: flex; padding: 12px; gap: 4px; }
.mode-btn {
  flex: 1; padding: 8px; font-size: 12px; font-weight: 600;
  color: var(--brand-text-secondary, #6b7280); background: var(--brand-surface, #f9fafb);
  border: 1px solid var(--brand-border, #e5e7eb); border-radius: 6px; cursor: pointer;
  transition: all 0.15s;
}
.mode-btn:hover { color: var(--brand-text-primary, #111827); }
.mode-btn.active {
  color: var(--brand-primary, #3b82f6); background: var(--brand-primary-50, #eff6ff);
  border-color: var(--brand-primary-200, #bfdbfe); font-weight: 700;
}

.sidebar__search { padding: 0 12px 12px; }
.search-input {
  width: 100%; padding: 8px 12px; font-size: 13px;
  border: 1px solid var(--brand-border, #e5e7eb); border-radius: 6px;
  background: var(--brand-surface, #f9fafb); color: var(--brand-text-primary, #111827);
}
.search-input:focus { outline: none; border-color: var(--brand-primary, #3b82f6); }

.sidebar__nav, .sidebar__results { flex: 1; padding: 0 8px 16px; }
.results-label { padding: 4px 8px; font-size: 11px; color: #94a3b8; }

.nav-group { margin-bottom: 16px; }
.nav-group__title {
  padding: 6px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--brand-text-secondary, #6b7280);
  display: flex; align-items: center; gap: 6px;
}
.nav-group__icon { font-size: 14px; }

.nav-item {
  width: 100%; display: flex; align-items: center; gap: 8px;
  padding: 7px 8px; font-size: 13px; color: var(--brand-text-primary, #111827);
  background: transparent; border: none; border-radius: 6px; cursor: pointer;
  text-align: left; transition: background 0.1s;
}
.nav-item:hover { background: var(--brand-surface, #f9fafb); }
.nav-item--active {
  background: var(--brand-primary-50, #eff6ff);
  color: var(--brand-primary, #3b82f6); font-weight: 600;
}
.nav-item__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
