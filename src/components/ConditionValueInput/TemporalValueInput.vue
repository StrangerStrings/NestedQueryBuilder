<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { isValidTemporal, temporalDefaults, type TemporalType } from '../../utils/temporalValue'

const props = defineProps<{
  dataType: TemporalType
  modelValue: string
  label: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const input = ref<HTMLInputElement>()
let pendingValue: string | undefined

// Apply external replacements without binding Vue to the browser's unfinished draft.
function syncInput() {
  if (input.value) input.value.value = props.modelValue
}

onMounted(syncInput)

// Preserve emitted feedback, but replace drafts for external values and type changes.
watch(
  [() => props.modelValue, () => props.dataType],
  ([value, dataType], [, previousType]) => {
    const isFeedback = dataType === previousType && value === pendingValue
    pendingValue = undefined
    if (!isFeedback) syncInput()
  },
  { flush: 'post' },
)

// Accept native minute-only strings only after normalising and validating the full value.
function normalizedValue(element: HTMLInputElement): string | undefined {
  if (element.validity.badInput) return undefined
  let value = element.value
  if (
    (props.dataType === 'time' && value.length === 5) ||
    (props.dataType === 'datetime' && value.length === 16)
  ) {
    value += ':00'
  }
  return isValidTemporal(value, props.dataType) ? value : undefined
}

// Track the parent's response for this update using the numeric editor's feedback convention.
function publishValue(value: string) {
  pendingValue = value
  emit('update:modelValue', value)
  nextTick(() => {
    if (pendingValue === value) pendingValue = undefined
  })
}

// Publish complete values immediately without assigning to the visible native draft.
function editValue(event: Event) {
  const value = normalizedValue(event.currentTarget as HTMLInputElement)
  if (value !== undefined) publishValue(value)
}

// Commit once using one local clock snapshot, replacing incomplete values with today's default.
function commitValue(event: Event) {
  const element = event.currentTarget as HTMLInputElement
  const defaults = temporalDefaults(new Date())
  const value = normalizedValue(element) ?? defaults[props.dataType]
  element.value = value
  publishValue(value)
}
</script>

<template>
  <input
    ref="input"
    :type="dataType === 'datetime' ? 'datetime-local' : dataType"
    :step="dataType === 'date' ? undefined : 1"
    :aria-label="label"
    @input="editValue"
    @blur="commitValue"
    @keydown.enter.prevent="commitValue"
  />
</template>
