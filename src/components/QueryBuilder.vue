<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useQueryStore } from '../stores/queryStore'
import type { QueryCondition, QueryGroup as QueryGroupModel } from '../types/query'
import BuilderSettings from './BuilderSettings.vue'
import ConditionPanel from './ConditionPanel.vue'
import QueryGroup from './QueryGroup.vue'

const queryStore = useQueryStore()
const selectedConditionId = ref<string | null>(null)

// Drop selection immediately when the query root is replaced by a switch or import.
watch(
  () => queryStore.query.id,
  () => {
    selectedConditionId.value = null
  },
  { flush: 'sync' },
)

// Resolve the selection from the current tree so deleted conditions close their panel.
function findSelectedCondition(group: QueryGroupModel): QueryCondition | null {
  for (const child of group.children) {
    if (child.kind === 'condition' && child.id === selectedConditionId.value) return child
    if (child.kind === 'group') {
      const condition = findSelectedCondition(child)
      if (condition) return condition
    }
  }
  return null
}

// Keep the details panel tied to a condition that still exists in the query.
const selectedCondition = computed(() => findSelectedCondition(queryStore.query))

// Select a condition by its stable identifier.
function selectCondition(condition: QueryCondition) {
  selectedConditionId.value = condition.id
}

// Clear the current condition selection.
function closeConditionPanel() {
  selectedConditionId.value = null
}
</script>

<template>
  <section class="query-builder" aria-label="Query builder">
    <div class="editor-workspace" :class="{ 'has-selection': selectedCondition }">
      <div class="builder-content" role="region" aria-label="Query conditions" tabindex="0">
        <div class="conditions">
          <QueryGroup
            :group="queryStore.query"
            :selected-condition-id="selectedCondition?.id"
            @select="selectCondition"
          />
        </div>
      </div>
      <ConditionPanel
        v-if="selectedCondition"
        :key="selectedCondition.id"
        :condition="selectedCondition"
        tabindex="0"
        @close="closeConditionPanel"
      />
    </div>
    <BuilderSettings class="builder-settings" />
  </section>
</template>

<style scoped>
.query-builder {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.editor-workspace {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  align-items: flex-start;
  gap: 1rem;
}

.builder-content {
  min-width: 0;
  flex: 1;
  height: 100%;
  overflow: auto;
}

.condition-panel {
  max-height: 100%;
  overflow: auto;
}

.builder-content:focus-visible,
.condition-panel:focus-visible {
  outline: 2px solid var(--focus-ring-accent);
  outline-offset: -2px;
}

.conditions {
  display: grid;
  gap: 0.5rem;
  /* Leave room for the group mode badge and its focus outline inside the scroll area. */
  padding-left: 1.5rem;
}

.builder-settings {
  position: fixed;
  bottom: 1rem;
  left: 1.5rem;
  z-index: 1;
}
</style>
