<script setup lang="ts">
import { useQueryStore } from '../stores/queryStore'
import QueryCondition from './QueryCondition.vue'
import type {
  QueryCondition as QueryConditionModel,
  QueryGroup as QueryGroupModel,
} from '../types/query'
import type { QueryNode } from '../types/query'

const props = withDefaults(
  defineProps<{
    group: QueryGroupModel
    canDelete?: boolean
    selectedConditionId?: string
  }>(),
  { canDelete: false },
)

const queryStore = useQueryStore()

const emit = defineEmits<{
  select: [condition: QueryConditionModel]
}>()

// Select the new condition through the existing event flow, including in nested groups.
function addCondition() {
  const condition = queryStore.addCondition(props.group.id)
  if (condition) emit('select', condition)
}

// Select the initial condition created inside a new child group.
function addGroup() {
  const condition = queryStore.addGroup(props.group.id)
  if (condition) emit('select', condition)
}

// Narrow child nodes to conditions before rendering their editable button.
function isQueryCondition(child: QueryNode): child is QueryConditionModel {
  return child.kind === 'condition'
}
</script>

<template>
  <section class="query-group" :class="`mode-${group.mode}`">
    <button
      type="button"
      class="mode-badge"
      aria-label="Cycle group mode"
      @click="queryStore.cycleGroupMode(group.id)"
    >
      <h3>{{ group.mode }}</h3>
    </button>
    <div class="children">
      <template v-for="child in group.children" :key="child.id">
        <QueryCondition
          v-if="isQueryCondition(child)"
          :condition="child"
          :selected="child.id === selectedConditionId"
          editable
          @select="emit('select', $event)"
        />
        <QueryGroup
          v-else
          :group="child"
          :selected-condition-id="selectedConditionId"
          can-delete
          @select="emit('select', $event)"
        />
      </template>
    </div>
    <div class="group-actions" :class="{ 'root-group-actions': group.id === queryStore.query.id }">
      <button
        type="button"
        class="icon-button"
        aria-label="Add condition"
        @click="addCondition"
      >
        <span class="material-symbols-outlined" aria-hidden="true">add_box</span>
      </button>
      <button
        type="button"
        class="icon-button"
        aria-label="Add child group"
        @click="addGroup"
      >
        <span class="material-symbols-outlined" aria-hidden="true">library_add</span>
      </button>
      <button
        v-if="props.canDelete"
        type="button"
        class="icon-button delete-group-button"
        aria-label="Delete group"
        @click="queryStore.removeNode(group.id)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">delete</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.query-group {
  --group-border-color: #bcc4cf;
  --group-border-color: #949eac;
  --mode-badge-color: #949eac;
  position: relative;
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem 1.2rem 2.75rem 2.3rem;
  margin: 5px 0;
  border: 4px solid var(--group-border-color);
  border-radius: 36px;
  background: #fff;
}

.query-group.mode-all {
  --group-border-color: #858e9b;
  --group-border-color: #707987;
  --mode-badge-color: #707987;
}

.query-group.mode-none {
  --group-border-color: #4a5361;
  --mode-badge-color: #4a5361;
}

.group-actions {
  position: absolute;
  right: 0.75rem;
  bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.root-group-actions {
  margin-right: 53px;
}

.mode-badge {
  position: absolute;
  top: 50%;
  left: -1.2rem;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.35rem;
  border: 4px solid var(--mode-badge-color);
  border-radius: 16px;
  color: var(--mode-badge-color);
  background: #fff;
  font-family: inherit;
  cursor: pointer;
}

h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  text-transform: uppercase;
  writing-mode: vertical-rl;
  text-orientation: upright;
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

.delete-group-button {
  opacity: 0;
  pointer-events: none;
}

.query-group:hover:not(:has(.query-group:hover, .query-condition:hover))
  > .group-actions
  > .delete-group-button {
  opacity: 1;
  pointer-events: auto;
}

.material-symbols-outlined {
  font-size: 1.3rem;
}
</style>
