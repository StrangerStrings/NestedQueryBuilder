<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { format } from 'sql-formatter'
import { useQueryStore } from '../stores/queryStore'
import type { QueryGroup } from '../types/query'
import QueryDisplay from './QueryDisplay.vue'

const queryStore = useQueryStore()
const copyStatusId = `${useId()}-copy-status`
const copyStatus = ref<'success' | 'error' | ''>('')
const copying = ref(false)
let previewRevision = 0

// Use the adapter's output description while retaining SQL wording for existing modes.
const outputLabel = computed(() => queryStore.adapter.presentation?.outputLabel ?? 'SQL')

// Describe metadata-provided output directly and preserve existing SQL clipboard labels.
const copyLabel = computed(() => queryStore.adapter.presentation
  ? `Copy ${queryStore.adapter.label} ${outputLabel.value}`
  : queryStore.database === 'sqlite' ? 'Copy SQLite SQL' : `Copy formatted ${queryStore.adapter.label} SQL`,
)

// Find source-preserved Raw conditions at any depth, including within none groups.
function hasRawCondition(group: QueryGroup): boolean {
  for (const child of group.children) {
    if (child.kind === 'condition' && child.rawSql !== undefined) return true
    if (child.kind === 'group' && hasRawCondition(child)) return true
  }
  return false
}

// Preserve SQLite Raw and unformatted output; otherwise format SQL with the original as fallback.
const formattedSql = computed(() => {
  const result = queryStore.whereSqlResult
  if (!result.success || !result.sql) return ''
  if (queryStore.database === 'sqlite' && hasRawCondition(queryStore.query)) return result.sql
  const dialect = queryStore.adapter.queryFormat.formatterDialect
  if (dialect === null) return result.sql

  try {
    return format(result.sql, { language: dialect })
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

// Copy the displayed output and report clipboard failures without changing the query.
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
  <section :aria-label="queryStore.adapter.presentation ? `Query ${outputLabel} output` : 'Query output'">
    <div class="sql-preview">
      <div class="sql-preview-header">
        <span>Generated {{ queryStore.adapter.label }}{{ queryStore.adapter.presentation ? ` ${outputLabel}` : '' }}</span>
      </div>
      <QueryDisplay
        v-if="queryStore.whereSqlResult.success"
        class="sql-output"
        :query-text="formattedSql"
        :language="queryStore.adapter.queryFormat.highlightLanguage"
        :accessible-label="`Generated ${queryStore.adapter.label} ${outputLabel}`"
      />
      <p v-else class="generation-error" role="alert">
        {{ queryStore.whereSqlResult.error }}
      </p>
      <button
        type="button"
        :aria-label="copyLabel"
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
        <template v-if="copyStatus === 'success'">{{ outputLabel }} copied to clipboard.</template>
        <template v-else-if="copyStatus === 'error'">
          Could not copy {{ outputLabel }}. Select the query text and copy it manually.
        </template>
      </p>
    </div>
  </section>
</template>

<style scoped>
.sql-preview button {
  justify-self: start;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-panel);
  border-radius: 0.375rem;
  color: var(--text-muted);
  background: var(--surface-button);
  cursor: pointer;
}

.generation-error {
  margin: 0;
  color: var(--text-error);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.sql-preview {
  display: grid;
  gap: 0.5rem;
  color: var(--text-muted);
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
  outline: 2px solid var(--focus-ring-accent);
  outline-offset: 2px;
}

.copy-status {
  margin: 0;
}

.copy-error {
  color: var(--text-error);
}
</style>
