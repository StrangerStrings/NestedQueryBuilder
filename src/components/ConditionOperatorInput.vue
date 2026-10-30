<script setup lang="ts">
import { computed, useId } from 'vue'
import type { DatabaseOperator } from '../types/databaseOperator'

const props = defineProps<{
  modelValue: string
  options: readonly DatabaseOperator[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const operatorDescriptionId = useId()

// Resolve catalogue wording without making dialect assumptions in the shared control.
const selectedOperator = computed(() =>
  props.options.find((operator) => operator.id === props.modelValue),
)

// Allow all input shapes and value types implemented by the shared editor.
function isOperatorDisabled(operator: DatabaseOperator): boolean {
  const input = operator.valueInput
  return input.hasValue && !input.dataTypes.some((type) => type !== 'duration')
}
</script>

<template>
  <div class="condition-operator">
    <span>Operator</span>
    <div class="operator-input-row">
      <select
        :value="modelValue"
        aria-label="Operator"
        :aria-describedby="selectedOperator ? operatorDescriptionId : undefined"
        :disabled="options.length === 0"
        @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="operator in options"
          :key="operator.id"
          :value="operator.id"
          :disabled="isOperatorDisabled(operator)"
        >
          {{ operator.id }} ({{ operator.label }})
        </option>
      </select>
      <span class="operator-info-wrapper">
        <span
          class="operator-info material-symbols-outlined"
          role="img"
          aria-label="Operator information"
        >
          info
        </span>
        <span
          v-if="selectedOperator"
          :id="operatorDescriptionId"
          class="operator-tooltip"
          role="tooltip"
        >
          {{ selectedOperator.description }}
        </span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.condition-operator {
  display: grid;
  gap: 0.5rem;
  margin-top: 2rem;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.operator-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.operator-info-wrapper {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.operator-info {
  color: var(--text-muted);
  font-size: 1.125rem;
  cursor: help;
}

.operator-tooltip {
  position: absolute;
  top: calc(100% + 1rem);
  right: 0;
  z-index: 20;
  width: 16rem;
  max-width: calc(100vw - 2rem);
  box-sizing: border-box;
  padding: 0.6rem 0.75rem;
  border-radius: 4px;
  background: var(--surface-tooltip);
  color: var(--text-tooltip);
  box-shadow: 0 4px 12px var(--shadow-tooltip);
  font-size: 0.8125rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.12s;
}

.operator-info-wrapper:hover .operator-tooltip {
  visibility: visible;
  opacity: 1;
}

select {
  flex: 1;
  min-width: 0;
  width: 100%;
  padding: 0.45rem;
  border: 1px solid var(--border-control);
  border-radius: 4px;
  background: var(--surface-input);
  color: inherit;
  font: inherit;
}
</style>
