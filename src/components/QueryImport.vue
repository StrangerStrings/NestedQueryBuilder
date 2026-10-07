<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import { useQueryStore } from '../stores/queryStore'
import CollapsableHelp from './CollapsableHelp.vue'
import type { FilterImportResult } from '../types/databaseAdapter'

type ImportError = Extract<FilterImportResult, { success: false }>['error']

const queryStore = useQueryStore()
const sqlFilter = ref('')
const importError = ref<ImportError | null>(null)
const importSucceeded = ref(false)
const showImportHelp = ref(false)
const sqlFilterId = useId()
const importHelpId = `${sqlFilterId}-help`
const importErrorId = `${sqlFilterId}-error`

// Clear SQL drafts and feedback on every database change, including direct store entry points.
watch(() => queryStore.database, () => {
  sqlFilter.value = ''
  importError.value = null
  importSucceeded.value = false
  showImportHelp.value = false
}, { flush: 'sync' })

// Import the SQL filter and display success or the returned error.
function importFilter() {
  if (!queryStore.adapter.importSqlFilter) return
  const result = queryStore.importSqlFilter(sqlFilter.value)
  importSucceeded.value = result.success
  if (result.success) {
    importError.value = null
  } else {
    importError.value = result.error
  }
}
</script>

<template>
  <section aria-label="Query import">
    <form
      class="sql-import"
      @submit.prevent="importFilter"
    >
      <textarea
        :id="sqlFilterId"
        aria-label="SQL filter to import"
        v-model="sqlFilter"
        @input="importSucceeded = false"
        rows="12"
        :placeholder="queryStore.adapter.helpText?.queryPlaceholder"
        :spellcheck="false"
        :aria-invalid="!!importError"
        :aria-describedby="[showImportHelp ? importHelpId : null, importError ? importErrorId : null].filter(Boolean).join(' ') || undefined"
      />
      <button type="submit" :disabled="!sqlFilter.trim()">Import {{ queryStore.adapter.label }} Query</button>
      <p v-if="importError" :id="importErrorId" class="import-error" role="alert">
        {{ importError.message }}
        <code v-if="importError.fragment">{{ importError.fragment }}</code>
      </p>
      <div role="status" aria-live="polite">
        <p v-if="importSucceeded" class="import-success">Query imported successfully.</p>
      </div>
    </form>
    <CollapsableHelp
      v-if="queryStore.adapter.importSqlFilter && queryStore.adapter.helpText?.queryHelp"
      :id="importHelpId"
      v-model="showImportHelp"
      :text="queryStore.adapter.helpText.queryHelp"
      label="query import help"
    />
  </section>
</template>

<style scoped>
.sql-import {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  color: #5b6472;
  font-size: 0.875rem;
}

.sql-import textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.65rem;
  border: 1px solid #c5ccd8;
  border-radius: 4px;
  color: #172033;
  font: inherit;
  resize: vertical;
}

.sql-import button {
  justify-self: start;
  padding: 0.75rem 1rem;
  border: 1px solid #d9dee7;
  border-radius: 0.375rem;
  color: #5b6472;
  background: #ffffff;
  cursor: pointer;
}

.sql-import button:disabled {
  cursor: not-allowed;
}

.import-error {
  margin: 0;
  color: #b42318;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.import-success {
  margin: 0;
  color: #15803d;
}

.import-error code {
  display: block;
  margin-top: 0.25rem;
}
</style>
