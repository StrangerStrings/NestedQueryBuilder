<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import ConditionFieldInput from './ConditionFieldInput.vue'
import ConditionOperatorInput from './ConditionOperatorInput.vue'
import ConditionValueInput from './ConditionValueInput/ConditionValueInput.vue'
import ElasticsearchParameterEditor from './ElasticsearchParameterEditor.vue'
import QueryDisplay from './QueryDisplay.vue'
import { useQueryStore } from '../stores/queryStore'
import type { QueryCondition } from '../types/query'
import { rawConditionColour } from '../colours/palette'
import { getElasticsearchParameterNames } from '../databases/elasticsearch/parameters'

const queryStore = useQueryStore()
const rawConditionId = useId()
const editorError = ref<string | null>(null)
const parameterEditorId = useId()
const parametersExpanded = ref(false)

const props = defineProps<{
  condition: QueryCondition
}>()

// Describe condition output using adapter metadata, retaining SQL wording for existing modes.
const outputLabel = computed(() => queryStore.adapter.presentation?.outputLabel ?? 'SQL')

// Derive the active mode directly from the condition's representation.
const editingMode = computed(() => props.condition.rawSql === undefined ? 'editor' : 'raw')

// Resolve the selected operator metadata for the current condition.
const selectedOperator = computed(() =>
  queryStore.operators.find((operator) => operator.id === props.condition.operatorId),
)

// Offer parameters only for supported Elasticsearch operators.
const supportsParameters = computed(() =>
  queryStore.database === 'elasticsearch' &&
  getElasticsearchParameterNames(props.condition.operatorId).length > 0,
)

// Reopen configured conditions without changing their stored rows.
watch(
  // Track selection, operator transitions and database changes.
  () => [props.condition.id, props.condition.operatorId, queryStore.database],
  // Reflect the parameters retained by the store after a transition.
  () => {
    parametersExpanded.value = supportsParameters.value && !!props.condition.parameters?.length
  },
  { immediate: true },
)

// Expand for parameters imported into the currently selected condition.
watch(
  // Observe configured rows without treating their values as Boolean flags.
  () => props.condition.parameters?.length ?? 0,
  // Keep an empty editor open after removing its last row.
  (count) => {
    if (count > 0 && supportsParameters.value) parametersExpanded.value = true
  },
)

// Clear stored parameters only when the user explicitly collapses the editor.
function toggleParameters() {
  if (parametersExpanded.value) {
    queryStore.updateCondition(props.condition.id, { parameters: [] })
  }
  parametersExpanded.value = !parametersExpanded.value
}

// Generate the selected condition's standalone clause directly with adapter validation.
const conditionSql = computed(() => {
  return queryStore.adapter.generateConditionSql(props.condition)
})

// Display validation for the current raw condition.
const rawError = computed(() => {
  const sql = conditionSql.value
  return props.condition.rawSql !== undefined && !sql.success ? sql.error : null
})

// Show generation or editor-conversion errors beneath the current query.
const previewError = computed(() => {
  const sql = conditionSql.value
  return !sql.success ? sql.error : editorError.value
})

// Clear conversion feedback when another condition is selected.
watch(
  // Observe selection changes independently of typing.
  () => props.condition.id,
  // Keep errors associated with the condition that produced them.
  () => {
    editorError.value = null
  },
)

// Initialise the raw condition directly from its current generated SQL.
function openRawEditor() {
  if (!queryStore.adapter.parseRawCondition || editingMode.value === 'raw') return
  const sql = conditionSql.value
  queryStore.updateCondition(props.condition.id, { rawSql: sql.success ? sql.sql : '' })
  editorError.value = null
}

// Write each keystroke directly to the condition, including incomplete or invalid SQL.
function updateRawInput(event: Event) {
  if (!queryStore.adapter.parseRawCondition) return
  queryStore.updateCondition(props.condition.id, {
    rawSql: (event.target as HTMLTextAreaElement).value,
  })
  editorError.value = null
}

