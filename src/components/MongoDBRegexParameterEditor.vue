<script setup lang="ts">
import { computed, onMounted, useId } from 'vue'
import { useQueryStore } from '../stores/queryStore'
import type { QueryCondition } from '../types/query'

const props = defineProps<{ condition: QueryCondition }>()
const queryStore = useQueryStore()
const editorId = useId()
const flags = [
  { flag: 'i', label: 'Case-insensitive (i)', help: 'Match letters without distinguishing uppercase and lowercase.' },
  { flag: 'm', label: 'Multiline anchors (m)', help: 'Allow ^ and $ to match the start and end of each line.' },
  { flag: 's', label: 'Dot matches newlines (s)', help: 'Allow a dot in the pattern to match newline characters.' },
  { flag: 'x', label: 'Ignore pattern whitespace and allow comments (x)', help: 'Ignore unescaped pattern whitespace and allow comments in the pattern.' },
] as const

// Read one native options value without altering the regex pattern or inline flags.
const options = computed(() => {
  const row = props.condition.parameters?.find(
    // Find MongoDB's single native parameter among the database-specific row types.
    (parameter) => parameter.name === '$options',
  )
  return row?.name === '$options' ? row.value : ''
})

// Keep an opened editor selected even when all four explicit controls are No.
function initialiseEditor() {
  if (!props.condition.parameters?.length) {
    queryStore.updateCondition(props.condition.id, { parameters: [{ name: '$options', value: '' }] })
  }
}
onMounted(initialiseEditor)

// Toggle a visual flag and retain imported u in the same native options string.
function toggleFlag(flag: 'i' | 'm' | 's' | 'x') {
  const enabled = new Set(options.value)
  if (enabled.has(flag)) enabled.delete(flag)
  else enabled.add(flag)
  const value = ['i', 'm', 's', 'x', 'u'].filter(
    // Serialize in a stable native flag order, including the retained Unicode flag.
    (candidate) => enabled.has(candidate),
  ).join('')
  queryStore.updateCondition(props.condition.id, { parameters: [{ name: '$options', value }] })
}
</script>

<template>
  <div class="regex-parameters" role="group" aria-label="MongoDB regular expression options">
    <div v-for="item in flags" :key="item.flag" class="regex-flag">
      <span :id="`${editorId}-${item.flag}-label`">{{ item.label }}</span>
      <button
        type="button"
        role="switch"
        :aria-labelledby="`${editorId}-${item.flag}-label`"
        :aria-describedby="`${editorId}-${item.flag}-help`"
        :aria-checked="options.includes(item.flag)"
        @click="toggleFlag(item.flag)"
      >
        {{ options.includes(item.flag) ? 'Yes' : 'No' }}
      </button>
      <p :id="`${editorId}-${item.flag}-help`" class="parameter-help">{{ item.help }}</p>
    </div>
    <p v-if="options.includes('u')" class="parameter-help">
      The imported Unicode flag (u) is retained, including when these controls are cleared.
    </p>
  </div>
</template>

<style scoped>
.regex-parameters {
  display: grid;
  gap: 0.6rem;
  margin-top: 0.75rem;
  min-width: 0;
  font-size: 0.8125rem;
}

.regex-flag {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.4rem;
  overflow-wrap: anywhere;
}

button {
  box-sizing: border-box;
  min-width: 3rem;
  padding: 0.45rem;
  border: 1px solid var(--border-control);
  border-radius: 4px;
  background: var(--surface-input);
  color: var(--text-primary);
  font: inherit;
  cursor: pointer;
}

button[aria-checked='true'] {
  background: var(--surface-control-strong-selected);
  color: var(--text-control-strong-selected);
}

button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.parameter-help {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--text-control-muted);
  overflow-wrap: anywhere;
}
</style>
