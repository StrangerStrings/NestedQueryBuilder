<script setup lang="ts">
import { ref, watch } from 'vue'
import { getQueryHighlighter } from '../utils/queryHighlighter'
import { useSettingsStore } from '../stores/settingsStore'

const props = defineProps<{
  queryText: string
  language: 'sql' | 'json'
  accessibleLabel: string
}>()

const highlightedHtml = ref('')
const settingsStore = useSettingsStore()

// Highlight query and appearance changes, ignoring stale work and retaining plain text on failure.
watch(
  // Track text, language, and resolved appearance together to refresh either preview.
  () => [props.queryText, props.language, settingsStore.resolvedTheme] as const,
  // Capture the appearance and show plain text until the latest active request succeeds.
  async ([queryText, language, appearance], _previous, onCleanup) => {
    let active = true
    // Discard pending results when text, language, or appearance changes, or on unmount.
    onCleanup(() => {
      active = false
    })
    highlightedHtml.value = ''

    try {
      const highlighter = await getQueryHighlighter()
      if (!active) return
      highlightedHtml.value = highlighter.codeToHtml(queryText, {
        lang: language,
        theme: appearance === 'dark' ? 'github-dark' : 'github-light',
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
  border: 1px solid var(--border-control);
  border-radius: 4px;
  background: var(--surface-preview);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.query-display:focus-visible {
  outline: 2px solid var(--focus-ring-accent);
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
