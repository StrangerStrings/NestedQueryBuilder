<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { format } from 'sql-formatter'
import { useQueryStore } from '../stores/queryStore'
import type { ImportWhereError } from '../databases/postgresql/parsing/importWhereError'
import QueryDisplay from './QueryDisplay.vue'

const queryStore = useQueryStore()
const sqlFilter = ref('')
const importError = ref<ImportWhereError | null>(null)
const sqlFilterId = useId()
const importErrorId = `${sqlFilterId}-error`
const copyStatusId = `${sqlFilterId}-copy-status`
const copyStatus = ref<'success' | 'error' | ''>('')
const copying = ref(false)

// Format the preview as PostgreSQL, preserving the original SQL if formatting fails.
const formattedSql = computed(() => {
  const result = queryStore.whereSqlResult
  if (!result.success || !result.sql) return ''

  try {
    return format(result.sql, { language: 'postgresql' })
  } catch {
    return result.sql
  }
})

// Clear copy feedback when the displayed query or database changes.
watch(
  // Observe the displayed SQL and active database together.
  () => [formattedSql.value, queryStore.database] as const,
  // Reset feedback so it always refers to the current preview.
  () => {
    copyStatus.value = ''
  },
)

// Copy the displayed SQL and report clipboard failures without changing the query.
async function copySql() {
  const sql = formattedSql.value
  if (copying.value || !sql || !queryStore.whereSqlResult.success) return

  copying.value = true
  copyStatus.value = ''
  try {
    await navigator.clipboard.writeText(sql)
    if (formattedSql.value === sql && queryStore.database === 'postgresql') {
      copyStatus.value = 'success'
    }
  } catch {
    if (formattedSql.value === sql && queryStore.database === 'postgresql') {
      copyStatus.value = 'error'
    }
  } finally {
    copying.value = false
  }
}

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
      <div class="sql-preview-header">
        <span>Generated SQL</span>
        <button
          type="button"
          aria-label="Copy formatted PostgreSQL SQL"
          :aria-describedby="copyStatusId"
          :disabled="copying || !queryStore.whereSqlResult.success || !formattedSql"
          @click="copySql"
        >
          {{ copying ? 'Copying…' : 'Copy SQL' }}
        </button>
      </div>
      <QueryDisplay
        v-if="queryStore.whereSqlResult.success"
        class="sql-output"
        :query-text="formattedSql"
        language="sql"
        accessible-label="Generated PostgreSQL SQL"
      />
      <p v-else class="generation-error" role="alert">
        {{ queryStore.whereSqlResult.error }}
      </p>
      <p
        :id="copyStatusId"
        class="copy-status"
        :class="{ 'copy-error': copyStatus === 'error' }"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <template v-if="copyStatus === 'success'">SQL copied to clipboard.</template>
        <template v-else-if="copyStatus === 'error'">
          Could not copy SQL. Select the query text and copy it manually.
        </template>
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

.sql-import button,
.sql-preview button {
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
}

.sql-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.sql-preview button:disabled {
  opacity: 0.5;
  cursor: default;
}

.sql-preview button:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.copy-status {
  margin: 0;
}

.copy-error {
  color: #b42318;
}
</style>
