<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import ElasticsearchParameterEditor from './ElasticsearchParameterEditor.vue'
import MongoDBRegexParameterEditor from './MongoDBRegexParameterEditor.vue'
import { useQueryStore } from '../stores/queryStore'
import { getElasticsearchParameterNames } from '../databases/elasticsearch/parameters'
import type { QueryCondition } from '../types/query'

const props = defineProps<{ condition: QueryCondition }>()
const queryStore = useQueryStore()
const parameterEditorId = useId()
const parametersExpanded = ref(false)
const parametersControl = ref<HTMLButtonElement | null>(null)

// Offer database-specific parameters only for compatible visual conditions.
const supportsParameters = computed(
  () =>
    props.condition.rawSql === undefined && (
      (queryStore.database === 'elasticsearch' &&
        getElasticsearchParameterNames(props.condition.operatorId).length > 0) ||
      (queryStore.database === 'mongodb' && props.condition.operatorId === 'regex')
    ),
)

// Reopen configured conditions without changing their stored rows.
watch(
  // Track selection, operator transitions and database changes.
  () => [props.condition.id, props.condition.operatorId, queryStore.database],
  // Reflect the parameters retained by the store after a transition.
  () => {
    parametersExpanded.value = supportsParameters.value && !!props.condition.parameters?.length
  },
  { immediate: true },
)

// Expand configured parameters and close the section when the last row is removed.
watch(
  // Observe configured rows without treating their values as Boolean flags.
  () => props.condition.parameters?.length ?? 0,
  // Return focus to the toggle before removing an empty editor.
  (count) => {
    if (
      count === 0 &&
      document.getElementById(parameterEditorId)?.contains(document.activeElement)
    ) {
      parametersControl.value?.focus()
    }
    parametersExpanded.value = count > 0 && supportsParameters.value
  },
)

// Clear explicit controls on collapse while preserving MongoDB's imported Unicode flag.
function toggleParameters() {
  if (parametersExpanded.value) {
    const options = props.condition.parameters?.find(
      // Preserve u separately from the four editable flags.
      (parameter) => parameter.name === '$options',
    )
    queryStore.updateCondition(props.condition.id, {
      parameters: queryStore.database === 'mongodb' && options?.name === '$options' && options.value.includes('u')
        ? [{ name: '$options', value: 'u' }]
        : [],
    })
  }
  parametersExpanded.value = !parametersExpanded.value
}
</script>

<template>
  <div v-if="supportsParameters" class="optional-parameters">
    <button
      ref="parametersControl"
      type="button"
      class="parameters-control"
      :class="{ 'is-expanded': parametersExpanded }"
      :aria-expanded="parametersExpanded"
      :aria-controls="parameterEditorId"
      @click="toggleParameters"
    >
      <span class="material-symbols-outlined" aria-hidden="true">settings</span>
      Optional Parameters
    </button>
    <div :id="parameterEditorId" v-show="parametersExpanded">
      <ElasticsearchParameterEditor
        v-if="parametersExpanded && queryStore.database === 'elasticsearch'"
        :key="condition.id"
        :condition="condition"
      />
      <MongoDBRegexParameterEditor
        v-if="parametersExpanded && queryStore.database === 'mongodb'"
        :key="condition.id"
        :condition="condition"
      />
    </div>
  </div>
</template>

<style scoped>
.optional-parameters {
  margin-top: 0.5rem;
}

.parameters-control {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0;
  border: 0;
  background: transparent;
  color: var(--text-control-muted);
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
}

.parameters-control.is-expanded {
  color: var(--text-primary);
}

.parameters-control:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.parameters-control .material-symbols-outlined {
  font-size: 1.125rem;
}
</style>
