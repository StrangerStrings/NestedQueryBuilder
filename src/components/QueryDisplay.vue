<script setup lang="ts">
import { ref, watch } from 'vue'
import { getQueryHighlighter } from '../utils/queryHighlighter'

const props = defineProps<{
  queryText: string
  language: 'sql' | 'json'
  accessibleLabel: string
}>()

const highlightedHtml = ref('')

// Highlight reactive query changes, ignoring stale work and keeping plain text on failure.
watch(
  // Track the text and language together so either change refreshes the display.
  () => [props.queryText, props.language] as const,
  // Keep plain text visible until the latest highlighting request succeeds.
  async ([queryText, language], _previous, onCleanup) => {
    let active = true
    // Discard pending results when the props change or the component unmounts.
    onCleanup(() => {
      active = false
    })
    highlightedHtml.value = ''

    try {
      const highlighter = await getQueryHighlighter()
      if (!active) return
      highlightedHtml.value = highlighter.codeToHtml(queryText, {
        lang: language,
        theme: 'github-light',
      })
    } catch {
      if (active) highlightedHtml.value = ''
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="query-display"
    role="region"
    :aria-label="accessibleLabel"
    tabindex="0"
  >
    <div v-if="highlightedHtml" v-html="highlightedHtml" />
    <pre v-else><code>{{ queryText }}</code></pre>
  </div>
</template>

<style scoped>
.query-display {
  max-height: 24rem;
  min-width: 0;
  padding: 0.75rem;
  overflow: auto;
  border: 1px solid #c5ccd8;
  border-radius: 4px;
  background: #fff;
  color: #172033;
  font-size: 0.875rem;
}

.query-display:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.query-display :deep(pre) {
  margin: 0;
  white-space: pre;
}

.query-display :deep(code) {
  font-family: monospace;
}
</style>
