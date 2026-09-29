<script setup lang="ts">
type Tab = 'builder' | 'query'

defineProps<{
  activeTab: Tab
}>()

const emit = defineEmits<{
  select: [tab: Tab]
}>()
</script>

<template>
  <nav class="tab-navigation" aria-label="Query views">
    <button
      type="button"
      :class="{ active: activeTab === 'builder' }"
      :aria-current="activeTab === 'builder' ? 'page' : undefined"
      @click="emit('select', 'builder')"
    >
      Builder
    </button>
    <button
      type="button"
      :class="{ active: activeTab === 'query' }"
      :aria-current="activeTab === 'query' ? 'page' : undefined"
      @click="emit('select', 'query')"
    >
      Query
    </button>
  </nav>
</template>

<style scoped>
.tab-navigation {
  display: flex;
  gap: 0.25rem;
  padding: 0 1.5rem;
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