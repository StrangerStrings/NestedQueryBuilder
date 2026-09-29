<script setup lang="ts">
import { useQueryStore } from '../stores/queryStore'

defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const queryStore = useQueryStore()
</script>

<template>
  <label class="condition-operator">
    <span>Operator</span>
    <select
      :value="modelValue"
      aria-label="Operator"
      :disabled="queryStore.operators.length === 0"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="operator in queryStore.operators" :key="operator.id" :value="operator.id">
        {{ operator.label }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.condition-operator {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.75rem;
  color: #172033;
  font-size: 0.875rem;
}

select {
  width: 100%;
  padding: 0.45rem;
  border: 1px solid #c5ccd8;
  border-radius: 4px;
  background: #fff;
  color: inherit;
  font: inherit;
}
</style>
