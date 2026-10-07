<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { format } from 'sql-formatter'
import { useQueryStore } from '../stores/queryStore'
import QueryDisplay from './QueryDisplay.vue'

const queryStore = useQueryStore()
const copyStatusId = `${useId()}-copy-status`
const copyStatus = ref<'success' | 'error' | ''>('')
const copying = ref(false)
let previewRevision = 0

// Format SQL in the active dialect, preserving the original SQL if formatting fails.
const formattedSql = computed(() => {
  const result = queryStore.whereSqlResult
  if (!result.success || !result.sql) return ''

  try {
    return format(result.sql, { language: queryStore.adapter.queryFormat.formatterDialect })
  } catch {
    return result.sql
  }
})

// Invalidate pending copy feedback whenever query state or the selected database changes.
watch(
  // Observe edits even if the formatted SQL happens to stay the same.
  () => [queryStore.query, queryStore.database] as const,
  // Reset feedback so it always refers to the current preview.
  () => {
    previewRevision += 1
    copyStatus.value = ''
  },
  { deep: true, flush: 'sync' },
)

// Copy the displayed SQL and report clipboard failures without changing the query.
async function copySql() {
  const revision = previewRevision
  const database = queryStore.database
  const sql = formattedSql.value
  if (copying.value || !sql || !queryStore.whereSqlResult.success) return

  copying.value = true
  copyStatus.value = ''
  try {
    await navigator.clipboard.writeText(sql)
    if (revision === previewRevision && queryStore.whereSqlResult.success &&
        formattedSql.value === sql && queryStore.database === database) {
      copyStatus.value = 'success'
    }
  } catch {
    if (revision === previewRevision && queryStore.whereSqlResult.success &&
        formattedSql.value === sql && queryStore.database === database) {
      copyStatus.value = 'error'
    }
  } finally {
    copying.value = false
  }
}
</script>

<template>
  <section aria-label="Query output">
    <div class="sql-preview">
      <div class="sql-preview-header">
        <span>Generated {{ queryStore.adapter.label }}</span>
      </div>
      <QueryDisplay
        v-if="queryStore.whereSqlResult.success"
        class="sql-output"
        :query-text="formattedSql"
        :language="queryStore.adapter.queryFormat.highlightLanguage"
        :accessible-label="`Generated ${queryStore.adapter.label} SQL`"
      />
      <p v-else class="generation-error" role="alert">
        {{ queryStore.whereSqlResult.error }}
      </p>
      <button
        type="button"
        :aria-label="`Copy formatted ${queryStore.adapter.label} SQL`"
        :aria-describedby="copyStatusId"
        :disabled="copying || !queryStore.whereSqlResult.success || !formattedSql"
        @click="copySql"
      >
        {{ copying ? 'Copying…' : 'Copy Query' }}
      </button>
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
.sql-preview button {
  justify-self: start;
  padding: 0.75rem 1rem;
  border: 1px solid #d9dee7;
  border-radius: 0.375rem;
  color: #5b6472;
  background: #ffffff;
  cursor: pointer;
}

.generation-error {
  margin: 0;
  color: #b42318;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
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
  cursor: not-allowed;
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
