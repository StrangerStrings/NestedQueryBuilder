<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { convertConditionValue } from '../../utils/convertConditionValue'
import { useQueryStore } from '../../stores/queryStore'
import { useQueryInputSession } from '../../composables/useQueryInputSession'
import BooleanValueInput from './BooleanValueInput.vue'
import TemporalValueInput from './TemporalValueInput.vue'

const props = defineProps<{
  dataType: 'text' | 'number' | 'boolean' | 'date' | 'time' | 'datetime'
  modelValue: string | number | boolean
  sessionKey: string
  label: string
  hideLabel?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean]
}>()

const numberInput = ref<HTMLInputElement>()
const textInput = ref<HTMLInputElement>()
let pendingNumber: number | undefined
const queryStore = useQueryStore()
const { beginEditing, finishEditing } = useQueryInputSession('edit value', finalizeEditing)

// Normalize an owned numeric draft once before the store completes its session.
function finalizeEditing() {
  if (props.dataType === 'number') commitNumber()
}

// Leave composition Enter untouched while completing ordinary single-line edits.
function handleEnter(event: KeyboardEvent) {
  if (event.isComposing) return
  event.preventDefault()
  finishEditing()
}

// Discard pending numeric feedback when history replaces the model.
watch(() => queryStore.restorationRevision, () => {
  pendingNumber = undefined
}, { flush: 'sync' })

// Write only external changes or committed values, preserving the browser's unfinished numeric draft.
function syncNumberInput() {
  if (numberInput.value) numberInput.value.value = String(props.modelValue)
  if (textInput.value) textInput.value.value = String(props.modelValue)
}

onMounted(syncNumberInput)

// Ignore feedback from our own numeric edit; type changes and external values reset the draft.
watch(
  [() => props.modelValue, () => props.dataType, () => queryStore.restorationRevision],
  // Restoration always resets the browser, even when the stored value is unchanged.
  ([value, dataType, revision], [, previousType, previousRevision]) => {
    const isFeedback = revision === previousRevision && dataType === previousType && Object.is(value, pendingNumber)
    pendingNumber = undefined
    if (!isFeedback) syncNumberInput()
  },
  { flush: 'post' },
)

// Remember the emitted number until Vue has applied the parent's response.
function publishNumber(value: number) {
  const revision = queryStore.restorationRevision
  pendingNumber = value
  emit('update:modelValue', value)
  // Ignore feedback cleanup belonging to a query that has since been restored.
  nextTick(() => {
    if (revision === queryStore.restorationRevision && Object.is(pendingNumber, value)) pendingNumber = undefined
  })
}

// Publish complete finite numbers without assigning to the input's visible draft.
function editNumber(event: Event) {
  beginEditing(props.sessionKey)
  const input = event.currentTarget as HTMLInputElement
  if (!input.validity.badInput && Number.isFinite(input.valueAsNumber)) {
    publishNumber(input.valueAsNumber)
  }
}

// Resolve blank or unfinished input with the shared conversion rules on blur or Enter.
function commitNumber() {
  const input = numberInput.value
  if (!input) return
  const converted = convertConditionValue(
    { hasValue: true, dataType: 'text', dataShape: 'single', value: input.value },
    { hasValue: true, dataType: 'number', dataShape: 'single', value: 0 },
  )
  if (converted.hasValue && converted.dataType === 'number' && converted.dataShape === 'single') {
    input.value = String(converted.value)
    publishNumber(converted.value)
  }
}

// Publish text directly without applying value transitions.
function editText(event: Event) {
  beginEditing(props.sessionKey)
  emit('update:modelValue', (event.currentTarget as HTMLInputElement).value)
}
</script>

<template>
  <component :is="dataType === 'boolean' ? 'div' : 'label'" class="condition-scalar-input">
    <span v-if="!hideLabel">{{ label }}</span>
    <input
      v-if="dataType === 'text'"
      ref="textInput"
      type="text"
      :value="modelValue"
      :aria-label="label"
      @input="editText"
      @blur="finishEditing"
      @keydown.enter="handleEnter"
    />
    <input
      v-else-if="dataType === 'number'"
      ref="numberInput"
      type="number"
      step="any"
      :aria-label="label"
      @input="editNumber"
      @blur="finishEditing"
      @keydown.enter="handleEnter"
    />
    <TemporalValueInput
      v-else-if="dataType === 'date' || dataType === 'time' || dataType === 'datetime'"
      :data-type="dataType"
      :session-key="sessionKey"
      :model-value="typeof modelValue === 'string' ? modelValue : ''"
      :label="label"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <BooleanValueInput
      v-else
      :model-value="modelValue === true"
      :aria-label="label"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </component>
</template>

<style scoped>
.condition-scalar-input {
  display: grid;
  min-width: 0;
  gap: 0.35rem;
}

.condition-scalar-input > span {
  color: var(--text-input-label);
}

:deep(input) {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 0.45rem;
  border: 1px solid var(--border-control);
  border-radius: 4px;
  background: var(--surface-input);
  color: inherit;
  font: inherit;
}
</style>
