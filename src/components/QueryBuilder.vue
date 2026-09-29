<script setup lang="ts">
import { ref } from 'vue'

import { useQueryStore } from '../stores/queryStore'
import type { QueryCondition } from '../types/query'
import ConditionPanel from './ConditionPanel.vue'
import QueryGroup from './QueryGroup.vue'

const queryStore = useQueryStore()
const selectedCondition = ref<QueryCondition | null>(null)

function selectCondition(condition: QueryCondition) {
  selectedCondition.value = condition
}

function closeConditionPanel() {
  selectedCondition.value = null
}
</script>

<template>
  <section>
    <h2>Query Builder</h2>
    <div class="editor-workspace" :class="{ 'has-selection': selectedCondition }">
      <div class="builder-content">
        <p>Example predicates:</p>
        <div class="conditions">
          <QueryGroup :group="queryStore.query" @select="selectCondition" />
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