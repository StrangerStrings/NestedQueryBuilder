<script setup lang="ts">
import { ref } from 'vue'
import { useQueryStore } from '../stores/queryStore'

const queryStore = useQueryStore()
const schemaSql = ref('')
const schemaError = ref('')
const schemaSuccess = ref('')

// Report the import outcome while the store replaces suggestions only on success.
function importSchema() {
  const result = queryStore.importSchemaSql(schemaSql.value)
  schemaError.value = result.success ? '' : result.error
  schemaSuccess.value = result.success
    ? `Extracted ${result.fields.length} ${result.fields.length === 1 ? 'field' : 'fields'}.`
    : ''
}
</script>

<template>
  <section aria-label="Schema">
    <p id="schema-help">
      Paste PostgreSQL CREATE TABLE statements to add column names to field autocomplete. (Types
      and constraints are ignored.)
    </p>
    <form class="schema-form" @submit.prevent="importSchema">
      <textarea
        id="schema-sql"
        v-model="schemaSql"
        rows="12"
        :aria-invalid="!!schemaError"
        :aria-describedby="schemaError ? 'schema-help schema-error' : 'schema-help'"
      ></textarea>
      <button type="submit" :disabled="!schemaSql.trim()">Import Schema</button>
      <p v-if="schemaError" id="schema-error" role="alert">{{ schemaError }}</p>
      <p role="status" aria-live="polite">{{ schemaSuccess }}</p>
    </form>
  </section>
</template>

<style scoped>
.schema-form {
  display: grid;
  gap: 0.75rem;
}

.schema-form textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d9dee7;
  border-radius: 0.375rem;
  font-family: monospace;
  font-size: 0.875rem;
  resize: vertical;
}

.schema-form button {
  justify-self: start;
  padding: 0.75rem 1rem;
  border: 1px solid #d9dee7;
  border-radius: 0.375rem;
  color: #5b6472;
  background: #eef0f4;
  cursor: pointer;
}

.schema-form button:disabled {
  cursor: not-allowed;
}

#schema-error {
  color: #b91c1c;
}
</style>
