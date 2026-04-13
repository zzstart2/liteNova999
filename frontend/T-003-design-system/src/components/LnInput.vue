<script setup lang="ts">
/**
 * LnInput — liteNova999 Input Component
 *
 * Text input with label, error state, disabled state, and two sizes.
 */

import type { InputSize } from '../types/design-tokens';

export interface LnInputProps {
  /** Input model value */
  modelValue?: string;
  /** Label text */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Error message (shows error state when non-empty) */
  error?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Input size */
  size?: InputSize;
  /** Input type */
  type?: string;
  /** Input id (auto-generated if not provided) */
  id?: string;
  /** Required field */
  required?: boolean;
}

const props = withDefaults(defineProps<LnInputProps>(), {
  modelValue: '',
  label: undefined,
  placeholder: undefined,
  error: undefined,
  disabled: false,
  size: 'md',
  type: 'text',
  id: undefined,
  required: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  focus: [event: FocusEvent];
  blur: [event: FocusEvent];
}>();

const inputId = computed(() => props.id ?? `ln-input-${uid}`);
const errorId = computed(() => props.error ? `${inputId.value}-error` : undefined);
const hasError = computed(() => !!props.error);

function onInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <div class="ln-input-group">
    <label
      v-if="label"
      :for="inputId"
      class="ln-input-label"
    >
      {{ label }}
      <span v-if="required" class="ln-input-required" aria-hidden="true">*</span>
    </label>

    <input
      :id="inputId"
      :class="[
        'ln-input',
        `ln-input--${size}`,
        { 'ln-input--error': hasError },
      ]"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :aria-invalid="hasError || undefined"
      :aria-describedby="errorId"
      @input="onInput"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
    />

    <span
      v-if="error"
      :id="errorId"
      class="ln-input-error"
      role="alert"
    >
      {{ error }}
    </span>
  </div>
</template>

<script lang="ts">
import { computed } from 'vue';

let uidCounter = 0;
const uid = ++uidCounter;
</script>

<style scoped>
.ln-input-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.ln-input-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.ln-input-required {
  color: var(--color-error);
  margin-left: 2px;
}

.ln-input {
  height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  color: var(--color-text-primary);
  background: var(--color-bg-card);
  transition:
    border-color var(--duration-normal) var(--ease-out),
    box-shadow var(--duration-normal) var(--ease-out);
  width: 100%;
}

.ln-input::placeholder {
  color: var(--color-neutral-400);
}

.ln-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(51, 84, 255, 0.15);
}

.ln-input--lg {
  height: 48px;
  padding: 0 var(--space-4);
}

/* Error state */
.ln-input--error {
  border-color: var(--color-error);
}

.ln-input--error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}

.ln-input-error {
  font-size: var(--text-xs);
  color: var(--color-error);
}

/* Disabled */
.ln-input:disabled {
  background: var(--color-neutral-100);
  color: var(--color-neutral-400);
  cursor: not-allowed;
}
</style>
