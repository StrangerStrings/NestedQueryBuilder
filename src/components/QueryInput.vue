<script setup lang="ts">
import { ref, useId } from 'vue'
import { useQueryStore } from '../stores/queryStore'
import type { ImportWhereError } from '../databases/postgresql/parsing/importWhereError'

const queryStore = useQueryStore()
const sqlFilter = ref('')
const importError = ref<ImportWhereError | null>(null)
const importSucceeded = ref(false)
const sqlFilterId = useId()
const importErrorId = `${sqlFilterId}-error`

// Import the SQL filter and display success or the returned error.
function importFilter() {
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
  <section aria-label="Query input">
    <form
      v-if="queryStore.database === 'postgresql'"
      class="sql-import"
      @submit.prevent="importFilter"
    >
      <textarea
        :id="sqlFilterId"
        v-model="sqlFilter"
        @input="importSucceeded = false"
        rows="4"
        placeholder="WHERE status = 'online' AND deleted_at IS NULL"
        :spellcheck="false"
        :aria-invalid="!!importError"
        :aria-describedby="importError ? importErrorId : undefined"
      />
      <p v-if="importError" :id="importErrorId" class="import-error" role="alert">
        {{ importError.message }}
        <code v-if="importError.fragment">{{ importError.fragment }}</code>
      </p>
      <div role="status" aria-live="polite">
        <p v-if="importSucceeded" class="import-success">Query imported successfully.</p>
      </div>
      <button type="submit">Import WHERE</button>
    </form>
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
  padding: 0.5rem 0.75rem;
  border: 1px solid #c5ccd8;
  border-radius: 4px;
  background: #fff;
  color: #172033;
  font: inherit;
  cursor: pointer;
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
