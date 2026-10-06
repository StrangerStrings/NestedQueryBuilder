<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import type { DatabaseOperator, ValueDataType } from '../../types/databaseOperator'
import type { ConditionValue } from '../../types/query'
import ConditionScalarInput from './ConditionScalarInput.vue'
import ConditionListInput from './ConditionListInput.vue'
import ConditionFieldInput from '../ConditionFieldInput.vue'

const props = defineProps<{
  operator: DatabaseOperator
  modelValue: ConditionValue
  fieldOptions: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ConditionValue]
  'type-change': [dataType: ValueDataType]
}>()

const typeLabels = { text: 'Text', number: 'Number', boolean: 'Boolean', field: 'Field' }
const temporalOptions = [
  { type: 'date', label: 'Date', icon: 'calendar_month' },
  { type: 'time', label: 'Time', icon: 'schedule' },
  { type: 'datetime', label: 'Date & time', icon: 'calendar_clock' },
] as const
const temporalOpen = ref(false)
const temporalWrapper = ref<HTMLElement | null>(null)
const temporalTrigger = ref<HTMLButtonElement | null>(null)
const temporalMenu = ref<HTMLElement | null>(null)
const temporalMenuId = useId()

const typeIcons = { text: 'text_fields', number: '123', boolean: 'check_circle', field: 'view_column' }

// Include field references alongside the operator's supported literal controls.
const supportedTypes = computed(() => {
  const input = props.operator.valueInput
  return input.hasValue
    ? input.dataTypes.filter((type) => type === 'text' || type === 'number' || type === 'boolean' || type === 'field')
    : []
})

// Show only temporal options allowed by the current operator.
const temporalTypes = computed(() => {
  const input = props.operator.valueInput
  return input.hasValue
    ? temporalOptions.filter((option) => input.dataTypes.includes(option.type))
    : []
})

// Resolve the selected temporal icon and label independently of the value editor.
const selectedTemporal = computed(() =>
  temporalTypes.value.find((option) =>
    props.modelValue.hasValue && props.modelValue.dataType === option.type,
  ),
)

// Keep the toolbar available for supported values matching the operator's shape.
const selectedValue = computed(() => {
  const value = props.modelValue
  const input = props.operator.valueInput
  if (
    !input.hasValue ||
    !value.hasValue ||
    value.dataShape !== input.dataShape ||
    !input.dataTypes.includes(value.dataType) ||
    value.dataType === 'duration'
  ) {
    return undefined
  }
  return value
})

// Dismiss the menu and optionally return keyboard focus to its trigger.
function closeTemporal(restoreFocus = false) {
  temporalOpen.value = false
  if (restoreFocus) temporalTrigger.value?.focus()
}

// Open the menu and focus its selected option, or the requested boundary option.
async function openTemporal(boundary?: 'first' | 'last') {
  temporalOpen.value = true
  await nextTick()
  const buttons = temporalMenu.value?.querySelectorAll<HTMLButtonElement>('button')
  if (!buttons?.length) return
  const selected = temporalTypes.value.findIndex((option) => option === selectedTemporal.value)
  const index = boundary === 'last' ? buttons.length - 1 : boundary === 'first' ? 0 : Math.max(0, selected)
  buttons[index]?.focus()
}

// Toggle the dropdown without requesting any type change.
function toggleTemporal() {
  if (temporalOpen.value) closeTemporal()
  else void openTemporal()
}

// Move focus through menu options; native buttons handle Enter and Space selection.
function handleTemporalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeTemporal(true)
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  if (!temporalOpen.value) {
    void openTemporal(event.key === 'ArrowUp' || event.key === 'End' ? 'last' : 'first')
    return
  }
  const buttons = Array.from(temporalMenu.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])
  const current = buttons.findIndex((button) => button === document.activeElement)
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
    (current + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length
  buttons[index]?.focus()
}

// Dismiss outside pointer interactions without stealing focus from their destination.
function handleOutsidePointer(event: PointerEvent) {
  if (event.target instanceof Node && !temporalWrapper.value?.contains(event.target)) closeTemporal()
}

// Close when Tab or another focus change leaves the dropdown.
function handleTemporalFocusout(event: FocusEvent) {
  if (!(event.relatedTarget instanceof Node) || !temporalWrapper.value?.contains(event.relatedTarget)) {
    closeTemporal()
  }
}

// Attach outside-click dismissal only while this component is mounted.
onMounted(() => document.addEventListener('pointerdown', handleOutsidePointer))
// Release the document listener when the condition editor is removed.
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleOutsidePointer))
// Close stale menus whenever operator metadata or the selected type changes.
watch([temporalTypes, () => props.modelValue.hasValue ? props.modelValue.dataType : undefined], () => {
  closeTemporal(temporalOpen.value && !!temporalWrapper.value?.contains(document.activeElement))
})

// Request a supported type change; the parent performs the transition through the store.
function changeType(selected: ValueDataType) {
  const allowed = supportedTypes.value.some((type) => type === selected) ||
    temporalTypes.value.some((option) => option.type === selected)
  if (!allowed) return
  emit('type-change', selected)
  if (temporalOpen.value) closeTemporal(true)
}

