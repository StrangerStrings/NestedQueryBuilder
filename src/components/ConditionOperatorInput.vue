<script setup lang="ts">
import { computed } from 'vue'
import { useQueryStore } from '../stores/queryStore'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const queryStore = useQueryStore()

// Read the description for the currently selected operator.
const operatorDescription = computed(() =>
  queryStore.operators.find((operator) => operator.id === props.modelValue)?.description ?? '',
)
</script>

<template>
  <div class="condition-operator">
    <span>Operator</span>
    <div class="operator-input-row">
      <select
        :value="modelValue"
        aria-label="Operator"
        :disabled="queryStore.operators.length === 0"
        @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="operator in queryStore.operators" :key="operator.id" :value="operator.id">
          {{ operator.id }} ({{ operator.label }})
        </option>
      </select>
      <span class="operator-info-wrapper">
        <span
          class="operator-info material-symbols-outlined"
          role="img"
          aria-label="Operator information"
        >
          info
        </span>
        <span v-if="operatorDescription" class="operator-tooltip">
          {{ operatorDescription }}
        </span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.condition-operator {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.75rem;
  color: #172033;
  font-size: 0.875rem;
}

.operator-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.operator-info-wrapper {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.operator-info {
  color: #5b6472;
  font-size: 1.125rem;
  cursor: help;
}

.operator-tooltip {
  position: absolute;
  top: calc(100% + 1rem);
  right: 0;
  z-index: 20;
  width: 16rem;
  max-width: calc(100vw - 2rem);
  box-sizing: border-box;
  padding: 0.6rem 0.75rem;
  border-radius: 4px;
  background: #172033;
  color: #fff;
  box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
  font-size: 0.8125rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.12s;
}

.operator-info-wrapper:hover .operator-tooltip {
  visibility: visible;
  opacity: 1;
}

select {
  flex: 1;
  min-width: 0;
  width: 100%;
  padding: 0.45rem;
  border: 1px solid #c5ccd8;
  border-radius: 4px;
  background: #fff;
  color: inherit;
  font: inherit;
}
</style>