// Switch to the visual editor when the current raw expression can be represented there.
function openVisualEditor() {
  if (!queryStore.adapter.parseRawCondition || editingMode.value === 'editor') return
  editorError.value = queryStore.editRawCondition(props.condition.id)
}

// Match the condition's border, using dedicated purple styling for Raw mode.
const borderColour = computed(() =>
  props.condition.rawSql !== undefined
    ? rawConditionColour.accent
    : !props.condition.field.name.trim() || !selectedOperator.value
      ? '#9ca3af'
      : queryStore.getConditionColour(props.condition)?.accent ?? '#94a3b8',
)

// Use a lighter condition background tint without fading the panel's contents.
const backgroundColour = computed(() => {
  const colour =
    props.condition.rawSql !== undefined
      ? rawConditionColour.background
      : !props.condition.field.name.trim() || !selectedOperator.value
        ? '#f3f4f6'
        : queryStore.getConditionColour(props.condition)?.background ?? '#f8fafc'
  return `color-mix(in srgb, ${colour} 25%, transparent)`
})

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <aside
    class="condition-panel"
    :style="{ borderColor: borderColour, backgroundColor: backgroundColour }"
    aria-label="Condition details"
  >
    <div class="panel-header">
      <div class="editing-mode" role="group" aria-label="Condition editing mode">
        <button
          type="button"
          :aria-pressed="editingMode === 'editor'"
          @click="openVisualEditor"
        >
          Editor
        </button>
        <button
          v-if="queryStore.adapter.parseRawCondition"
          type="button"
          :aria-pressed="editingMode === 'raw'"
          @click="openRawEditor"
        >
          Raw
        </button>
      </div>
      <button
        class="panel-close"
        type="button"
        aria-label="Close condition details"
        @click="emit('close')"
      >
        <span class="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
    </div>
    <div v-if="queryStore.adapter.parseRawCondition && editingMode === 'raw'" class="raw-condition-input">
      <label :for="rawConditionId">Raw condition</label>
      <textarea
        :id="rawConditionId"
        :value="condition.rawSql"
        @input="updateRawInput"
        rows="6"
        placeholder="status = 'online'"
        :spellcheck="false"
        :aria-invalid="!!rawError"
        :aria-describedby="previewError ? `${rawConditionId}-error` : undefined"
      />
    </div>
    <template v-else>
      <ConditionFieldInput
        :key="condition.id"
        :model-value="condition.field"
        :options="queryStore.uniqueFields"
        :modifiers="queryStore.adapter.fieldModifiers"
        @update:model-value="queryStore.updateCondition(condition.id, { field: $event })"
      />
      <ConditionOperatorInput
        :model-value="condition.operatorId"
        :options="queryStore.operators"
        @update:model-value="queryStore.updateCondition(condition.id, { operatorId: $event })"
      />
      <ConditionValueInput
        :field-options="queryStore.uniqueFields"
        v-if="selectedOperator"
        :key="condition.id"
        :model-value="condition.value"
        @update:model-value="queryStore.updateCondition(condition.id, { value: $event })"
        @type-change="queryStore.changeConditionValueType(condition.id, $event)"
        :operator="selectedOperator"
      />
      <div v-if="supportsParameters" class="optional-parameters">
        <button
          type="button"
          class="parameters-control"
          :class="{ 'is-expanded': parametersExpanded }"
          :aria-expanded="parametersExpanded"
          :aria-controls="parameterEditorId"
          :aria-describedby="`${parameterEditorId}-description`"
          @click="toggleParameters"
        >
          <span class="material-symbols-outlined" aria-hidden="true">settings</span>
          Optional Parameters
        </button>
        <div :id="parameterEditorId" v-show="parametersExpanded">
          <ElasticsearchParameterEditor
            v-if="parametersExpanded"
            :key="condition.id"
            :condition="condition"
          />
        </div>
        <p :id="`${parameterEditorId}-description`" class="parameters-description">
          Collapsing clears all parameters
        </p>
      </div>
    </template>
    <section class="condition-preview" :aria-label="`Condition ${outputLabel} preview`">
      <h4>Generated {{ queryStore.adapter.label }}{{ queryStore.adapter.presentation ? ` ${outputLabel}` : '' }}</h4>
      <div aria-live="polite" aria-atomic="true">
        <QueryDisplay
          v-if="conditionSql.success || condition.rawSql !== undefined"
          class="condition-sql"
          :query-text="conditionSql.success ? conditionSql.sql : condition.rawSql ?? ''"
          :language="queryStore.adapter.queryFormat.highlightLanguage"
          :accessible-label="`Generated ${queryStore.adapter.label}${queryStore.adapter.presentation ? ` ${outputLabel}` : ''} condition`"
        />
        <details
          v-if="previewError"
          :key="previewError"
          :id="`${rawConditionId}-error`"
          class="condition-error"
          :open="previewError.length <= 100"
        >
          <summary>{{ condition.rawSql !== undefined ? 'Syntax Error' : 'Generation Error' }}</summary>
          <p>{{ previewError }}</p>
        </details>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.condition-panel {
  width: 22rem;
  max-width: 100%;
  box-sizing: border-box;
  padding: 1rem;
  border: 4px solid #d9dee7;
  border-radius: 22px;
  background: #fff;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.editing-mode {
  display: flex;
  flex: 1;
}

