<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useQueryStore } from '../stores/queryStore'
import { useQueryInputSession } from '../composables/useQueryInputSession'
import { getElasticsearchParameterNames, initialParameter, type ElasticsearchParameterName } from '../databases/elasticsearch/parameters'
import type { ElasticsearchConditionParameter, QueryCondition } from '../types/query'

const props = defineProps<{ condition: QueryCondition }>()
const queryStore = useQueryStore()
const editor = ref<HTMLElement | null>(null)
const addButton = ref<HTMLButtonElement | null>(null)
const editorId = useId()
const { beginEditing, finishEditing } = useQueryInputSession('edit optional parameter')
const labels: Record<ElasticsearchParameterName, string> = {
  operator: 'Operator',
  fuzziness: 'Fuzziness',
  slop: 'Slop',
  minimum_should_match: 'Minimum words matched',
  case_insensitive: 'Case insensitive',
}

// Read only Elasticsearch rows, including invalid integer drafts.
const rows = computed(() => (props.condition.parameters ?? []).filter(
  // Keep MongoDB's native regex parameter outside the Elasticsearch editor.
  (parameter): parameter is ElasticsearchConditionParameter => parameter.name !== '$options',
))

// Preserve the catalogue's supported parameter order.
const supported = computed(() => getElasticsearchParameterNames(props.condition.operatorId))

// Find the first unused parameter for expansion and addition.
const nextParameter = computed(() => supported.value.find(
  // Exclude names already configured, including false and zero values.
  (name) => !rows.value.some(
    // Compare parameter names independently of their values.
    (row) => row.name === name,
  ),
))

// Keep a row's own selection available while excluding duplicates elsewhere.
function availableParameters(index: number) {
  return supported.value.filter(
    // Include the current name or a name absent from all other rows.
    (name) => name === rows.value[index]?.name || !rows.value.some(
      // Compare configured names rather than parameter values.
      (row) => row.name === name,
    ),
  )
}

// Append the first unused parameter as one discrete query action.
function addParameter() {
  // Resolve available names after any pending input has finished.
  queryStore.runQueryAction('add optional parameter', () => {
    if (!nextParameter.value) return
    queryStore.updateCondition(props.condition.id, {
      parameters: [...rows.value, initialParameter(nextParameter.value)],
    })
  })
}

// End single-line edits without intercepting IME composition.
function handleEnter(event: KeyboardEvent) {
  if (event.isComposing) return
  event.preventDefault()
  finishEditing()
}

// Reset browser-only numeric drafts after Vue receives the restored condition.
function syncIntegerInputs() {
  editor.value?.querySelectorAll<HTMLInputElement>('input[data-parameter-index]').forEach(
    // Assign even unchanged stored values to discard unfinished browser input.
    (input) => {
      const row = rows.value[Number(input.dataset.parameterIndex)]
      if (row?.name === 'slop' || row?.name === 'minimum_should_match') {
        input.value = String(row.value)
      }
    },
  )
}

// Read restored props after rendering, including equal-valued browser drafts.
watch(() => queryStore.restorationRevision, syncIntegerInputs, { flush: 'post' })

// Replace one typed row without mutating other configured parameters.
function replaceParameter(index: number, parameter: ElasticsearchConditionParameter) {
  const parameters = [...rows.value]
  parameters[index] = parameter
  queryStore.updateCondition(props.condition.id, { parameters })
}

// Reset a changed selection to its initial value and guard against duplicate names.
function changeParameter(index: number, event: Event) {
  const name = (event.target as HTMLSelectElement).value as ElasticsearchParameterName
  // Check the current row and allowed names after pending input completes.
  queryStore.runQueryAction('change optional parameter', () => {
    if (rows.value[index] && availableParameters(index).includes(name)) {
      replaceParameter(index, initialParameter(name))
    }
  })
}

// Store canonical match word selection values.
function updateOperator(index: number, event: Event) {
  const value = (event.target as HTMLSelectElement).value
  // Keep selection changes separate from a preceding integer edit.
  queryStore.runQueryAction('change optional parameter value', () => {
    if (rows.value[index]?.name === 'operator' && (value === 'or' || value === 'and')) {
      replaceParameter(index, { name: 'operator', value })
    }
  })
}

// Store Auto as AUTO and the supported numeric fuzziness choices as numbers.
function updateFuzziness(index: number, event: Event) {
  const value = (event.target as HTMLSelectElement).value
  // Resolve the current row after finishing any active input session.
  queryStore.runQueryAction('change optional parameter value', () => {
    if (rows.value[index]?.name !== 'fuzziness') return
    if (value === 'AUTO') replaceParameter(index, { name: 'fuzziness', value })
    else if (value === '0' || value === '1' || value === '2') {
      replaceParameter(index, { name: 'fuzziness', value: Number(value) as 0 | 1 | 2 })
    }
  })
}

// Expose and store the Boolean state without dropping an explicit Off value.
function toggleCaseInsensitive(index: number) {
  // Read the saved Boolean only once pending input has completed.
  queryStore.runQueryAction('toggle case insensitive parameter', () => {
    const row = rows.value[index]
    if (row?.name === 'case_insensitive') {
      replaceParameter(index, { name: row.name, value: !row.value })
    }
  })
}

// Treat strings and unsafe, fractional or negative numbers as invalid integer parameters.
function isInvalidInteger(value: number | string) {
  return typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0
}