// Edit field names, literal values, or range endpoints; the list editor owns list edits.
function editValue(value: string | number | boolean, endpoint: 0 | 1 = 0) {
  const current = selectedValue.value
  if (!current || current.dataShape === 'list') return

  if (
    (current.dataType === 'field' || current.dataType === 'text' || current.dataType === 'date' ||
      current.dataType === 'time' || current.dataType === 'datetime') &&
    typeof value === 'string'
  ) {
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
  <div v-if="selectedValue" class="condition-value-input">
    <h4 class="value-heading">Value</h4>
    <div
      v-if="supportedTypes.length || temporalTypes.length"
      class="value-types"
      role="group"
      aria-label="Value type"
    >
      <button
        v-for="dataType in supportedTypes"
        :key="dataType"
        type="button"
        :aria-label="typeLabels[dataType]"
        :title="typeLabels[dataType]"
        :aria-pressed="selectedValue.dataType === dataType"
        @click="changeType(dataType)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">{{ typeIcons[dataType] }}</span>
      </button>
      <div
        v-if="temporalTypes.length"
        ref="temporalWrapper"
        class="temporal-dropdown"
        @keydown="handleTemporalKeydown"
        @focusout="handleTemporalFocusout"
      >
        <button
          ref="temporalTrigger"
          type="button"
          :aria-label="selectedTemporal?.label ?? 'Date and time types'"
          :title="selectedTemporal?.label ?? 'Date and time types'"
          aria-haspopup="menu"
          :aria-expanded="temporalOpen"
          :aria-controls="temporalOpen ? temporalMenuId : undefined"
          :class="{ 'temporal-selected': selectedTemporal }"
          @click="toggleTemporal"
        >
          <span class="material-symbols-outlined" aria-hidden="true">{{ selectedTemporal?.icon ?? 'calendar_clock' }}</span>
          <span class="material-symbols-outlined dropdown-arrow" aria-hidden="true">expand_more</span>
        </button>
        <div
          v-if="temporalOpen"
          :id="temporalMenuId"
          ref="temporalMenu"
          class="temporal-menu"
          role="menu"
          aria-label="Date and time types"
        >
          <button
            v-for="option in temporalTypes"
            :key="option.type"
            type="button"
            role="menuitemradio"
            :aria-checked="selectedTemporal?.type === option.type"
            tabindex="-1"
            @click="changeType(option.type)"
          >
            <span class="material-symbols-outlined" aria-hidden="true">{{ option.icon }}</span>
            {{ option.label }}
          </button>
        </div>
      </div>
    </div>
    <ConditionFieldInput
      v-if="selectedValue.dataType === 'field' && selectedValue.dataShape === 'single'"
      class="field-value-input"
      :model-value="{ name: selectedValue.value, modifier: null }"
      :options="fieldOptions"
      label="Field value"
      hide-label
      hide-modifiers
      @update:model-value="editValue($event.name)"
    />
    <ConditionScalarInput
      v-else-if="selectedValue.dataType !== 'field' && selectedValue.dataShape === 'single'"
      :key="`${selectedValue.dataType}-single`"
      :data-type="selectedValue.dataType"
      :model-value="selectedValue.value"
      label="Value"
      hide-label
      @update:model-value="editValue($event)"
    />
    <div
      v-else-if="selectedValue.dataType !== 'field' && selectedValue.dataShape === 'range'"
      :key="`${selectedValue.dataType}-range`"
      class="value-range"
    >
      <ConditionScalarInput
        :data-type="selectedValue.dataType"
        :model-value="selectedValue.value[0]"
        label="From"
        @update:model-value="editValue($event, 0)"
      />
      <ConditionScalarInput
        :data-type="selectedValue.dataType"
        :model-value="selectedValue.value[1]"
        label="To"
        @update:model-value="editValue($event, 1)"
      />
    </div>
    <ConditionListInput
      v-else-if="selectedValue.dataType !== 'field'"
      :key="`${selectedValue.dataType}-list`"
      :model-value="selectedValue"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>

<style scoped>
.condition-value-input {
  display: grid;
  gap: 0.5rem;
  margin-top: 2rem;
  color: #172033;
  font-size: 0.875rem;
}

.value-heading {
  margin: 0;
  font-size: inherit;
  font-weight: normal;
}

.field-value-input {
  margin-top: 0;
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
  background: #e8eef9;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

button:hover {
  background: #f3f6fa;
}

button[aria-pressed='true'],
button.temporal-selected,
button[aria-checked='true'] {
  background: #fff;
}

button:focus-visible {
  outline: 2px solid #172033;
  outline-offset: 2px;
}

button .material-symbols-outlined {
  font-size: 1.25rem;
}

.temporal-dropdown {
  position: relative;
}

button .dropdown-arrow {
  font-size: 1rem;
}

.temporal-menu {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  z-index: 20;
  min-width: 10rem;
  padding: 0.25rem;
  border: 1px solid #c5ccd8;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 4px 12px rgb(0 0 0 / 12%);
}

.temporal-menu button {
  width: 100%;
  justify-content: flex-start;
  gap: 0.5rem;
  white-space: nowrap;
}
</style>
