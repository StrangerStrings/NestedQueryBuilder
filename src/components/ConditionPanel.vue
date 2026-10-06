<script setup lang="ts">
import { computed } from 'vue'
import ConditionFieldInput from './ConditionFieldInput.vue'
import ConditionOperatorInput from './ConditionOperatorInput.vue'
import ConditionValueInput from './ConditionValueInput/ConditionValueInput.vue'
import QueryDisplay from './QueryDisplay.vue'
import { useQueryStore } from '../stores/queryStore'
import type { QueryCondition } from '../types/query'
import { exportWhereCondition } from '../databases/postgresql/serialisation/exportWhereCondition'
import { serializeWhereExpression } from '../databases/postgresql/serialisation/serializeWhereExpression'

const queryStore = useQueryStore()

const props = defineProps<{
  condition: QueryCondition
}>()

// Resolve the selected operator metadata for the current condition.
const selectedOperator = computed(() =>
  queryStore.operators.find((operator) => operator.id === props.condition.operatorId),
)

// Render only the selected condition with the same validation and SQL formatting as the query preview.
const conditionSql = computed(() => {
  if (queryStore.database !== 'postgresql') return null
  const exported = exportWhereCondition(props.condition)
  return exported.success ? serializeWhereExpression(exported.expression) : exported
})

// Match the condition's visible border, including its incomplete-state colour.
const borderColour = computed(() =>
  !props.condition.field.trim() || !selectedOperator.value
    ? '#9ca3af'
    : queryStore.getConditionColour(props.condition)?.accent ?? '#94a3b8',
)

// Use half the condition's background opacity without fading the panel's contents.
const backgroundColour = computed(() => {
  const colour =
    !props.condition.field.trim() || !selectedOperator.value
      ? '#f3f4f6'
      : queryStore.getConditionColour(props.condition)?.background ?? '#f8fafc'
  return `color-mix(in srgb, ${colour} 50%, transparent)`
})

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <aside
    class="condition-panel"
    :style="{ borderColor: borderColour, backgroundColor: backgroundColour }"
    aria-label="Condition details"
  >
    <div class="panel-header">
      <h3></h3>
      <button type="button" aria-label="Close condition details" @click="emit('close')">
        <span class="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
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
      :key="condition.id"
      :model-value="condition.value"
      @update:model-value="queryStore.updateCondition(condition.id, { value: $event })"
      @type-change="queryStore.changeConditionValueType(condition.id, $event)"
      :operator="selectedOperator"
    />
    <section v-if="conditionSql" class="condition-preview" aria-label="Condition SQL preview">
      <h4>Generated {{ queryStore.database }}</h4>
      <div aria-live="polite" aria-atomic="true">
        <QueryDisplay
          v-if="conditionSql.success"
          class="condition-sql"
          :query-text="conditionSql.sql"
          language="sql"
          accessible-label="Generated PostgreSQL condition"
        />
        <p v-else>{{ conditionSql.error }}</p>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.condition-panel {
  width: 22rem;
  max-width: 100%;
  box-sizing: border-box;
  padding: 1rem;
  border: 4px solid #d9dee7;
  border-radius: 22px;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: #5b6472;
  cursor: pointer;
}

button .material-symbols-outlined {
  font-size: 1.125rem;
}

.condition-preview {
  margin: 2.5rem -1rem 0;
  padding: 1rem 1rem;
  border-top: 2px solid v-bind(borderColour);
}

.condition-preview h4 {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  font-weight: normal;
  color: v-bind(borderColour);
}

.condition-preview p {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.condition-sql :deep(pre) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
