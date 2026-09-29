<script setup lang="ts">
import { computed } from 'vue'
import { useQueryStore } from '../stores/queryStore'
import type { QueryCondition } from '../types/query'

const props = defineProps<{
  condition: QueryCondition
  editable?: boolean
}>()

const queryStore = useQueryStore()
const operatorLabel = computed(
  () => queryStore.operators.find((operator) => operator.id === props.condition.operatorId)?.label
    ?? props.condition.operatorId,
)

const emit = defineEmits<{
  select: [condition: QueryCondition]
}>()
</script>

<template>
  <button
    type="button"
    class="query-condition"
    :disabled="!editable"
    @click="emit('select', condition)"
  >
    <span>{{ condition.field || 'Select a field' }}</span>
    <span>{{ operatorLabel }}</span>
    <span v-if="condition.value">{{ condition.value }}</span>
  </button>
</template>

<style scoped>
.query-condition {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid #d9dee7;
  border-radius: 4px;
  background: #f8fafc;
  color: #172033;
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.query-condition:enabled:hover,
.query-condition:focus-visible {
  border-color: #2563eb;
}

.query-condition:disabled {
  cursor: default;
}

.placeholder {
  color: #5b6472;
  font-size: 0.875rem;
}
</style>
