<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
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

// Read enabled editable flags without persisting local disabled row selections.
function storedRows(): RegexFlag[] {
  return flags.filter(
    // Imported Unicode support remains stored without an editable row.
    (flag) => options.value.includes(flag),
  )
}

// Opening already stores defaults in the parent action; mounting changes only local rows.
const rows = ref<RegexFlag[]>(storedRows())
if (!rows.value.length) rows.value.push('i')

// Reconcile local rows from restored flags without saving or recreating disabled selections.
watch(
  // Wait for the restored condition to reach this editor's props.
  () => queryStore.restorationRevision,
  // Disabled local selections may disappear when their stored flags are restored.
  () => {
    rows.value = storedRows()
  },
  { flush: 'post' },
)

// Offer the first flag that is not already displayed.
const nextParameter = computed(() => flags.find((flag) => !rows.value.includes(flag)))

// Store enabled flags in a stable order and retain imported u without extra UI.
function saveOptions(enabled: Set<string>) {
  const value = [...flags, 'u'].filter((flag) => enabled.has(flag)).join('')
  queryStore.updateCondition(props.condition.id, {
    parameters: rows.value.length || value ? [{ name: '$options', value }] : [],
  })
}

// Append one local disabled row and record only a genuine stored-query change.
function addParameter() {
  // Resolve available rows after finishing any pending query input.
  queryStore.runQueryAction('add regex parameter', () => {
    if (!nextParameter.value) return
    rows.value.push(nextParameter.value)
    saveOptions(new Set(options.value))
  })
}

// Keep the current selection available and prevent duplicate flag rows.
function availableParameters(index: number) {
  return flags.filter((flag) => flag === rows.value[index] || !rows.value.includes(flag))
}

// Reset a newly selected flag to No and remove the previous flag from output.
function changeParameter(index: number, event: Event) {
  const flag = (event.target as HTMLSelectElement).value as RegexFlag
  // Resolve the previous flag after pending input finishes; unchanged output retains redo.
  queryStore.runQueryAction('change regex parameter', () => {
    const previous = rows.value[index]
    if (!previous || !availableParameters(index).includes(flag)) return
    const enabled = new Set(options.value)
    enabled.delete(previous)
    rows.value[index] = flag
    saveOptions(enabled)
  })
}

// Toggle the selected flag without altering the pattern or other options.
function toggleFlag(index: number) {
  // Read current flags only after any pending query input has completed.
  queryStore.runQueryAction('toggle regex parameter', () => {
    const flag = rows.value[index]
    if (!flag) return
    const enabled = new Set(options.value)
    if (enabled.has(flag)) enabled.delete(flag)
    else enabled.add(flag)
    saveOptions(enabled)
  })
}

// Remove a flag and return keyboard focus to a remaining selector or add button.
async function removeParameter(index: number, event: Event) {
  const revision = queryStore.restorationRevision
  const button = event.currentTarget as HTMLButtonElement
  const hadFocus = button.parentElement?.contains(document.activeElement)
  // Resolve and remove the current flag in a single discrete action.
  const removed = queryStore.runQueryAction('remove regex parameter', () => {
    const flag = rows.value[index]
    if (!flag) return false
    const enabled = new Set(options.value)
    enabled.delete(flag)
    rows.value.splice(index, 1)
    saveOptions(enabled)
    return true
  })
  if (!removed || !hadFocus) return
  await nextTick()
  if (revision !== queryStore.restorationRevision) return
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
        @click="toggleFlag(index)"
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
