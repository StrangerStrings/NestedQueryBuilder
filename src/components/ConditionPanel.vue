<script setup lang="ts">
import ConditionFieldInput from './ConditionFieldInput.vue'
import ConditionOperatorInput from './ConditionOperatorInput.vue'
import { useQueryStore } from '../stores/queryStore'
import type { QueryCondition } from '../types/query'

const queryStore = useQueryStore()

defineProps<{
  condition: QueryCondition
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <aside class="condition-panel" aria-label="Condition details">
    <div class="panel-header">
      <h3>Condition details</h3>
      <button type="button" @click="emit('close')">Close</button>
    </div>
    <ConditionFieldInput v-model="condition.field" :options="queryStore.uniqueFields" />
    <ConditionOperatorInput v-model="condition.operatorId" :options="queryStore.operators" />
  </aside>
</template>

<style scoped>
.condition-panel {
  width: 18rem;
  max-width: 100%;
  box-sizing: border-box;
  padding: 1rem;
  border: 1px solid #d9dee7;
  border-radius: 4px;
  background: #fff;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

h3 {
  margin: 0;
  font-size: 1rem;
}

button {
  padding: 0.35rem 0.6rem;
  border: 1px solid #c5ccd8;
  border-radius: 4px;
  background: transparent;
  color: #5b6472;
  cursor: pointer;
}

</style>
