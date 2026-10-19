<script setup lang="ts">
import { defineAsyncComponent, h, onMounted, ref, watch } from 'vue'
import { useQueryStore } from './stores/queryStore'
import { databaseDefinitions } from './databases/DatabaseDefinitions'

import QueryBuilder from './components/QueryBuilder.vue'
import QueryImport from './components/QueryImport.vue'
import TabNavigation from './components/TabNavigation.vue'
import SchemaImport from './components/SchemaImport.vue'
import DatabaseList from './components/DatabaseList.vue'

const QueryPreview = defineAsyncComponent({
  // Download Output and its SQL formatter only when the Output tab is opened.
  loader: () => import('./components/QueryPreview.vue'),
  loadingComponent: {
    // Announce loading while the Output component downloads.
    render() {
      return h('p', { role: 'status' }, 'Loading output…')
    },
  },
  errorComponent: {
    // Explain how to retry a failed download without losing the current query.
    render() {
      return h('p', { role: 'alert' }, 'Could not load output. Open another tab, then try Output again.')
    },
  },
})

type Tab = 'builder' | 'output' | 'import' | 'schema' | 'databases'

const activeTab = ref<Tab>('builder')
const mobileEditorOpen = ref(false)
const queryStore = useQueryStore()

// Load the saved database before mounting views that use its capabilities.
onMounted(() => {
  void queryStore.changeDatabase(queryStore.database)
})

// Guard navigation entry points using the same capabilities as the visible tabs.
function selectTab(tab: Tab) {
  if (
    !queryStore.adapter.placeholder &&
    ((tab === 'import' && !queryStore.adapter.importSqlFilter) ||
      (tab === 'schema' && !queryStore.adapter.importSchemaSql))
  )
    return
  activeTab.value = tab
}

// Return to the builder if a capability change removes the currently selected import view.
watch(
  () => queryStore.database,
  () => {
    if (queryStore.adapter.placeholder) return
    if (
      (activeTab.value === 'import' && !queryStore.adapter.importSqlFilter) ||
      (activeTab.value === 'schema' && !queryStore.adapter.importSchemaSql)
    ) {
      activeTab.value = 'builder'
    }
  },
  { flush: 'sync' },
)
</script>

<template>
  <div class="app-shell" :class="{ 'builder-active': activeTab === 'builder' }">
    <div
      v-if="queryStore.databaseReady"
      class="top-navigation"
      :inert="!!queryStore.databaseLoading || mobileEditorOpen"
    >
      <TabNavigation :active-tab="activeTab" @select="selectTab" />
    </div>
    <main class="main-content">
      <section
        v-if="!queryStore.databaseReady"
        aria-label="Loading database"
        :aria-busy="!!queryStore.databaseLoading"
      >
        <p v-if="queryStore.databaseLoadError" role="alert">{{ queryStore.databaseLoadError }}</p>
        <p v-else role="status">Loading {{ databaseDefinitions[queryStore.database].label }}…</p>
        <button
          v-if="queryStore.databaseLoadError"
          type="button"
          :disabled="!!queryStore.databaseLoading"
          aria-label="Retry loading the selected database"
          @click="queryStore.changeDatabase(queryStore.database)"
        >
          Try again
        </button>
      </section>
      <template v-else>
        <QueryBuilder
          v-if="activeTab === 'builder'"
          :key="`builder-${queryStore.database}`"
          @mobile-editor-change="mobileEditorOpen = $event"
        />
        <QueryPreview v-else-if="activeTab === 'output'" :key="`output-${queryStore.database}`" />
        <QueryImport
          v-if="queryStore.adapter.importSqlFilter || queryStore.adapter.placeholder"
          :key="`import-${queryStore.database}`"
          v-show="activeTab === 'import'"
        />
        <SchemaImport
          v-if="queryStore.adapter.importSchemaSql || queryStore.adapter.placeholder"
          :key="`schema-${queryStore.database}`"
          v-show="activeTab === 'schema'"
        />
        <DatabaseList v-if="activeTab === 'databases'" />
      </template>
    </main>
  </div>
</template>

<style scoped>
:global(body) {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.app-shell {
  min-height: 100vh;
  color: var(--text-primary);
  background: var(--surface-page);
  font-family: inherit;
}

.top-navigation {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 2rem;
  overflow-x: auto;
  background: var(--surface-navigation);
  border-bottom: 1px solid var(--border-panel);
}

.main-content {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1.5rem 0;
}

.builder-active {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
}

.builder-active .top-navigation {
  flex-shrink: 0;
}

.builder-active .main-content {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
}

@media (width < 768px) {
  .top-navigation {
    overflow: visible;
  }

  .builder-active .main-content {
    min-width: 0;
    padding: 0.5rem 0.25rem 0;
  }
}

@media (min-width: 1200px) {
  :global(.main-content:has(.condition-panel)) {
    max-width: 1200px;
  }
}
</style>
