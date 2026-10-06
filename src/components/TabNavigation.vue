<script setup lang="ts">
const tabGroups = [
  { position: 'left', tabs: [{ id: 'databases', label: 'Databases' }] },
  {
    position: 'center',
    tabs: [
      { id: 'schema', label: 'Schema' },
      { id: 'input', label: 'Input' },
      { id: 'builder', label: 'Builder' },
      { id: 'output', label: 'Output' },
    ],
  },
  { position: 'right', tabs: [{ id: 'settings', label: 'Settings' }] },
] as const

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
      v-for="group in tabGroups"
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
