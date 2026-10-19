<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useQueryStore } from '../stores/queryStore'
import type { QueryCondition } from '../types/query'

const props = defineProps<{ condition: QueryCondition }>()
const queryStore = useQueryStore()
const editor = ref<HTMLElement | null>(null)
const addButton = ref<HTMLButtonElement | null>(null)
const flags = ['i', 'm', 's', 'x'] as const
type RegexFlag = (typeof flags)[number]
const labels: Record<RegexFlag, string> = {
  i: 'Case insensitive (i)',
  m: 'Multiline anchors (m)',
  s: 'Dot matches newlines (s)',
  x: 'Ignore whitespace and allow comments (x)',
}

// Read the single native options parameter, including imported Unicode support.
const options = computed(() => {
  const parameter = props.condition.parameters?.find(
    // Select MongoDB options from the database-specific parameter union.
    (parameter) => parameter.name === '$options',
  )
  return parameter?.name === '$options' ? parameter.value : ''
})

// Keep disabled row selections local while exporting only enabled native flags.
const rows = ref<RegexFlag[]>(flags.filter((flag) => options.value.includes(flag)))

// Offer the first flag that is not already displayed.
const nextParameter = computed(() => flags.find((flag) => !rows.value.includes(flag)))

// Store enabled flags in a stable order and retain imported u without extra UI.
function saveOptions(enabled: Set<string>) {
  const value = [...flags, 'u'].filter((flag) => enabled.has(flag)).join('')
  queryStore.updateCondition(props.condition.id, {
    parameters: rows.value.length || value ? [{ name: '$options', value }] : [],
  })
}

// Append one disabled row without changing existing flags.
function addParameter() {
  if (!nextParameter.value) return
  rows.value.push(nextParameter.value)
  saveOptions(new Set(options.value))
}

// Show imported flags or one initial row when opening the editor.
function initialiseEditor() {
  if (!rows.value.length) addParameter()
}
onMounted(initialiseEditor)

// Keep the current selection available and prevent duplicate flag rows.
function availableParameters(index: number) {
  return flags.filter((flag) => flag === rows.value[index] || !rows.value.includes(flag))
}

// Reset a newly selected flag to No and remove the previous flag from output.
function changeParameter(index: number, event: Event) {
  const flag = (event.target as HTMLSelectElement).value as RegexFlag
  const previous = rows.value[index]
  if (!previous || !availableParameters(index).includes(flag)) return
  const enabled = new Set(options.value)
  enabled.delete(previous)
  rows.value[index] = flag
  saveOptions(enabled)
}

// Toggle the selected flag without altering the pattern or other options.
function toggleFlag(flag: RegexFlag) {
  const enabled = new Set(options.value)
  if (enabled.has(flag)) enabled.delete(flag)
  else enabled.add(flag)
  saveOptions(enabled)
}

// Remove a flag and return keyboard focus to a remaining selector or add button.
async function removeParameter(index: number, event: Event) {
  const button = event.currentTarget as HTMLButtonElement
  const hadFocus = button.parentElement?.contains(document.activeElement)
  const flag = rows.value[index]
  if (!flag) return
  const enabled = new Set(options.value)
  enabled.delete(flag)
  rows.value.splice(index, 1)
  saveOptions(enabled)
  if (!hadFocus) return
  await nextTick()
  const selector = editor.value?.querySelector<HTMLSelectElement>(
    `[data-parameter-index="${Math.min(index, rows.value.length - 1)}"]`,
  )
  const focusTarget = selector ?? addButton.value
  focusTarget?.focus()
}
</script>

<template>
  <div ref="editor" class="parameter-editor" role="group" aria-label="MongoDB regular expression options">
    <div v-for="(flag, index) in rows" :key="index" class="parameter-row">
      <select
        :value="flag"
        :aria-label="`Parameter ${index + 1}`"
        :data-parameter-index="index"
        @change="changeParameter(index, $event)"
      >
        <option v-for="name in availableParameters(index)" :key="name" :value="name">
          {{ labels[name] }}
        </option>
      </select>
      <button
        type="button"
        role="switch"
        :aria-label="labels[flag]"
        :aria-checked="options.includes(flag)"
        class="case-toggle"
        @click="toggleFlag(flag)"
      >
        {{ options.includes(flag) ? 'Yes' : 'No' }}
      </button>
      <button
        type="button"
        :aria-label="`Remove ${labels[flag]} parameter`"
        class="icon-button"
        @click="removeParameter(index, $event)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">remove</span>
      </button>
    </div>
    <button
      ref="addButton"
      type="button"
      class="icon-button add-button"
      aria-label="Add optional parameter"
      :disabled="!nextParameter"
      @click="addParameter"
    >
      <span class="material-symbols-outlined" aria-hidden="true">add</span>
    </button>
  </div>
</template>

<style scoped>
.parameter-editor {
  display: grid;
  gap: 0.6rem;
  margin-top: 0.75rem;
  min-width: 0;
  font-size: 0.8125rem;
}

.parameter-row {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.4rem;
}

select,
button {
  box-sizing: border-box;
  min-width: 0;
  padding: 0.45rem;
  border: 1px solid var(--border-control);
  border-radius: 4px;
  background: var(--surface-input);
  color: var(--text-primary);
  font: inherit;
}

select {
  width: 100%;
}

button {
  cursor: pointer;
}

select:focus-visible,
button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.case-toggle[aria-checked='true'] {
  background: var(--surface-control-strong-selected);
  color: var(--text-control-strong-selected);
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-button .material-symbols-outlined {
  font-size: 1.125rem;
}

.add-button {
  justify-self: start;
}

button:disabled {
  opacity: 0.5;
  cursor: default;
}

</style>
