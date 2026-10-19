<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQueryStore } from '../stores/queryStore'
import CollapsableHelp from './CollapsableHelp.vue'

const queryStore = useQueryStore()
const schemaSql = ref('')
const schemaError = ref('')
const schemaSuccess = ref('')
const schemaWarnings = ref<string[]>([])
const showSchemaHelp = ref(false)

// Describe the adapter's schema format while retaining the existing SQL label.
const schemaImportLabel = computed(() => queryStore.adapter.presentation?.schemaImportLabel ?? 'CREATE TABLE schema to import')

// Use schema presentation terminology for unavailable imports with the existing SQL fallback.
const unsupportedSchemaMessage = computed(() => `${queryStore.adapter.label} ${queryStore.adapter.presentation?.schemaImportLabel ?? 'CREATE TABLE schema'} import is not supported.`)

// Clear the previous target's schema draft and feedback before another import can occur.
watch(() => queryStore.database, () => {
  schemaSql.value = ''
  schemaError.value = ''
  schemaSuccess.value = ''
  schemaWarnings.value = []
  showSchemaHelp.value = false
}, { flush: 'sync' })

// Report the import outcome while the store replaces suggestions only on success.
function importSchema() {
  if (!queryStore.adapter.importSchemaSql) return
  const result = queryStore.importSchemaSql(schemaSql.value)
  schemaWarnings.value = result.success ? result.warnings ?? [] : []
  schemaError.value = result.success ? '' : result.error
  schemaSuccess.value = result.success
    ? schemaWarnings.value.length
      ? `Imported ${result.fields.length} supported ${result.fields.length === 1 ? 'field' : 'fields'} with exclusions.`
      : `Extracted ${result.fields.length} ${result.fields.length === 1 ? 'field' : 'fields'}.`
    : ''
}
</script>

<template>
  <section aria-label="Schema">
    <form v-if="queryStore.adapter.importSchemaSql" class="schema-form" @submit.prevent="importSchema">
      <textarea
        id="schema-sql"
        :aria-label="schemaImportLabel"
        v-model="schemaSql"
        rows="12"
        :placeholder="queryStore.adapter.helpText?.schemaPlaceholder"
        :aria-invalid="!!schemaError"
        :aria-describedby="[showSchemaHelp ? 'schema-database-help' : null, schemaError ? 'schema-error' : null, schemaSuccess ? 'schema-status' : null].filter(Boolean).join(' ') || undefined"
      ></textarea>
      <button type="submit" :disabled="queryStore.database === 'sqlite' ? schemaSql.length === 0 : !schemaSql.trim()">Import Schema</button>
      <p v-if="schemaError" id="schema-error" role="alert">{{ schemaError }}</p>
      <div id="schema-status" role="status" aria-live="polite" aria-atomic="true">
        <p v-if="schemaSuccess">{{ schemaSuccess }}</p>
        <ul v-if="schemaWarnings.length" aria-label="Excluded schema fields">
          <li v-for="(warning, index) in schemaWarnings" :key="index">{{ warning }}</li>
        </ul>
      </div>
    </form>
    <p v-else>{{ unsupportedSchemaMessage }}</p>
    <CollapsableHelp
      v-if="queryStore.adapter.importSchemaSql && queryStore.adapter.helpText?.schemaHelp"
      id="schema-database-help"
      v-model="showSchemaHelp"
      :text="queryStore.adapter.helpText.schemaHelp"
      label="schema help"
    />
  </section>
</template>

<style scoped>
section {
  min-width: 0;
  overflow-wrap: anywhere;
}

.schema-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
}

.schema-form textarea {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 0.75rem;
  border: 1px solid var(--border-panel);
  border-radius: 0.375rem;
  background: var(--surface-input);
  color: var(--text-native-input);
  font-family: monospace;
  font-size: 0.875rem;
  resize: vertical;
}

.schema-form button {
  justify-self: start;
  max-width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-panel);
  border-radius: 0.375rem;
  color: var(--text-muted);
  background: var(--surface-button);
  cursor: pointer;
}

.schema-form button:disabled {
  cursor: not-allowed;
}

.schema-form textarea:focus-visible,
.schema-form button:focus-visible {
  outline: 2px solid var(--focus-ring-accent);
  outline-offset: 2px;
}

#schema-error {
  color: var(--text-schema-error);
}

@media (width < 768px) {
  section {
    padding-bottom: 1rem;
  }

  .schema-form textarea {
    font-size: 1rem;
  }

  .schema-form button,
  :deep(.help-toggle) {
    min-height: 44px;
  }
}
</style>
