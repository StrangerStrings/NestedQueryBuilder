<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { convertConditionValue } from '../../utils/convertConditionValue'
import BooleanValueInput from './BooleanValueInput.vue'

const props = defineProps<{
  dataType: 'text' | 'number' | 'boolean'
  modelValue: string | number | boolean
  label: string
  hideLabel?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean]
}>()

const numberInput = ref<HTMLInputElement>()
let pendingNumber: number | undefined

// Write only external changes or committed values, preserving the browser's unfinished numeric draft.
function syncNumberInput() {
  if (numberInput.value) numberInput.value.value = String(props.modelValue)
}

onMounted(syncNumberInput)

// Ignore feedback from our own numeric edit; type changes and external values reset the draft.
watch(
  [() => props.modelValue, () => props.dataType],
  ([value, dataType], [, previousType]) => {
    const isFeedback = dataType === previousType && Object.is(value, pendingNumber)
    pendingNumber = undefined
    if (!isFeedback) syncNumberInput()
  },
  { flush: 'post' },
)

// Remember the emitted number until Vue has applied the parent's response.
function publishNumber(value: number) {
  pendingNumber = value
  emit('update:modelValue', value)
  nextTick(() => {
    if (Object.is(pendingNumber, value)) pendingNumber = undefined
  })
}

// Publish complete finite numbers without assigning to the input's visible draft.
function editNumber(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  if (!input.validity.badInput && Number.isFinite(input.valueAsNumber)) {
    publishNumber(input.valueAsNumber)
  }
}

// Resolve blank or unfinished input with the shared conversion rules on blur or Enter.
function commitNumber(event: Event) {
  const input = event.currentTarget as HTMLInputElement
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
  emit('update:modelValue', (event.currentTarget as HTMLInputElement).value)
}
</script>

<template>
  <component :is="dataType === 'boolean' ? 'div' : 'label'" class="condition-scalar-input">
    <span v-if="!hideLabel">{{ label }}</span>
    <input
      v-if="dataType === 'text'"
      type="text"
      :value="modelValue"
      :aria-label="label"
      @input="editText"
    />
    <input
      v-else-if="dataType === 'number'"
      ref="numberInput"
      type="number"
      step="any"
      :aria-label="label"
      @input="editNumber"
      @blur="commitNumber"
      @keydown.enter.prevent="commitNumber"
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
  color: #737a86;
}

input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 0.45rem;
  border: 1px solid #c5ccd8;
  border-radius: 4px;
  background: #fff;
  color: inherit;
  font: inherit;
}
</style>
