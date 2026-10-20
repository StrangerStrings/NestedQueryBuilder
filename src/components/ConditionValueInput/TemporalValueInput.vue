<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { isValidTemporal, temporalDefaults, type TemporalType } from '../../utils/temporalValue'
import { useQueryStore } from '../../stores/queryStore'
import { useQueryInputSession } from '../../composables/useQueryInputSession'

const props = defineProps<{
  dataType: TemporalType
  modelValue: string
  sessionKey: string
  label: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const input = ref<HTMLInputElement>()
let pendingValue: string | undefined
const queryStore = useQueryStore()
const { beginEditing, finishEditing } = useQueryInputSession('edit value', commitValue)

// Preserve composition Enter and finish ordinary single-line input sessions.
function handleEnter(event: KeyboardEvent) {
  if (event.isComposing) return
  event.preventDefault()
  finishEditing()
}

// Discard pending temporal feedback as soon as a query snapshot is restored.
watch(() => queryStore.restorationRevision, () => {
  pendingValue = undefined
}, { flush: 'sync' })

// Apply external replacements without binding Vue to the browser's unfinished draft.
function syncInput() {
  if (input.value) input.value.value = props.modelValue
}

onMounted(syncInput)

// Preserve emitted feedback, but replace drafts for external values and type changes.
watch(
  [() => props.modelValue, () => props.dataType, () => queryStore.restorationRevision],
  // Reset unchanged models too, without normalizing the restored temporal value.
  ([value, dataType, revision], [, previousType, previousRevision]) => {
    const isFeedback = revision === previousRevision && dataType === previousType && value === pendingValue
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
  const revision = queryStore.restorationRevision
  pendingValue = value
  emit('update:modelValue', value)
  // Discard cleanup queued by an earlier restored query.
  nextTick(() => {
    if (revision === queryStore.restorationRevision && pendingValue === value) pendingValue = undefined
  })
}

// Publish complete values immediately without assigning to the visible native draft.
function editValue(event: Event) {
  beginEditing(props.sessionKey)
  const value = normalizedValue(event.currentTarget as HTMLInputElement)
  if (value !== undefined) publishValue(value)
}

// Commit once using one local clock snapshot, replacing incomplete values with today's default.
function commitValue() {
  const element = input.value
  if (!element) return
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
    @blur="finishEditing"
    @keydown.enter="handleEnter"
  />
</template>
