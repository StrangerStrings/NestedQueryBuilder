<script setup lang="ts">
defineProps<{
  id: string
  text: string
  label: string
}>()

const expanded = defineModel<boolean>({ default: false })

// Toggle the help text while keeping the parent informed for accessible descriptions.
function toggleHelp() {
  expanded.value = !expanded.value
}
</script>

<template>
  <div class="help-box" :class="{ 'is-expanded': expanded }">
    <button
      type="button"
      class="help-toggle"
      :aria-label="`${expanded ? 'Hide' : 'Expand'} ${label}`"
      :aria-expanded="expanded"
      :aria-controls="id"
      @click="toggleHelp"
    >
      <span class="material-symbols-outlined" aria-hidden="true">info</span>
      <span class="help-label">{{ expanded ? 'Hide' : 'Expand' }}</span>
    </button>
    <p v-show="expanded" :id="id" class="help-text">{{ text }}</p>
  </div>
</template>

<style scoped>
.help-box {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: fit-content;
  max-width: 100%;
  box-sizing: border-box;
  margin: 0.75rem 0;
  padding: 0.375rem;
  border: 1px solid var(--border-panel);
  border-radius: 0.375rem;
  background: var(--surface-help);
}

.help-box.is-expanded {
  width: 100%;
}

.help-label {
  color: var(--text-help-label);
  font-weight: 300;
}

.help-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  flex-shrink: 0;
  padding: 0.375rem;
  border: 0;
  border-radius: 0.25rem;
  color: var(--text-muted);
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.help-toggle:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.help-text {
  margin: 0.5rem;
  color: var(--text-muted);
  font-size: 0.875rem;
  line-height: 1.5;
}
</style>