// Preserve integer parameter drafts and convert only complete nonnegative safe integers.
function updateIntegerParameter(index: number, event: Event) {
  const row = rows.value[index]
  if (row?.name !== 'slop' && row?.name !== 'minimum_should_match') return
  beginEditing(`${props.condition.id}:parameter:${row.name}`)
  const input = event.target as HTMLInputElement
  const draft = input.value
  const number = Number(draft)
  const value = /^\d+$/.test(draft) && input.validity.valid && !isInvalidInteger(number)
    ? number
    : draft
  replaceParameter(index, { name: row.name, value })
}

// Allow native navigation and shortcuts while preventing non-integer typing.
function restrictSlopKey(event: KeyboardEvent) {
  if (!event.ctrlKey && !event.metaKey && event.key.length === 1 && !/^\d$/.test(event.key)) {
    event.preventDefault()
  }
}

// Prevent letters and other non-integer characters from text insertion.
function restrictSlopInput(event: Event) {
  const data = (event as InputEvent).data
  if (data && /\D/.test(data)) event.preventDefault()
}

// Apply the same digit restriction to pasted text.
function restrictSlopPaste(event: ClipboardEvent) {
  if (/\D/.test(event.clipboardData?.getData('text') ?? '')) event.preventDefault()
}

// Remove a row and move its focus to a surviving selector or the add button.
async function removeParameter(index: number, event: Event) {
  const revision = queryStore.restorationRevision
  const button = event.currentTarget as HTMLButtonElement
  const hadFocus = button.parentElement?.contains(document.activeElement)
  // Remove the current row after completing any live input session.
  const count = queryStore.runQueryAction('remove optional parameter', () => {
    const parameters = [...rows.value]
    parameters.splice(index, 1)
    queryStore.updateCondition(props.condition.id, { parameters })
    return parameters.length
  })
  if (!hadFocus) return
  await nextTick()
  if (revision !== queryStore.restorationRevision) return
  const selector = editor.value?.querySelector<HTMLSelectElement>(
    `select[data-parameter-index="${Math.min(index, count - 1)}"]`,
  )
  const focusTarget = selector ?? addButton.value
  focusTarget?.focus()
}
</script>

<template>
  <div ref="editor" class="parameter-editor" role="group" aria-label="Optional parameter rows">
    <div v-for="(row, index) in rows" :key="index" class="parameter-row">
      <select
        :value="row.name"
        :aria-label="`Parameter ${index + 1}`"
        :data-parameter-index="index"
        @change="changeParameter(index, $event)"
      >
        <option v-for="name in availableParameters(index)" :key="name" :value="name">
          {{ labels[name] }}
        </option>
      </select>
      <select
        v-if="row.name === 'operator'"
        :value="row.value"
        aria-label="Operator"
        @change="updateOperator(index, $event)"
      >
        <option value="or">OR</option>
        <option value="and">AND</option>
      </select>
      <select
        v-else-if="row.name === 'fuzziness'"
        :value="row.value"
        aria-label="Fuzziness"
        @change="updateFuzziness(index, $event)"
      >
        <option value="AUTO">Auto</option>
        <option value="0">0</option>
        <option value="1">1</option>
        <option value="2">2</option>
      </select>
      <input
        v-else-if="row.name === 'slop' || row.name === 'minimum_should_match'"
        type="number"
        min="0"
        step="1"
        inputmode="numeric"
        :value="row.value"
        :data-parameter-index="index"
        :aria-label="labels[row.name]"
        :aria-invalid="isInvalidInteger(row.value)"
        :aria-describedby="[row.name === 'minimum_should_match' ? `${editorId}-${index}-help` : '', isInvalidInteger(row.value) ? `${editorId}-${index}-error` : ''].filter(Boolean).join(' ') || undefined"
        @keydown="row.name === 'slop' && restrictSlopKey($event)"
        @beforeinput="row.name === 'slop' && restrictSlopInput($event)"
        @paste="row.name === 'slop' && restrictSlopPaste($event)"
        @input="updateIntegerParameter(index, $event)"
        @blur="finishEditing"
        @keydown.enter="handleEnter"
      />
      <button
        v-else-if="row.name === 'case_insensitive'"
        type="button"
        role="switch"
        aria-label="Case insensitive"
        :aria-checked="row.value"
        class="case-toggle"
        @click="toggleCaseInsensitive(index)"
      >
        {{ row.value ? 'On' : 'Off' }}
      </button>
      <button
        type="button"
        :aria-label="`Remove ${labels[row.name]} parameter`"
        class="icon-button"
        @click="removeParameter(index, $event)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">remove</span>
      </button>
      <p
        v-if="row.name === 'minimum_should_match'"
        :id="`${editorId}-${index}-help`"
        class="parameter-help"
      >
        Intended for Operator: OR (optional parameter). AND still requires every term.
      </p>
      <p
        v-if="(row.name === 'slop' || row.name === 'minimum_should_match') && isInvalidInteger(row.value)"
        :id="`${editorId}-${index}-error`"
        class="parameter-error"
        role="status"
      >
        Enter a nonnegative safe integer. Output is blocked until corrected or removed.
      </p>
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
input,
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

select,
input {
  width: 100%;
}

button {
  cursor: pointer;
}

select:focus-visible,
input:focus-visible,
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

input[aria-invalid='true'] {
  border-color: var(--border-error);
}

.parameter-help {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--text-control-muted);
}

.parameter-error {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--text-error);
  overflow-wrap: anywhere;
}
</style>
