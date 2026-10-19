<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { formatDialect, postgresql } from 'sql-formatter'
import ConditionFieldInput from './ConditionFieldInput.vue'
import ConditionOperatorInput from './ConditionOperatorInput.vue'
import ConditionValueInput from './ConditionValueInput/ConditionValueInput.vue'
import ConditionOptionalParameters from './ConditionOptionalParameters.vue'
import QueryDisplay from './QueryDisplay.vue'
import { useQueryStore } from '../stores/queryStore'
import { useSettingsStore } from '../stores/settingsStore'
import type { QueryCondition } from '../types/query'
import { resolveConditionColourAppearance } from '../colours/palette'

const queryStore = useQueryStore()
const settingsStore = useSettingsStore()
const rawConditionId = useId()
const editorError = ref<string | null>(null)
const panel = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const viewportHeight = ref('100dvh')
const viewportTop = ref('0px')

const props = defineProps<{
  condition: QueryCondition
  mobile?: boolean
}>()

// Size the overlay to the visible viewport when the keyboard or browser chrome reduces its space.
function updateViewport() {
  viewportHeight.value = `${window.visualViewport?.height ?? window.innerHeight}px`
  viewportTop.value = `${window.visualViewport?.offsetTop ?? 0}px`
}

// Resolve the current tab stops each time so expanded parameters and other dynamic controls participate.
function availableControls() {
  return Array.from(
    panel.value?.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, summary, [tabindex]',
    ) ?? [],
  ).filter(
    // Exclude disabled, hidden and collapsed controls from the focus loop.
    (control) =>
      control.tabIndex >= 0 &&
      !control.matches(':disabled') &&
      !control.closest('[inert]') &&
      control.getClientRects().length > 0 &&
      window.getComputedStyle(control).visibility !== 'hidden',
  )
}

// Keep forward and backward tabbing inside the visible editor without handling Escape.
function trapTab(event: KeyboardEvent) {
  if (!props.mobile || event.key !== 'Tab' || event.defaultPrevented) return
  const controls = availableControls()
  const first = controls[0]
  const last = controls[controls.length - 1]
  const active = document.activeElement
  if (
    !controls.includes(active as HTMLElement) ||
    (event.shiftKey ? active === first : active === last)
  ) {
    event.preventDefault()
    const target = (event.shiftKey ? last : first) ?? panel.value
    target?.focus()
  }
}

// Contain programmatic focus as well as keyboard focus while the covered UI is inert.
function containFocus(event: FocusEvent) {
  if (props.mobile && event.target instanceof Node && !panel.value?.contains(event.target)) {
    closeButton.value?.focus({ preventScroll: true })
  }
}

// Remove mobile-only listeners on dismissal, desktop transition and unmount.
function releaseMobileListeners() {
  document.removeEventListener('keydown', trapTab)
  document.removeEventListener('focusin', containFocus)
  window.removeEventListener('resize', updateViewport)
  window.visualViewport?.removeEventListener('resize', updateViewport)
  window.visualViewport?.removeEventListener('scroll', updateViewport)
}

// Change presentation without moving focus out of an existing input or recreating its browser draft.
async function updateMobileMode(mobile: boolean | undefined) {
  releaseMobileListeners()
  if (mobile) {
    updateViewport()
    document.addEventListener('keydown', trapTab)
    document.addEventListener('focusin', containFocus)
    window.addEventListener('resize', updateViewport)
    window.visualViewport?.addEventListener('resize', updateViewport)
    window.visualViewport?.addEventListener('scroll', updateViewport)
  }
  await nextTick()
  if (!panel.value || props.mobile !== mobile) return
  if (mobile) {
    const active = document.activeElement
    if (
      !panel.value.contains(active) ||
      (active instanceof HTMLElement && active.getClientRects().length === 0)
    ) {
      closeButton.value?.focus({ preventScroll: true })
    }
  }
}

// Apply mobile focus handling after the panel and its controls have rendered.
watch(() => props.mobile, updateMobileMode, { immediate: true, flush: 'post' })
onBeforeUnmount(releaseMobileListeners)

// Let the focused input finish its existing blur commit before the parent removes the editor.
async function requestClose() {
  const active = document.activeElement
  if (active instanceof HTMLElement && panel.value?.contains(active)) active.blur()
  await nextTick()
  emit('close')
}

// Describe condition output using adapter metadata, retaining SQL wording for existing modes.
const outputLabel = computed(() => queryStore.adapter.presentation?.outputLabel ?? 'SQL')

// Derive the active mode directly from the condition's representation.
const editingMode = computed(() => (props.condition.rawSql === undefined ? 'editor' : 'raw'))

// Enable metadata-backed Raw editing while preserving parser-enabled adapters.
const supportsRaw = computed(
  () => !!(queryStore.adapter.rawCondition || queryStore.adapter.parseRawCondition),
)

// Resolve the selected operator metadata for the current condition.
const selectedOperator = computed(() =>
  queryStore.operators.find((operator) => operator.id === props.condition.operatorId),
)

// Generate the selected condition's standalone clause directly with adapter validation.
const conditionSql = computed(() => {
  return queryStore.adapter.generateConditionSql(props.condition)
})

