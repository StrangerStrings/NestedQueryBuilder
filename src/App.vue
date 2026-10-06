<script setup lang="ts">
import { ref } from 'vue'

import QueryBuilder from './components/QueryBuilder.vue'
import QueryPreview from './components/QueryPreview.vue'
import TabNavigation from './components/TabNavigation.vue'
import SchemaImport from './components/SchemaImport.vue'

type Tab = 'builder' | 'query' | 'schema'

const activeTab = ref<Tab>('builder')
</script>

<template>
  <div class="app-shell">
    <div class="top-navigation">
      <TabNavigation :active-tab="activeTab" @select="activeTab = $event" />
    </div>
    <main class="main-content">
      <QueryBuilder v-if="activeTab === 'builder'" />
      <QueryPreview v-else-if="activeTab === 'query'" />
      <SchemaImport v-show="activeTab === 'schema'" />
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
  background: #f7f8fa;
  font-family: inherit;
}

.top-navigation {
  display: flex;
  align-items: center;
  gap: 2rem;
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
