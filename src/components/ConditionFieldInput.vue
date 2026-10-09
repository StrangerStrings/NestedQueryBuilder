<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { createId } from '../utils/createId'
import type { ConditionField, FieldModifier } from '../types/query'

const props = defineProps<{
  modelValue: ConditionField
  options: string[]
  label?: string
  hideLabel?: boolean
  hideModifiers?: boolean
  modifiers?: readonly FieldModifier[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ConditionField]
}>()

const suggestionsOpen = ref(false)
const highlightedIndex = ref(-1)
const optionsList = ref<HTMLUListElement | null>(null)
const optionsId = `field-options-${createId()}`

const modifierControlsVisible = ref(props.modelValue.modifier !== null)
const modifierId = `field-modifier-${createId()}`
// Use only the modifier capabilities supplied by the active adapter.
const fieldModifiers = computed(() => props.modifiers ?? [])

// Reveal modifiers applied by import; the parent's condition key resets visibility on selection.
watch(() => props.modelValue.modifier, (modifier) => {
  if (modifier !== null) modifierControlsVisible.value = true
})

// Hide and clear the modifier together; reopening starts with No Modifier.
function toggleModifierControls() {
  modifierControlsVisible.value = !modifierControlsVisible.value
  if (!modifierControlsVisible.value) {
    emit('update:modelValue', { ...props.modelValue, modifier: null })
  }
}

// Apply one allowed modifier while preserving the underlying field name.
function changeFieldModifier(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  const modifier = fieldModifiers.value.find((option) => option === value) ?? null
  emit('update:modelValue', { ...props.modelValue, modifier })
}

// Update the field name without changing its modifier and reopen suggestions.
function handleInput(event: Event) {
  suggestionsOpen.value = true
  highlightedIndex.value = -1
  emit('update:modelValue', {
    ...props.modelValue,
    name: (event.target as HTMLInputElement).value,
  })
}

// Close suggestions and clear the previous keyboard highlight.
function closeSuggestions() {
  suggestionsOpen.value = false
  highlightedIndex.value = -1
}

// Apply a field-name suggestion without changing its modifier and dismiss the dropdown.
function selectOption(option: string) {
  emit('update:modelValue', { ...props.modelValue, name: option })
  closeSuggestions()
}

// Select the highlighted suggestion with Enter when not composing text.
function handleEnter(event: KeyboardEvent) {
  if (event.isComposing || !suggestionsOpen.value) return

  const option = filteredOptions.value[highlightedIndex.value]
  if (option === undefined) return

  event.preventDefault()
  selectOption(option)
}

// Move the keyboard highlight through suggestions and keep it in view.
async function moveHighlight(direction: 1 | -1) {
  const count = filteredOptions.value.length
  if (!count) return

  suggestionsOpen.value = true
  highlightedIndex.value =
    highlightedIndex.value === -1
      ? direction === 1
        ? 0
        : count - 1
      : (highlightedIndex.value + direction + count) % count

  await nextTick()
  optionsList.value?.children[highlightedIndex.value]?.scrollIntoView({ block: 'nearest' })
}

// Match suggestions without regard to case, excluding only the exact input value.
const filteredOptions = computed(() => {
  const search = props.modelValue.name.toLowerCase()
  return props.options.filter((option) => {
    const field = option.toLowerCase()
    return option !== props.modelValue.name && field.includes(search)
  })
})

// Clear the highlight whenever the matching suggestions change.
watch(filteredOptions, () => {
  highlightedIndex.value = -1
})
</script>

<template>
  <div class="condition-field-input">
    <div class="field-input-row">
      <div class="field-autocomplete">
        <label class="field-input">
          <span v-if="!hideLabel">{{ label ?? 'Field' }}</span>
          <input
            :value="modelValue.name"
            type="text"
            :aria-label="label ?? 'Field'"
            role="combobox"
            aria-autocomplete="list"
            :aria-expanded="suggestionsOpen && filteredOptions.length > 0"
            :aria-controls="suggestionsOpen && filteredOptions.length ? optionsId : undefined"
            :aria-activedescendant="
              suggestionsOpen && highlightedIndex >= 0 ? `${optionsId}-${highlightedIndex}` : undefined
            "
            @focus="suggestionsOpen = true"
            @input="handleInput"
            @blur="closeSuggestions"
            @keydown.esc="closeSuggestions"
            @keydown.down.prevent="moveHighlight(1)"
            @keydown.up.prevent="moveHighlight(-1)"
            @keydown.enter="handleEnter"
          />
        </label>
        <ul
          v-if="suggestionsOpen && filteredOptions.length"
          :id="optionsId"
          ref="optionsList"
          role="listbox"
          class="field-options"
          aria-label="Matching fields"
        >
          <li
            v-for="(option, index) in filteredOptions"
            :id="`${optionsId}-${index}`"
            :key="option"
            role="option"
            :aria-selected="index === highlightedIndex"
            :class="{ highlighted: index === highlightedIndex }"
            @mousedown.prevent
            @click="selectOption(option)"
          >
            {{ option }}
          </li>
        </ul>
      </div>
      <button
        v-if="!hideModifiers && fieldModifiers.length"
        type="button"
        class="field-modifier-toggle"
        :class="{ 'has-modifier': modifierControlsVisible || modelValue.modifier !== null }"
        aria-label="Field modifier"
        title="Field modifier"
        :aria-expanded="modifierControlsVisible"
        :aria-controls="modifierId"
        @click="toggleModifierControls"
      >
        <span class="material-symbols-outlined" aria-hidden="true">functions</span>
      </button>
    </div>
    <label v-if="!hideModifiers && fieldModifiers.length" v-show="modifierControlsVisible" class="field-modifier-input">
      <select
        :id="modifierId"
        :value="modelValue.modifier ?? ''"
        aria-label="Field modifier"
        @change="changeFieldModifier"
      >
        <option value="">No Modifier</option>
        <option v-for="modifier in fieldModifiers" :key="modifier" :value="modifier">
          {{ modifier }}
        </option>
      </select>
    </label>
  </div>
</template>

<style scoped>
.condition-field-input {
  margin-top: 0.5rem;
}

.field-input-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.field-modifier-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-control);
  color: var(--text-primary);
  font: inherit;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0.45rem;
  border: 0;
  border-radius: 4px;
}

.field-modifier-toggle:hover {
  background: var(--surface-control-hover);
}

.field-modifier-toggle.has-modifier {
  background: var(--surface-control-selected);
}

.field-modifier-toggle:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.field-modifier-input {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.75rem;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.field-modifier-input select {
  min-width: 0;
  width: 100%;
  padding: 0.45rem;
  border: 1px solid var(--border-control);
  border-radius: 4px;
  background: var(--surface-input);
  color: inherit;
  font: inherit;
}

.field-modifier-toggle .material-symbols-outlined {
  font-size: 1.25rem;
}

.field-autocomplete {
  position: relative;
  flex: 1;
  min-width: 0;
}

.field-input {
  display: grid;
  gap: 0.5rem;
  color: var(--text-primary);
  font-size: 0.875rem;
}

input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.45rem;
  border: 1px solid var(--border-control);
  border-radius: 4px;
  background: var(--surface-input);
  color: inherit;
  font: inherit;
}

.field-options {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  background: var(--surface-menu);
  box-shadow: 0 4px 12px var(--shadow-menu);
  max-height: 12rem;
  overflow-y: auto;
  margin: 0.35rem 0 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border-control);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.field-options li {
  padding: 0.45rem;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.field-options li:hover,
.field-options li.highlighted {
  background: var(--surface-suggestion-highlight);
  color: var(--text-primary);
}
</style>
