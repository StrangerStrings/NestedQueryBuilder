<script setup lang="ts">
import { ref, watch } from 'vue'
import { useQueryStore } from '../stores/queryStore'
import { databaseDefinitions, type DatabaseId } from '../databases/DatabaseDefinitions.ts'

const queryStore = useQueryStore()
const pendingDatabase = ref<DatabaseId | null>(null)

// Clear confirmation if the active database changes through another entry point.
watch(() => queryStore.database, () => {
  pendingDatabase.value = null
}, { flush: 'sync' })

// Require a second click on the same target before clearing the current query.
function selectDatabase(database: DatabaseId) {
  if (database === queryStore.database) {
    pendingDatabase.value = null
    return
  }

  if (pendingDatabase.value !== database) {
    pendingDatabase.value = database
    return
  }

  pendingDatabase.value = null
  queryStore.changeDatabase(database)
}
</script>

<template>
  <section aria-label="Databases">
    <p id="database-warning" class="database-warning">
      <span class="material-symbols-outlined" aria-hidden="true">warning</span>
      Query will be wiped when changing database
    </p>
    <div class="database-grid" role="group" aria-label="Database target">
      <button
        v-for="(definition, id) in databaseDefinitions"
        :key="id"
        type="button"
        class="database-button"
        :aria-pressed="queryStore.database === id"
        :aria-label="pendingDatabase === id ? `Confirm Change to ${definition.label} ${definition.version}` : `${definition.label} ${definition.version}`"
        aria-describedby="database-warning"
        @click="selectDatabase(id)"
        @keydown.esc="pendingDatabase = null"
        @blur="pendingDatabase = null"
      >
        <template v-if="pendingDatabase === id">
          <span class="database-name">
            Confirm Change
            <span class="database-version">{{ definition.label }} {{ definition.version }}</span>
          </span>
        </template>
        <template v-else>
          <img :src="definition.icon" alt="" width="40" height="40" />
          <span class="database-name">
            {{ definition.label }}
            <span class="database-version">{{ definition.version }}</span>
          </span>
        </template>
      </button>
    </div>
  </section>
</template>

<style scoped>
.database-warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 2rem;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: #f3f4f6;
  color: #4b5563;
}

.database-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-width: 560px;
  margin-inline: auto;
  gap: 0.75rem;
}

.database-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 120px;
  padding: 1rem 0.75rem;
  border: 0;
  border-radius: 0.75rem;
  background: #f3f4f6;
  color: inherit;
  font: inherit;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.database-button img {
  max-width: 100%;
  object-fit: contain;
}

.database-name {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.database-version {
  font-size: 0.8rem;
  font-weight: 400;
}

.database-button:hover {
  background: #e5e7eb;
}

.database-button[aria-pressed='true'] {
  background: #d1d5db;
}

.database-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px #fff, 0 0 0 5px #6b7280;
}
</style>
