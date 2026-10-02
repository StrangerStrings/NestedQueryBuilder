<script setup lang="ts">
import { computed } from 'vue'
import type { DatabaseOperator, ValueDataType } from '../../types/databaseOperator'
import type { ConditionValue } from '../../types/query'
import ConditionScalarInput from './ConditionScalarInput.vue'
import ConditionListInput from './ConditionListInput.vue'

const props = defineProps<{
  operator: DatabaseOperator
  modelValue: ConditionValue
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ConditionValue]
  'type-change': [dataType: ValueDataType]
}>()

const typeLabels = { text: 'Text', number: 'Number', boolean: 'Boolean' }
const typeIcons = { text: 'text_fields', number: '123', boolean: 'check_circle' }

// Preserve the operator's ordering while excluding types without controls.
const supportedTypes = computed(() => {
  const input = props.operator.valueInput
  return input.hasValue
    ? input.dataTypes.filter((type) => type === 'text' || type === 'number' || type === 'boolean')
    : []
})

// Render only supported values that already match the store-owned operator selection.
const editableValue = computed(() => {
  const value = props.modelValue
  const input = props.operator.valueInput
  if (
    !input.hasValue ||
    !value.hasValue ||
    value.dataShape !== input.dataShape ||
    (value.dataType !== 'text' && value.dataType !== 'number' && value.dataType !== 'boolean') ||
    !input.dataTypes.includes(value.dataType)
  ) {
    return undefined
  }
  return value
})

// Request a supported type change; the parent performs the transition through the store.
function changeType(selected: ValueDataType) {
  const dataType = supportedTypes.value.find((type) => type === selected)
  if (dataType) emit('type-change', dataType)
}

// Edit single values or range endpoints; the list editor owns list edits.
function editValue(value: string | number | boolean, endpoint: 0 | 1 = 0) {
  const current = editableValue.value
  if (!current || current.dataShape === 'list') return

  if (current.dataType === 'text' && typeof value === 'string') {
    emit(
      'update:modelValue',
      current.dataShape === 'single'
        ? { ...current, value }
        : {
            ...current,
            value: endpoint === 0 ? [value, current.value[1]] : [current.value[0], value],
          },
    )
  } else if (current.dataType === 'number' && typeof value === 'number') {
    emit(
      'update:modelValue',
      current.dataShape === 'single'
        ? { ...current, value }
        : {
            ...current,
            value: endpoint === 0 ? [value, current.value[1]] : [current.value[0], value],
          },
    )
  } else if (current.dataType === 'boolean' && typeof value === 'boolean') {
    emit(
      'update:modelValue',
      current.dataShape === 'single'
        ? { ...current, value }
        : {
            ...current,
            value: endpoint === 0 ? [value, current.value[1]] : [current.value[0], value],
          },
    )
  }
}
</script>

<template>
  <div v-if="editableValue" class="condition-value-input">
    <h4 class="value-heading">Value</h4>
    <div v-if="supportedTypes.length > 1" class="value-types" role="group" aria-label="Value type">
      <button
        v-for="dataType in supportedTypes"
        :key="dataType"
        type="button"
        :aria-label="typeLabels[dataType]"
        :title="typeLabels[dataType]"
        :aria-pressed="editableValue.dataType === dataType"
        @click="changeType(dataType)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">{{ typeIcons[dataType] }}</span>
      </button>
    </div>
    <ConditionScalarInput
      v-if="editableValue.dataShape === 'single'"
      :key="`${editableValue.dataType}-single`"
      :data-type="editableValue.dataType"
      :model-value="editableValue.value"
      label="Value"
      hide-label
      @update:model-value="editValue($event)"
    />
    <div
      v-else-if="editableValue.dataShape === 'range'"
      :key="`${editableValue.dataType}-range`"
      class="value-range"
    >
      <ConditionScalarInput
        :data-type="editableValue.dataType"
        :model-value="editableValue.value[0]"
        label="From"
        @update:model-value="editValue($event, 0)"
      />
      <ConditionScalarInput
        :data-type="editableValue.dataType"
        :model-value="editableValue.value[1]"
        label="To"
        @update:model-value="editValue($event, 1)"
      />
    </div>
    <ConditionListInput
      v-else
      :key="`${editableValue.dataType}-list`"
      :model-value="editableValue"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>

<style scoped>
.condition-value-input {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
  color: #172033;
  font-size: 0.875rem;
}

.value-heading {
  margin: 0;
  font-size: inherit;
  font-weight: normal;
}

.value-types {
  display: flex;
  gap: 0.5rem;
}

.value-range {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.5rem;
}

button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem;
  border: 0;
  border-radius: 4px;
  background: #fff;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

button:hover {
  background: #f3f6fa;
}

button[aria-pressed='true'] {
  background: #e8eef9;
}

button:focus-visible {
  outline: 2px solid #172033;
  outline-offset: 2px;
}

button .material-symbols-outlined {
  font-size: 1.25rem;
}
</style>
