<script setup lang="ts">
import { useQueryStore } from '../../stores/queryStore'

defineProps<{ modelValue: boolean }>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
const queryStore = useQueryStore()

// Treat each Boolean choice as a discrete action after any pending input finalization.
function chooseValue(value: boolean) {
  // Keep the model emission inside the store's balanced action boundary.
  queryStore.runQueryAction('change boolean value', () => {
    emit('update:modelValue', value)
  })
}
</script>

<template>
  <div class="boolean-value-input" role="group">
    <button type="button" :aria-pressed="modelValue" @click="chooseValue(true)">
      True
    </button>
    <button type="button" :aria-pressed="!modelValue" @click="chooseValue(false)">
      False
    </button>
  </div>
</template>

<style scoped>
.boolean-value-input {
  display: flex;
}

button {
  flex: 1;
  padding: 0.45rem;
  border: 1px solid var(--border-control);
  background: var(--surface-control);
  color: inherit;
  font: inherit;
  cursor: pointer;
}

button:first-child {
  border-radius: 4px 0 0 4px;
}

button:last-child {
  border-left: 0;
  border-radius: 0 4px 4px 0;
}

button:hover {
  background: var(--surface-control-hover);
}

button[aria-pressed='true'] {
  background: var(--surface-control-selected);
  font-weight: 600;
}

button:focus-visible {
  position: relative;
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
</style>
