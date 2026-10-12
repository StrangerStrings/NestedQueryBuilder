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

// Confirm a switch and keep selection locked while the new database loads.
function selectDatabase(database: DatabaseId) {
  if (queryStore.databaseLoading) return
  if (database === queryStore.database) {
    pendingDatabase.value = null
    return
  }

  if (pendingDatabase.value !== database) {
    pendingDatabase.value = database
    return
  }

  pendingDatabase.value = null
  void queryStore.changeDatabase(database)
}
</script>

<template>
  <section aria-label="Databases">
    <p id="database-warning" class="database-warning">
      <span class="material-symbols-outlined" aria-hidden="true">warning</span>
      Query will be wiped when changing database
    </p>
    <p v-if="queryStore.databaseLoading" role="status">
      Loading {{ databaseDefinitions[queryStore.databaseLoading].label }}…
    </p>
    <p v-if="queryStore.databaseLoadError" role="alert">{{ queryStore.databaseLoadError }}</p>
    <div
      class="database-grid"
      role="group"
      aria-label="Database target"
      :aria-busy="!!queryStore.databaseLoading"
    >
      <button
        v-for="(definition, id) in databaseDefinitions"
        :key="id"
        type="button"
        class="database-button"
        :disabled="!!queryStore.databaseLoading"
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
  border: 1px solid var(--border-notice);
  border-radius: 0.5rem;
  background: var(--surface-notice);
  color: var(--text-secondary);
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
  background: var(--surface-database);
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

/* The database assets use monochrome black paths; preserve their shapes on dark surfaces. */
:global(:root[data-theme='dark'] .database-button img) {
  filter: invert(1);
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
  background: var(--surface-database-hover);
}

.database-button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.database-button[aria-pressed='true'] {
  background: var(--surface-database-selected);
}

.database-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring-gap), 0 0 0 5px var(--focus-ring-database);
}
</style>
