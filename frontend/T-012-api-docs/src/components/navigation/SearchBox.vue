<script setup lang="ts">
/**
 * SearchBox - 端点搜索框
 *
 * 实时搜索 + 快捷键 (Cmd+K / Ctrl+K) + 结果下拉
 */
import { ref, onMounted, onBeforeUnmount } from 'vue';
import type { SearchResult } from '../../types/api-docs';
import MethodBadge from '../common/MethodBadge.vue';

defineProps<{
  results: SearchResult[];
  isSearching: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:query', value: string): void;
  (e: 'select', endpointId: string): void;
}>();

const inputRef = ref<HTMLInputElement>();
const inputValue = ref('');
const isFocused = ref(false);

function onInput(ev: Event) {
  const val = (ev.target as HTMLInputElement).value;
  inputValue.value = val;
  emit('update:query', val);
}

function onSelect(id: string) {
  emit('select', id);
  inputValue.value = '';
  emit('update:query', '');
  isFocused.value = false;
  inputRef.value?.blur();
}

function onClear() {
  inputValue.value = '';
  emit('update:query', '');
  inputRef.value?.focus();
}

function onKeydown(ev: KeyboardEvent) {
  if ((ev.metaKey || ev.ctrlKey) && ev.key === 'k') {
    ev.preventDefault();
    inputRef.value?.focus();
  }
  if (ev.key === 'Escape') {
    inputValue.value = '';
    emit('update:query', '');
    inputRef.value?.blur();
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="search-box" :class="{ 'search-box--focused': isFocused }">
    <div class="search-box__input-wrap">
      <svg class="search-box__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        ref="inputRef"
        class="search-box__input"
        :value="inputValue"
        placeholder="Search endpoints..."
        @input="onInput"
        @focus="isFocused = true"
        @blur="setTimeout(() => isFocused = false, 150)"
      />
      <kbd v-if="!inputValue" class="search-box__kbd">⌘K</kbd>
      <button v-else class="search-box__clear" @click="onClear">✕</button>
    </div>

    <!-- Results dropdown -->
    <div v-if="isFocused && isSearching" class="search-box__dropdown">
      <div v-if="results.length === 0" class="search-box__empty">
        No endpoints found
      </div>
      <button
        v-for="r in results.slice(0, 8)"
        :key="r.endpoint.id"
        class="search-box__result"
        @mousedown.prevent="onSelect(r.endpoint.id)"
      >
        <MethodBadge :method="r.endpoint.method" />
        <div class="result__info">
          <span class="result__name">{{ r.endpoint.name }}</span>
          <span class="result__path">{{ r.endpoint.path }}</span>
        </div>
        <span class="result__match">{{ r.matchType }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.search-box { position: relative; }
.search-box__input-wrap {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; border: 1px solid var(--brand-border, #e5e7eb);
  border-radius: 8px; background: var(--brand-surface, #f9fafb);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.search-box--focused .search-box__input-wrap {
  border-color: var(--brand-primary, #3b82f6);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-primary, #3b82f6) 15%, transparent);
}
.search-box__icon { color: #94a3b8; flex-shrink: 0; }
.search-box__input {
  flex: 1; border: none; outline: none; background: transparent;
  font-size: 13px; color: var(--brand-text-primary, #111827);
}
.search-box__input::placeholder { color: #94a3b8; }
.search-box__kbd {
  font-family: 'SF Mono', monospace; font-size: 10px; font-weight: 600;
  color: #94a3b8; background: var(--brand-bg, #ffffff);
  padding: 2px 6px; border: 1px solid var(--brand-border, #e5e7eb); border-radius: 4px;
}
.search-box__clear {
  background: none; border: none; font-size: 12px; color: #94a3b8;
  cursor: pointer; padding: 2px 4px;
}
.search-box__clear:hover { color: var(--brand-text-primary, #111827); }

.search-box__dropdown {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 50;
  background: var(--brand-bg, #ffffff); border: 1px solid var(--brand-border, #e5e7eb);
  border-radius: 8px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  max-height: 340px; overflow-y: auto;
}
.search-box__empty {
  padding: 20px; text-align: center; font-size: 13px;
  color: var(--brand-text-secondary, #6b7280);
}
.search-box__result {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border: none; background: transparent;
  cursor: pointer; text-align: left; transition: background 0.1s;
}
.search-box__result:hover { background: var(--brand-surface, #f9fafb); }
.result__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.result__name {
  font-size: 13px; font-weight: 500; color: var(--brand-text-primary, #111827);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.result__path {
  font-size: 11px; font-family: 'SF Mono', monospace; color: #94a3b8;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.result__match {
  font-size: 10px; color: #94a3b8; padding: 1px 5px;
  background: var(--brand-surface, #f9fafb); border-radius: 3px; flex-shrink: 0;
}
</style>