.editing-mode button {
  flex: 1;
  padding: 0.45rem;
  border: 1px solid #c5ccd8;
  background: #e8eef9;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.editing-mode button:first-child {
  border-radius: 4px 0 0 4px;
}

.editing-mode button:last-child {
  border-left: 0;
  border-radius: 0 4px 4px 0;
}

.editing-mode button:hover {
  background: #f3f6fa;
}

.editing-mode button:disabled {
  opacity: 0.5;
  cursor: default;
}

.editing-mode button[aria-pressed='true'] {
  background: #fff;
  font-weight: 600;
}

.editing-mode button:focus-visible {
  position: relative;
  outline: 2px solid #172033;
  outline-offset: 2px;
}

.panel-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: #5b6472;
  cursor: pointer;
}

button .material-symbols-outlined {
  font-size: 1.125rem;
}

.optional-parameters {
  margin-top: 1.5rem;
}

.parameters-control {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0;
  border: 0;
  background: transparent;
  color: #6b7280;
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
}

.parameters-control.is-expanded {
  color: #172033;
}

.parameters-control:focus-visible {
  outline: 2px solid #172033;
  outline-offset: 2px;
}

.parameters-description {
  margin: 0.5rem 0 0;
  color: #5b6472;
  font-size: 0.75rem;
}

.raw-condition-input {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
  color: #5b6472;
  font-size: 0.875rem;
}

.raw-condition-input textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.65rem;
  border: 1px solid #c5ccd8;
  border-radius: 4px;
  background: #fff;
  color: #172033;
  font-family: monospace;
  font-size: inherit;
  line-height: 1.5;
  resize: vertical;
}

.raw-condition-input textarea:focus-visible {
  outline: 2px solid #172033;
  outline-offset: 2px;
}

.condition-preview {
  margin: 2rem -1rem 0;
  padding: 1.6rem 1rem 0.8rem;
  border-top: 2px solid v-bind(borderColour);
}

.condition-preview h4 {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  font-weight: normal;
  color: v-bind(borderColour);
}

.condition-preview p {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.condition-preview .condition-error {
  margin-top: 0.5rem;
  color: #b42318;
  font-size: 0.8125rem;
}

.condition-error summary {
  cursor: pointer;
}

.condition-error summary:focus-visible {
  outline: 2px solid #172033;
  outline-offset: 2px;
}

.condition-error p {
  margin-top: 0.5rem;
}

.condition-sql :deep(pre) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
