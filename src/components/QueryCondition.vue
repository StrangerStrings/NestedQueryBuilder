<script setup lang="ts">
import { computed } from 'vue'
import { useQueryStore } from '../stores/queryStore'
import type { QueryCondition } from '../types/query'

const props = defineProps<{
  condition: QueryCondition
  editable?: boolean
  selected?: boolean
}>()

const queryStore = useQueryStore()
// Resolve operator metadata for the display label and operator validation.
const operator = computed(() =>
  queryStore.operators.find((operator) => operator.id === props.condition.operatorId),
)

// Keep the stored operator ID visible when its metadata is unavailable.
const operatorLabel = computed(() => operator.value?.label ?? props.condition.operatorId)

// Show list items explicitly, including empty text and falsy values, while preserving other summaries.
const valueLabel = computed(() => {
  const value = props.condition.value
  if (!value.hasValue) return ''
  if (value.dataShape === 'list') {
    return `[${value.value.map((item) => JSON.stringify(item)).join(', ')}]`
  }
  return typeof value.value === 'string' ? JSON.stringify(value.value) : value.value
})

// Apply this condition's saved shade within its field's shared colour family.
const colourStyle = computed(() => {
  const colour = queryStore.getConditionColour(props.condition)
  return colour
    ? {
        '--condition-background': colour.background,
        '--condition-accent': colour.accent,
      }
    : undefined
})

// Validate the field and operator; empty and whitespace-only string values are valid.
const isInvalid = computed(() => !props.condition.field.trim() || !operator.value)

const emit = defineEmits<{
  select: [condition: QueryCondition]
}>()
</script>

<template>
  <div
    class="query-condition"
    :class="{ 'is-selected': selected, 'is-invalid': isInvalid, 'is-editable': editable }"
    :style="colourStyle"
    @click="editable && emit('select', condition)"
  >
    <button type="button" class="condition-content" :disabled="!editable">
      <span class="condition-field">{{ condition.field.trim() || 'Select a field' }}</span>
      <span class="condition-operator">{{ operatorLabel }}</span>
      <span v-if="condition.value.hasValue" class="condition-value">
        {{ valueLabel }}
      </span>
    </button>
    <span
      v-if="isInvalid"
      class="condition-warning material-symbols-outlined"
      role="img"
      aria-label="Incomplete condition"
      title="Incomplete condition"
    >
      warning
    </span>
    <button
      v-if="editable"
      type="button"
      class="condition-delete"
      aria-label="Delete condition"
      @click.stop="queryStore.removeNode(condition.id)"
    >
      <span class="material-symbols-outlined" aria-hidden="true">delete</span>
    </button>
  </div>
</template>

<style scoped>
.query-condition {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.2rem;
  border: 3px solid var(--condition-accent, #94a3b8);
  border-radius: 22px;
  background: var(--condition-background, #f8fafc);
  color: #172033;
  text-align: left;
  font: inherit;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.query-condition.is-editable {
  cursor: pointer;
}

.query-condition.is-selected::before {
  content: '';
  position: absolute;
  top: -3px;
  bottom: -3px;
  left: 0;
  width: 6px;
  background: var(--condition-accent, #94a3b8);
  pointer-events: none;
}

.query-condition.is-invalid {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.query-condition.is-invalid.is-selected::before {
  background: #9ca3af;
}

.condition-warning {
  flex-shrink: 0;
  color: #4b5563;
  font-size: 1.3rem;
}

.condition-content {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.condition-content:disabled {
  cursor: default;
}

.condition-delete {
  opacity: 0;
  pointer-events: none;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #5b6472;
  cursor: pointer;
}

.query-condition:hover .condition-delete {
  opacity: 1;
  pointer-events: auto;
}

.condition-delete:hover,
.condition-delete:focus-visible {
  background: rgba(0, 0, 0, 0.06);
  color: #172033;
}

.condition-delete .material-symbols-outlined {
  font-size: 1.3rem;
}

.condition-field,
.condition-value {
  font-weight: 600;
}

.condition-operator {
  letter-spacing: 0.08em;
}
</style>
