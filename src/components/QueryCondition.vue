<script setup lang="ts">
import { computed } from 'vue'
import { useQueryStore } from '../stores/queryStore'
import { useSettingsStore } from '../stores/settingsStore'
import type { QueryCondition } from '../types/query'
import { resolveConditionColourAppearance } from '../colours/palette'

const props = defineProps<{
  condition: QueryCondition
  editable?: boolean
  selected?: boolean
}>()

const queryStore = useQueryStore()
const settingsStore = useSettingsStore()

// Resolve operator metadata for the display label and operator validation.
const operator = computed(() =>
  queryStore.operators.find((operator) => operator.id === props.condition.operatorId),
)

// Apply the display preference, falling back to the stored ID when metadata is unavailable.
const operatorLabel = computed(() =>
  settingsStore.showOperatorLabels
    ? operator.value?.label ?? props.condition.operatorId
    : props.condition.operatorId,
)

// Count every configured Elasticsearch row, including Off and zero values.
const parameterCount = computed(() => queryStore.database === 'elasticsearch'
  ? props.condition.parameters?.length ?? 0
  : 0,
)

// Show the optional function around the field name while preserving the empty-field prompt.
const fieldLabel = computed(() => {
  const { name, modifier } = props.condition.field
  const fieldName = name.trim()
  if (!fieldName) return 'Select a field'
  return modifier === null ? fieldName : `${modifier}(${fieldName})`
})

// Show field references without quotes while preserving literal and list summaries.
const valueLabel = computed(() => {
  const value = props.condition.value
  if (!value.hasValue) return ''
  if (value.dataType === 'field' && value.dataShape === 'single') {
    return value.value.trim() || 'Select a field'
  }
  if (value.dataShape === 'list') {
    return `[${value.value.map((item) => JSON.stringify(item)).join(', ')}]`
  }
  return typeof value.value === 'string' ? JSON.stringify(value.value) : value.value
})

// Validate each condition through the selected dialect and retain node-specific generation feedback.
const generationError = computed(() => {
  const result = queryStore.whereSqlResult
  if (!result.success && result.nodeId === props.condition.id) return result.error
  const conditionResult = queryStore.adapter.generateConditionSql(props.condition)
  return conditionResult.success ? null : conditionResult.error
})

// Surface generation errors from the selected database adapter.
const isInvalid = computed(() => generationError.value !== null)

// Apply the shared appearance to the card and selected bars without changing assignments.
const colourStyle = computed(() => {
  const colour = resolveConditionColourAppearance(
    queryStore.getConditionColour(props.condition),
    settingsStore.resolvedTheme,
    props.condition.rawSql !== undefined,
    isInvalid.value,
  )
  return {
    '--condition-background': colour.background,
    '--condition-accent': colour.accent,
  }
})

const emit = defineEmits<{
  select: [condition: QueryCondition]
}>()
</script>

<template>
  <div
    class="query-condition"
    :class="{ 'is-selected': selected, 'is-invalid': isInvalid, 'is-editable': editable, 'is-raw': condition.rawSql !== undefined }"
    :style="colourStyle"
    @click="editable && emit('select', condition)"
  >
    <button
      v-if="editable && settingsStore.dragAndDropMode"
      type="button"
      class="condition-drag-handle"
      aria-label="Drag to reorder condition"
      title="Drag to reorder condition"
      @click.stop
    >
      <span class="material-symbols-outlined" aria-hidden="true">drag_indicator</span>
    </button>
    <button
      type="button"
      class="condition-content"
      :data-edit-condition-id="editable ? condition.id : undefined"
      :disabled="!editable"
      :aria-invalid="isInvalid"
      :aria-describedby="isInvalid ? `${condition.id}-error` : undefined"
    >
      <span v-if="condition.rawSql !== undefined" :aria-label="queryStore.adapter.rawCondition?.accessibleLabel ?? 'Raw SQL condition'">
        {{ condition.rawSql || 'Enter a condition' }}
      </span>
      <template v-else>
        <span class="condition-field">{{ fieldLabel }}</span>
        <span class="condition-operator">
          {{ operatorLabel }}<span
            v-if="parameterCount"
            role="img"
            :aria-label="`${parameterCount} optional ${parameterCount === 1 ? 'parameter' : 'parameters'} configured`"
          >{{ '*'.repeat(parameterCount) }}</span>
        </span>
        <span v-if="condition.value.hasValue" class="condition-value">
          {{ valueLabel }}
        </span>
      </template>
    </button>
    <span
      v-if="isInvalid"
      :id="`${condition.id}-error`"
      class="condition-warning material-symbols-outlined"
      role="img"
      :aria-label="generationError ?? 'Incomplete condition'"
      :title="generationError ?? 'Incomplete condition'"
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
  border: 3px solid var(--condition-accent);
  border-radius: 22px;
  background: var(--condition-background);
  color: var(--text-primary);
  text-align: left;
  font: inherit;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.query-condition.is-editable {
  cursor: pointer;
}

.condition-drag-handle {
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
  color: var(--text-muted);
  cursor: grab;
}

.condition-drag-handle:active {
  cursor: grabbing;
}

.condition-drag-handle:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  background: var(--surface-condition-action-hover);
}

.query-condition.is-selected::before,
.query-condition.is-selected::after {
  content: '';
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 6px;
  background: var(--condition-accent);
  pointer-events: none;
}

.query-condition.is-selected::before {
  left: 0;
}

.query-condition.is-selected::after {
  right: 0;
}

.condition-warning {
  flex-shrink: 0;
  color: var(--text-condition-warning);
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

.condition-content:focus-visible,
.condition-delete:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
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
  color: var(--text-muted);
  cursor: pointer;
}

.query-condition:hover .condition-delete,
.query-condition:focus-within .condition-delete {
  opacity: 1;
  pointer-events: auto;
}

.condition-delete:hover,
.condition-delete:focus-visible {
  background: var(--surface-condition-action-hover);
  color: var(--text-primary);
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

@media (width < 768px) {
  .query-condition {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    gap: 0.25rem;
    min-width: 0;
    padding: 0.5rem;
    border-radius: 16px;
  }

  .condition-content {
    grid-row: 1;
    grid-column: 1 / -1;
    min-height: 44px;
    gap: 0.25rem 0.5rem;
  }

  .condition-content > span {
    min-width: 0;
    max-width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .condition-drag-handle,
  .condition-delete {
    grid-row: 2;
    width: 44px;
    height: 44px;
  }

  .condition-drag-handle {
    grid-column: 1;
  }

  .condition-warning {
    grid-row: 2;
    grid-column: 2;
    justify-self: center;
  }

  .condition-delete {
    grid-column: 3;
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
