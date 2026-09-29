<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { createId } from '../utils/createId'

const props = defineProps<{
  modelValue: string
  options: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const suggestionsOpen = ref(false)
const highlightedIndex = ref(-1)
const optionsList = ref<HTMLUListElement | null>(null)
const optionsId = `field-options-${createId()}`

// Update the field and reopen suggestions when the user types.
function handleInput(event: Event) {
  suggestionsOpen.value = true
  highlightedIndex.value = -1
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

// Close suggestions and clear the previous keyboard highlight.
function closeSuggestions() {
  suggestionsOpen.value = false
  highlightedIndex.value = -1
}

// Apply a suggestion to the condition field and dismiss the dropdown.
function selectOption(option: string) {
  emit('update:modelValue', option)
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
  highlightedIndex.value = highlightedIndex.value === -1
    ? (direction === 1 ? 0 : count - 1)
    : (highlightedIndex.value + direction + count) % count

  await nextTick()
  optionsList.value?.children[highlightedIndex.value]?.scrollIntoView({ block: 'nearest' })
}

// Match suggestions without regard to case, excluding only the exact input value.
const filteredOptions = computed(() => {
  const search = props.modelValue.toLowerCase()
  return props.options.filter((option) => {
    const field = option.toLowerCase()
    return option !== props.modelValue && field.includes(search)
  })
})

// Clear the highlight whenever the matching suggestions change.
watch(filteredOptions, () => {
  highlightedIndex.value = -1
})
</script>

<template>
  <div class="field-autocomplete">
    <label class="field-input">
      <span>Field</span>
      <input
        :value="modelValue"
        type="text"
        aria-label="Field"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="suggestionsOpen && filteredOptions.length > 0"
        :aria-controls="suggestionsOpen && filteredOptions.length ? optionsId : undefined"
        :aria-activedescendant="suggestionsOpen && highlightedIndex >= 0
          ? `${optionsId}-${highlightedIndex}`
          : undefined"
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
</template>

<style scoped>
.field-autocomplete {
  position: relative;
}

.field-input {
  display: grid;
  gap: 0.35rem;
  margin-top: 1rem;
  color: #5b6472;
  font-size: 0.875rem;
}

input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.45rem;
  border: 1px solid #c5ccd8;
  border-radius: 4px;
  color: inherit;
  font: inherit;
}

.field-options {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  background: #fff;
  box-shadow: 0 4px 12px rgb(0 0 0 / 12%);
  max-height: 12rem;
  overflow-y: auto;
  margin: 0.35rem 0 0;
  padding: 0;
  list-style: none;
  border: 1px solid #c5ccd8;
  border-radius: 4px;
  color: #5b6472;
  font-size: 0.875rem;
}

.field-options li {
  padding: 0.45rem;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.field-options li:hover,
.field-options li.highlighted {
  background: #e8eef9;
  color: #1e3a5f;
}
</style>
