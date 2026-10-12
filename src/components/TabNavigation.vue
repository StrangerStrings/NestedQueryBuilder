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
] as const

// Hide unavailable import views while retaining the existing placeholder database navigation.
const visibleTabGroups = computed(() =>
  tabGroups.map((group) => ({
    ...group,
    tabs: group.tabs.filter(
      (tab) =>
        queryStore.adapter.placeholder ||
        ((tab.id !== 'import' || !!queryStore.adapter.importSqlFilter) &&
          (tab.id !== 'schema' || !!queryStore.adapter.importSchemaSql)),
    ),
  })),
)

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
        :aria-label="
          tab.id === 'databases'
            ? `Databases, current database: ${queryStore.adapter.label}`
            : undefined
        "
        @click="emit('select', tab.id)"
      >
        <img
          v-if="tab.id === 'databases'"
          class="database-icon"
          :src="queryStore.adapter.icon"
          alt=""
          width="20"
          height="20"
        />
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
  background: var(--surface-navigation);
}

.tab-group {
  display: flex;
  gap: 0.25rem;
}

.tab-group.center {
  justify-content: center;
}

button {
  display: inline-flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

button.active {
  border-bottom-color: var(--accent-primary);
  color: var(--text-primary);
  font-weight: 600;
}

.database-icon {
  flex-shrink: 0;
  object-fit: contain;
}

/* Keep the monochrome database icon visible on dark navigation surfaces. */
:global(:root[data-theme='dark'] .tab-navigation .database-icon) {
  filter: invert(1);
}
</style>
