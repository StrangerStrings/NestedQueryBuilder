<script setup lang="ts">
import { computed, ref } from 'vue'

import { useQueryStore } from '../stores/queryStore'
import type { QueryCondition, QueryGroup as QueryGroupModel } from '../types/query'
import ConditionPanel from './ConditionPanel.vue'
import QueryGroup from './QueryGroup.vue'

const queryStore = useQueryStore()
const selectedConditionId = ref<string | null>(null)

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
  <section>
    <div class="editor-workspace" :class="{ 'has-selection': selectedCondition }">
      <div class="builder-content">
        <div class="conditions">
          <QueryGroup
            :group="queryStore.query"
            :selected-condition-id="selectedCondition?.id"
            @select="selectCondition"
          />
        </div>
      </div>
      <Transition name="panel">
        <ConditionPanel
          v-if="selectedCondition"
          :condition="selectedCondition"
          @close="closeConditionPanel"
        />
      </Transition>
    </div>
  </section>
</template>

<style scoped>
.editor-workspace {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.builder-content {
  min-width: 0;
  flex: 1;
}

.conditions {
  display: grid;
  gap: 0.5rem;
}
</style>
