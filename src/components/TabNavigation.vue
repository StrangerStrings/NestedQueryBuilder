<script setup lang="ts">
import { computed } from 'vue'
import { useQueryStore } from '../stores/queryStore'

const queryStore = useQueryStore()
const tabGroups = [
  { position: 'left', tabs: [{ id: 'databases', label: 'Databases' }] },
  {
    position: 'center',
    tabs: [
      { id: 'schema', label: 'Schema' },
      { id: 'import', label: 'Import' },
      { id: 'builder', label: 'Builder' },
      { id: 'output', label: 'Output' },
    ],
  },
  { position: 'right', tabs: [{ id: 'settings', label: 'Settings' }] },
] as const

// Hide unavailable import views while retaining the existing placeholder database navigation.
const visibleTabGroups = computed(() => tabGroups.map((group) => ({
  ...group,
  tabs: group.tabs.filter((tab) =>
    queryStore.adapter.placeholder ||
    (tab.id !== 'import' || !!queryStore.adapter.importSqlFilter) &&
    (tab.id !== 'schema' || !!queryStore.adapter.importSchemaSql),
  ),
})))

type Tab = (typeof tabGroups)[number]['tabs'][number]['id']

defineProps<{
  activeTab: Tab
}>()

const emit = defineEmits<{
  select: [tab: Tab]
}>()
</script>

<template>
  <nav class="tab-navigation" aria-label="Query views">
    <div
      v-for="group in visibleTabGroups"
      :key="group.position"
      class="tab-group"
      :class="group.position"
    >
      <button
        v-for="tab in group.tabs"
        :key="tab.id"
        type="button"
        :class="{ active: activeTab === tab.id }"
        :aria-current="activeTab === tab.id ? 'page' : undefined"
        @click="emit('select', tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>
  </nav>
</template>

<style scoped>
.tab-navigation {
  display: grid;
  grid-template-columns: minmax(max-content, 1fr) auto minmax(max-content, 1fr);
  flex: 1;
  padding: 0 1.5rem;
  background: #ebebf3;
}

.tab-group {
  display: flex;
  gap: 0.25rem;
}

.tab-group.center {
  justify-content: center;
}

.tab-group.right {
  justify-content: flex-end;
}

button {
  padding: 0.75rem 1rem;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #5b6472;
  cursor: pointer;
}

button.active {
  border-bottom-color: #2563eb;
  color: #172033;
  font-weight: 600;
}
</style>
