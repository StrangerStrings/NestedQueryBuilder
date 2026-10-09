<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId } from 'vue'
import { useQueryStore } from '../stores/queryStore'
import { getElasticsearchParameterNames, type ElasticsearchParameterName } from '../databases/elasticsearch/parameters'
import type { ElasticsearchConditionParameter, QueryCondition } from '../types/query'

const props = defineProps<{ condition: QueryCondition }>()
const queryStore = useQueryStore()
const editor = ref<HTMLElement | null>(null)
const addButton = ref<HTMLButtonElement | null>(null)
const editorId = useId()
const labels: Record<ElasticsearchParameterName, string> = {
  operator: 'Any/all words',
  fuzziness: 'Fuzziness',
  slop: 'Slop',
  case_insensitive: 'Case insensitive',
}

// Read the condition's stored rows, including invalid slop drafts.
const rows = computed(() => props.condition.parameters ?? [])

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

// Initialise each selected parameter with its approved starting value.
function initialParameter(name: ElasticsearchParameterName): ElasticsearchConditionParameter {
  switch (name) {
    case 'operator': return { name, value: 'or' }
    case 'fuzziness': return { name, value: 'AUTO' }
    case 'slop': return { name, value: 0 }
    case 'case_insensitive': return { name, value: false }
  }
}

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

// Append the first unused parameter through the existing condition update path.
function addParameter() {
  if (!nextParameter.value) return
  queryStore.updateCondition(props.condition.id, {
    parameters: [...rows.value, initialParameter(nextParameter.value)],
  })
}

// Opening an empty editor creates its first row without resetting configured rows.
function initialiseEditor() {
  if (rows.value.length === 0) addParameter()
}
onMounted(initialiseEditor)

// Replace one typed row without mutating other configured parameters.
function replaceParameter(index: number, parameter: ElasticsearchConditionParameter) {
  const parameters = [...rows.value]
  parameters[index] = parameter
  queryStore.updateCondition(props.condition.id, { parameters })
}

// Reset a changed selection to its initial value and guard against duplicate names.
function changeParameter(index: number, event: Event) {
  const name = (event.target as HTMLSelectElement).value as ElasticsearchParameterName
  if (availableParameters(index).includes(name)) replaceParameter(index, initialParameter(name))
}

// Store canonical match word selection values.
function updateOperator(index: number, event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'or' || value === 'and') replaceParameter(index, { name: 'operator', value })
}

// Store Auto as AUTO and the supported numeric fuzziness choices as numbers.
function updateFuzziness(index: number, event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'AUTO') replaceParameter(index, { name: 'fuzziness', value })
  else if (value === '0' || value === '1' || value === '2') {
    replaceParameter(index, { name: 'fuzziness', value: Number(value) as 0 | 1 | 2 })
  }
}

// Expose and store the Boolean state without dropping an explicit Off value.
function toggleCaseInsensitive(index: number) {
  const row = rows.value[index]
  if (row?.name === 'case_insensitive') {
    replaceParameter(index, { name: row.name, value: !row.value })
  }
}

// Treat strings and unsafe, fractional or negative numbers as invalid slop.
function isInvalidSlop(value: number | string) {
  return typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0
}

// Preserve invalid drafts and convert only complete nonnegative safe integers.
function updateSlop(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const draft = input.value
  const number = Number(draft)
  const value = /^\d+$/.test(draft) && input.validity.valid && !isInvalidSlop(number)
    ? number
    : draft
  replaceParameter(index, { name: 'slop', value })
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
  const button = event.currentTarget as HTMLButtonElement
  const hadFocus = button.parentElement?.contains(document.activeElement)
  const parameters = [...rows.value]
  parameters.splice(index, 1)
  queryStore.updateCondition(props.condition.id, { parameters })
  if (!hadFocus) return
  await nextTick()
  const selector = editor.value?.querySelector<HTMLSelectElement>(
    `[data-parameter-index="${Math.min(index, parameters.length - 1)}"]`,
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
        aria-label="Any/all words"
        @change="updateOperator(index, $event)"
      >
        <option value="or">Any</option>
        <option value="and">All</option>
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
        v-else-if="row.name === 'slop'"
        type="number"
        min="0"
        step="1"
        inputmode="numeric"
        :value="row.value"
        aria-label="Slop"
        :aria-invalid="isInvalidSlop(row.value)"
        :aria-describedby="isInvalidSlop(row.value) ? `${editorId}-${index}-error` : undefined"
        @keydown="restrictSlopKey"
        @beforeinput="restrictSlopInput"
        @paste="restrictSlopPaste"
        @input="updateSlop(index, $event)"
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
        v-if="row.name === 'slop' && isInvalidSlop(row.value)"
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
  border: 1px solid #c5ccd8;
  border-radius: 4px;
  background: #fff;
  color: #172033;
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
  outline: 2px solid #172033;
  outline-offset: 2px;
}

.case-toggle[aria-checked='true'] {
  background: #172033;
  color: #fff;
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
  border-color: #b42318;
}

.parameter-error {
  grid-column: 1 / -1;
  margin: 0;
  color: #b42318;
  overflow-wrap: anywhere;
}
</style>
