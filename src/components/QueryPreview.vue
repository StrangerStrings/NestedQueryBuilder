<script setup lang="ts">
import { ref, useId } from 'vue'
import { useQueryStore } from '../stores/queryStore'
import type { ImportWhereError } from '../utils/importWhereError'

const queryStore = useQueryStore()
const sqlFilter = ref('')
const importError = ref<ImportWhereError | null>(null)
const sqlFilterId = useId()
const importErrorId = `${sqlFilterId}-error`
const sqlOutputLabelId = `${sqlFilterId}-output-label`

// Import the SQL filter through the store and display any returned error.
function importFilter() {
  const result = queryStore.importSqlFilter(sqlFilter.value)
  if (result.success) {
    importError.value = null
  } else {
    importError.value = result.error
  }
}
</script>

<template>
  <section>
    <h2>Query Preview</h2>
    <form
      v-if="queryStore.database === 'postgresql'"
      class="sql-import"
      @submit.prevent="importFilter"
    >
      <label :for="sqlFilterId">SQL filter</label>
      <textarea
        :id="sqlFilterId"
        v-model="sqlFilter"
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
      <button type="submit">Import WHERE</button>
    </form>
    <div v-if="queryStore.database === 'postgresql'" class="sql-preview">
      <span :id="sqlOutputLabelId">Generated SQL</span>
      <pre
        v-if="queryStore.whereSqlResult.success"
        class="sql-output"
        role="region"
        :aria-labelledby="sqlOutputLabelId"
        tabindex="0"
      ><code>{{ queryStore.whereSqlResult.sql }}</code></pre>
      <p v-else class="generation-error" role="alert">
        {{ queryStore.whereSqlResult.error }}
      </p>
    </div>
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

.import-error,
.generation-error {
  margin: 0;
  color: #b42318;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.import-error code {
  display: block;
  margin-top: 0.25rem;
}

.sql-preview {
  display: grid;
  gap: 0.5rem;
  color: #5b6472;
  font-size: 0.875rem;
}

.sql-output {
  min-height: 4rem;
  margin: 0;
  padding: 0.75rem;
  border: 1px solid #c5ccd8;
  border-radius: 4px;
  background: #fff;
  color: #172033;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
