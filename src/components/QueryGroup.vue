<script setup lang="ts">
import { useQueryStore } from '../stores/queryStore'
import QueryCondition from './QueryCondition.vue'
import type { QueryCondition as QueryConditionModel, QueryGroup as QueryGroupModel } from '../types/query'
import type { QueryNode } from '../types/query'

const props = withDefaults(
  defineProps<{
    group: QueryGroupModel
    canDelete?: boolean
  }>(),
  { canDelete: false },
)

const queryStore = useQueryStore()

const emit = defineEmits<{
  select: [condition: QueryConditionModel]
}>()

function isQueryCondition(child: QueryNode): child is QueryConditionModel {
  return child.kind === 'condition'
}
</script>

<template>
  <section class="query-group">
    <div class="group-header">
      <h3>{{ group.mode }}</h3>
      <button
        type="button"
        aria-label="Cycle group mode"
        @click="queryStore.cycleGroupMode(group.id)"
      >
        Cycle mode
      </button>
      <button
        type="button"
        class="icon-button"
        aria-label="Add condition"
        @click="queryStore.addCondition(group.id)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">add_box</span>
      </button>
      <button
        type="button"
        class="icon-button"
        aria-label="Add child group"
        @click="queryStore.addGroup(group.id)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">library_add</span>
      </button>
      <button
        v-if="props.canDelete"
        type="button"
        class="icon-button"
        aria-label="Delete group"
        @click="queryStore.removeNode(group.id)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">delete</span>
      </button>
    </div>
    <div class="children">
      <template v-for="child in group.children" :key="child.id">
        <QueryCondition
          v-if="isQueryCondition(child)"
          :condition="child"
          editable
          @select="emit('select', $event)"
        />
        <QueryGroup v-else :group="child" can-delete @select="emit('select', $event)" />
      </template>
    </div>
  </section>
</template>

<style scoped>
.query-group {
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid #d9dee7;
  border-radius: 4px;
  background: #fff;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  text-transform: capitalize;
}

.children {
  display: grid;
  gap: 0.5rem;
}

button {
  padding: 0.35rem 0.6rem;
  border: 1px solid #c5ccd8;
  border-radius: 4px;
  background: transparent;
  color: #5b6472;
  cursor: pointer;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #5b6472;
}

.icon-button:hover,
.icon-button:focus-visible {
  background: #eef1f5;
  color: #172033;
}

.material-symbols-outlined {
  font-size: 1.3rem;
}
</style>