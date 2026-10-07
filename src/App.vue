<script setup lang="ts">
import { ref, watch } from 'vue'
import { useQueryStore } from './stores/queryStore'

import QueryBuilder from './components/QueryBuilder.vue'
import QueryPreview from './components/QueryPreview.vue'
import QueryImport from './components/QueryImport.vue'
import TabNavigation from './components/TabNavigation.vue'
import SchemaImport from './components/SchemaImport.vue'
import SettingsPage from './components/SettingsPage.vue'
import DatabaseList from './components/DatabaseList.vue'

type Tab = 'builder' | 'output' | 'import' | 'schema' | 'databases' | 'settings'

const activeTab = ref<Tab>('builder')
const queryStore = useQueryStore()

// Guard navigation entry points using the same capabilities as the visible tabs.
function selectTab(tab: Tab) {
  if (!queryStore.adapter.placeholder && (
    (tab === 'import' && !queryStore.adapter.importSqlFilter) ||
    (tab === 'schema' && !queryStore.adapter.importSchemaSql)
  )) return
  activeTab.value = tab
}

// Return to the builder if a capability change removes the currently selected import view.
watch(
  () => queryStore.database,
  () => {
    if (queryStore.adapter.placeholder) return
    if ((activeTab.value === 'import' && !queryStore.adapter.importSqlFilter) ||
        (activeTab.value === 'schema' && !queryStore.adapter.importSchemaSql)) {
      activeTab.value = 'builder'
    }
  },
  { flush: 'sync' },
)
</script>

<template>
  <div class="app-shell">
    <div class="top-navigation">
      <TabNavigation :active-tab="activeTab" @select="selectTab" />
    </div>
    <main class="main-content">
      <QueryBuilder v-if="activeTab === 'builder'" :key="`builder-${queryStore.database}`" />
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
      <SettingsPage v-if="activeTab === 'settings'" />
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
  color: #172033;
  background: white;
  font-family: inherit;
}

.top-navigation {
  display: flex;
  align-items: center;
  gap: 2rem;
  overflow-x: auto;
  border-bottom: 1px solid #d9dee7;
}

.main-content {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

@media (min-width: 1200px) {
  :global(.main-content:has(.condition-panel)) {
    max-width: 1200px;
  }
}
</style>
