<script setup lang="ts">
import { ref } from 'vue'

import QueryBuilder from './components/QueryBuilder.vue'
import QueryPreview from './components/QueryPreview.vue'
import QueryInput from './components/QueryInput.vue'
import TabNavigation from './components/TabNavigation.vue'
import SchemaImport from './components/SchemaImport.vue'
import SettingsPage from './components/SettingsPage.vue'

type Tab = 'builder' | 'output' | 'input' | 'schema' | 'databases' | 'settings'

const activeTab = ref<Tab>('builder')
</script>

<template>
  <div class="app-shell">
    <div class="top-navigation">
      <TabNavigation :active-tab="activeTab" @select="activeTab = $event" />
    </div>
    <main class="main-content">
      <QueryBuilder v-if="activeTab === 'builder'" />
      <QueryPreview v-else-if="activeTab === 'output'" />
      <QueryInput v-show="activeTab === 'input'" />
      <SchemaImport v-show="activeTab === 'schema'" />
      <section v-if="activeTab === 'databases'" aria-label="Databases">
        <h2>Databases</h2>
      </section>
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
