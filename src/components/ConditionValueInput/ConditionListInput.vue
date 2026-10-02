<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, toRaw, watch } from 'vue'
import type { ConditionValue } from '../../types/query'
import { createId } from '../../utils/createId'
import ConditionScalarInput from './ConditionScalarInput.vue'

const props = defineProps<{ modelValue: ConditionValue }>()
const emit = defineEmits<{ 'update:modelValue': [value: ConditionValue] }>()

const defaults = { text: '', number: 0, boolean: false }
const root = ref<HTMLElement>()
const rows = shallowRef<{ id: string; value: string | number | boolean }[]>([])
const pendingValues = new WeakSet<object>()

// Restrict this editor to the supported list types without converting incoming values.
const listValue = computed(() => {
  const value = props.modelValue
  if (
    value.hasValue &&
    value.dataShape === 'list' &&
    (value.dataType === 'text' || value.dataType === 'number' || value.dataType === 'boolean')
  )
    return value
  return undefined
})

// Preserve local identities for emitted feedback and rebuild rows for external replacements.
function syncRows() {
  const incoming = toRaw(props.modelValue)
  if (pendingValues.delete(incoming)) return

  const current = listValue.value
  if (!current) {
    rows.value = []
    return
  }

  const values = current.value.length ? current.value : [defaults[current.dataType]]
  rows.value = values.map((value) => ({ id: createId(), value }))
}

watch(() => props.modelValue, syncRows, { immediate: true, deep: true })

// Publish plain typed arrays, keeping row identities exclusively inside the editor.
function publishRows() {
  const current = listValue.value
  if (!current || !rows.value.length) return

  const values = rows.value.map((row) => row.value)
  let value: ConditionValue
  if (current.dataType === 'text' && values.every((item) => typeof item === 'string')) {
    value = { ...current, value: values }
  } else if (current.dataType === 'number' && values.every((item) => typeof item === 'number')) {
    value = { ...current, value: values }
  } else if (current.dataType === 'boolean' && values.every((item) => typeof item === 'boolean')) {
    value = { ...current, value: values }
  } else {
    return
  }

  pendingValues.add(value)
  emit('update:modelValue', value)
}

// Edit one row without changing the identities or values of the other rows.
function editRow(id: string, value: string | number | boolean) {
  if (!rows.value.some((row) => row.id === id)) return
  rows.value = rows.value.map((row) => (row.id === id ? { ...row, value } : row))
  publishRows()
}

// Focus the row's input or selected boolean button after structural changes.
async function focusRow(id: string) {
  await nextTick()
  root.value
    ?.querySelector<HTMLElement>(
      `[data-row-id="${id}"] input, [data-row-id="${id}"] button[aria-pressed="true"]`,
    )
    ?.focus()
}

// Append one default item and focus it without recreating existing rows.
function addRow() {
  const current = listValue.value
  if (!current) return
  const row = { id: createId(), value: defaults[current.dataType] }
  rows.value = [...rows.value, row]
  publishRows()
  void focusRow(row.id)
}

// Retain at least one item and focus the next row, or the previous row when removing the last.
function removeRow(id: string) {
  if (rows.value.length <= 1) return
  const index = rows.value.findIndex((row) => row.id === id)
  if (index === -1) return
  rows.value = rows.value.filter((row) => row.id !== id)
  publishRows()
  const neighbour = rows.value[Math.min(index, rows.value.length - 1)]
  if (neighbour) void focusRow(neighbour.id)
}
</script>

<template>
  <div v-if="listValue" ref="root" class="condition-list-input">
    <div v-for="(row, index) in rows" :key="row.id" :data-row-id="row.id" class="list-row">
      <ConditionScalarInput
        :data-type="listValue.dataType"
        :model-value="row.value"
        :label="`Value ${index + 1}`"
        hide-label
        @update:model-value="editRow(row.id, $event)"
      />
      <button
        type="button"
        :aria-label="`Remove value ${index + 1}`"
        title="Remove value"
        :disabled="rows.length <= 1"
        @click="removeRow(row.id)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">remove</span>
      </button>
    </div>
    <button
      type="button"
      class="add-value"
      aria-label="Add value"
      title="Add value"
      @click="addRow"
    >
      <span class="material-symbols-outlined" aria-hidden="true">add</span>
    </button>
  </div>
</template>

<style scoped>
.condition-list-input {
  display: grid;
  gap: 0.3rem;
}

.list-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
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

button:hover:not(:disabled) {
  background: #f3f6fa;
}

button:disabled {
  opacity: 0.45;
  cursor: default;
}

button:focus-visible {
  outline: 2px solid #172033;
  outline-offset: 2px;
}

.add-value {
  justify-self: start;
}

button .material-symbols-outlined {
  font-size: 1.25rem;
}
</style>
