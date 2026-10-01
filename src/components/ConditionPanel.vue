<script setup lang="ts">
import { computed } from 'vue'
import ConditionFieldInput from './ConditionFieldInput.vue'
import ConditionOperatorInput from './ConditionOperatorInput.vue'
import ConditionValueInput from './ConditionValueInput/ConditionValueInput.vue'
import { useQueryStore } from '../stores/queryStore'
import type { QueryCondition } from '../types/query'

const queryStore = useQueryStore()

const props = defineProps<{
  condition: QueryCondition
}>()

// Resolve the selected operator metadata for the current condition.
const selectedOperator = computed(() =>
  queryStore.operators.find((operator) => operator.id === props.condition.operatorId),
)

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
    <ConditionFieldInput
      :model-value="condition.field"
      :options="queryStore.uniqueFields"
      @update:model-value="queryStore.updateCondition(condition.id, { field: $event })"
    />
    <ConditionOperatorInput
      :model-value="condition.operatorId"
      :options="queryStore.operators"
      @update:model-value="queryStore.updateCondition(condition.id, { operatorId: $event })"
    />
    <ConditionValueInput
      v-if="selectedOperator"
      :model-value="condition.value"
      @update:model-value="queryStore.updateCondition(condition.id, { value: $event })"
      :operator="selectedOperator"
    />
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
