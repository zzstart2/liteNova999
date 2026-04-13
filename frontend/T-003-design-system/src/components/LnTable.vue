<script setup lang="ts">
/**
 * LnTable — liteNova999 Table Component
 *
 * Data table with hover, striped, and selectable row support.
 * Uses slots for maximum flexibility.
 */

export interface LnTableColumn {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface LnTableProps {
  /** Column definitions */
  columns: LnTableColumn[];
  /** Row data (array of objects) */
  rows?: Record<string, unknown>[];
  /** Enable striped rows */
  striped?: boolean;
  /** Enable row hover highlight */
  hoverable?: boolean;
  /** Selected row indices (for selectable tables) */
  selectedRows?: number[];
  /** Empty state text */
  emptyText?: string;
}

const props = withDefaults(defineProps<LnTableProps>(), {
  rows: () => [],
  striped: false,
  hoverable: true,
  selectedRows: () => [],
  emptyText: 'No data available',
});

defineEmits<{
  'row-click': [row: Record<string, unknown>, index: number];
}>();

function isSelected(index: number): boolean {
  return props.selectedRows.includes(index);
}
</script>

<template>
  <div class="ln-table-wrapper">
    <table
      :class="[
        'ln-table',
        {
          'ln-table--striped': striped,
          'ln-table--hoverable': hoverable,
        },
      ]"
    >
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            :style="{
              width: col.width,
              textAlign: col.align ?? 'left',
            }"
          >
            <slot :name="`header-${col.key}`" :column="col">
              {{ col.label }}
            </slot>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in rows"
          :key="index"
          :class="{ 'ln-table__row--selected': isSelected(index) }"
          @click="$emit('row-click', row, index)"
        >
          <td
            v-for="col in columns"
            :key="col.key"
            :style="{ textAlign: col.align ?? 'left' }"
          >
            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]" :index="index">
              {{ row[col.key] ?? '' }}
            </slot>
          </td>
        </tr>

        <!-- Empty state -->
        <tr v-if="rows.length === 0">
          <td :colspan="columns.length" class="ln-table__empty">
            <slot name="empty">
              {{ emptyText }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.ln-table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.ln-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.ln-table th {
  background: var(--color-neutral-50);
  font-weight: var(--font-semibold);
  color: var(--color-neutral-500);
  text-align: left;
  white-space: nowrap;
}

.ln-table th,
.ln-table td {
  height: 52px;
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--color-neutral-100);
  vertical-align: middle;
}

.ln-table tbody tr:last-child td {
  border-bottom: none;
}

/* Hoverable */
.ln-table--hoverable tbody tr:hover {
  background: var(--color-neutral-50);
}

/* Striped */
.ln-table--striped tbody tr:nth-child(odd) {
  background: var(--color-neutral-50);
}

/* Selected */
.ln-table__row--selected {
  background: var(--color-primary-50) !important;
}

/* Empty state */
.ln-table__empty {
  text-align: center;
  color: var(--color-neutral-400);
  padding: var(--space-12) var(--space-4);
  font-size: var(--text-base);
}

/* Dark mode */
:global([data-theme="dark"]) .ln-table th {
  background: var(--color-neutral-800);
}

:global([data-theme="dark"]) .ln-table--hoverable tbody tr:hover {
  background: var(--color-neutral-700);
}

:global([data-theme="dark"]) .ln-table--striped tbody tr:nth-child(odd) {
  background: rgba(255, 255, 255, 0.02);
}
</style>