// Match the PostgreSQL output formatting while retaining invalid raw input and fallback SQL.
const conditionPreviewSql = computed(() => {
  const result = conditionSql.value
  if (!result.success) return props.condition.rawSql ?? ''
  if (queryStore.database !== 'postgresql') return result.sql
  try {
    return formatDialect(result.sql, { dialect: postgresql })
  } catch {
    return result.sql
  }
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

// Initialise the raw condition directly from its current generated clause.
function openRawEditor() {
  if (!supportsRaw.value || editingMode.value === 'raw') return
  const sql = conditionSql.value
  queryStore.updateCondition(props.condition.id, { rawSql: sql.success ? sql.sql : '' })
  editorError.value = null
}

// Write each keystroke directly to the condition, including empty or invalid drafts.
function updateRawInput(event: Event) {
  if (!supportsRaw.value) return
  queryStore.updateCondition(props.condition.id, {
    rawSql: (event.target as HTMLTextAreaElement).value,
  })
  editorError.value = null
}

// Return to the visual editor using the adapter's clearing or conversion behavior.
function openVisualEditor() {
  if (!supportsRaw.value || editingMode.value === 'editor') return
  editorError.value = queryStore.editRawCondition(props.condition.id)
}

// Match the card's validation treatment without changing generation or editor feedback.
const isInvalid = computed(() => {
  const result = queryStore.whereSqlResult
  return (!result.success && result.nodeId === props.condition.id) || !conditionSql.value.success
})

// Resolve the panel appearance through the same policy as the selected card.
const conditionColour = computed(() => {
  return resolveConditionColourAppearance(
    queryStore.getConditionColour(props.condition),
    settingsStore.resolvedTheme,
    props.condition.rawSql !== undefined,
    isInvalid.value,
  )
})

// Retain the card's decorative accent around the panel and preview section.
const borderColour = computed(() => conditionColour.value.accent)

// Blend the palette or themed neutral background without fading the panel's contents.
const backgroundColour = computed(() => {
  return `color-mix(in srgb, ${conditionColour.value.background} 25%, transparent)`
})

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <aside
    ref="panel"
    class="condition-panel"
    :style="{
      borderColor: borderColour,
      backgroundColor: mobile ? 'var(--surface-panel)' : backgroundColour,
      '--editor-viewport-height': viewportHeight,
      '--editor-viewport-top': viewportTop,
    }"
    :role="mobile ? 'dialog' : undefined"
    :aria-modal="mobile ? true : undefined"
    :aria-label="mobile ? 'Condition editor' : 'Condition details'"
    :tabindex="mobile ? -1 : 0"
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
          v-if="supportsRaw"
          type="button"
          :aria-pressed="editingMode === 'raw'"
          @click="openRawEditor"
        >
          Raw
        </button>
      </div>
      <button
        ref="closeButton"
        class="panel-close"
        type="button"
        aria-label="Close condition details"
        @click="requestClose"
      >
        <span class="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
    </div>
    <div v-if="supportsRaw && editingMode === 'raw'" class="raw-condition-input">
      <label :for="rawConditionId">{{
        queryStore.adapter.rawCondition?.label ?? 'Raw condition'
      }}</label>
      <textarea
        :id="rawConditionId"
        :value="condition.rawSql"
        @input="updateRawInput"
        rows="6"
        :placeholder="queryStore.adapter.rawCondition?.placeholder ?? 'status = \'online\''"
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
      <ConditionOptionalParameters :condition="condition" />
      <ConditionValueInput
        :field-options="queryStore.uniqueFields"
        v-if="selectedOperator"
        :key="condition.id"
        :model-value="condition.value"
        @update:model-value="queryStore.updateCondition(condition.id, { value: $event })"
        @type-change="queryStore.changeConditionValueType(condition.id, $event)"
        :operator="selectedOperator"
      />
    </template>
    <section class="condition-preview" :aria-label="`Condition ${outputLabel} preview`">
      <h4>
        Generated {{ queryStore.adapter.label
        }}{{ queryStore.adapter.presentation ? ` ${outputLabel}` : '' }}
      </h4>
      <div aria-live="polite" aria-atomic="true">
        <QueryDisplay
          v-if="conditionSql.success || condition.rawSql !== undefined"
          class="condition-sql"
          :query-text="conditionPreviewSql"
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
          <summary>
            {{ condition.rawSql !== undefined ? 'Syntax Error' : 'Generation Error' }}
          </summary>
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
  border: 4px solid var(--border-panel);
  border-radius: 22px;
  background: var(--surface-panel);
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
  border: 1px solid var(--border-control);
  background: var(--surface-control);
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
  background: var(--surface-control-hover);
}

.editing-mode button:disabled {
  opacity: 0.5;
  cursor: default;
}

.editing-mode button[aria-pressed='true'] {
  background: var(--surface-control-selected);
  font-weight: 600;
}

.editing-mode button:focus-visible {
  position: relative;
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.panel-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.panel-close:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

button .material-symbols-outlined {
  font-size: 1.125rem;
}

.raw-condition-input {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.raw-condition-input textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.65rem;
  border: 1px solid var(--border-control);
  border-radius: 4px;
  background: var(--surface-input);
  color: var(--text-primary);
  font-family: monospace;
  font-size: inherit;
  line-height: 1.5;
  resize: vertical;
}

.raw-condition-input textarea:focus-visible {
  outline: 2px solid var(--focus-ring);
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
  color: var(--text-primary);
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
  color: var(--text-error);
  font-size: 0.8125rem;
}

.condition-error summary {
  cursor: pointer;
}

.condition-error summary:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.condition-error p {
  margin-top: 0.5rem;
}

.condition-sql :deep(pre) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (width < 768px) {
  .condition-panel {
    position: fixed;
    z-index: 3;
    top: var(--editor-viewport-top);
    left: 0;
    width: 100%;
    height: var(--editor-viewport-height);
    max-height: 100%;
    overflow: auto;
    overscroll-behavior: contain;
    padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
      max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
    border-radius: 0;
  }

  .condition-panel :deep(button),
  .condition-panel :deep(input),
  .condition-panel :deep(select),
  .condition-panel :deep(summary) {
    min-height: 44px;
    box-sizing: border-box;
  }
}
</style>
