<script setup lang="ts">
import { useSettingsStore } from '../stores/settingsStore'

const settingsStore = useSettingsStore()

// Toggle the saved mode flag for future drag-and-drop behaviour.
function toggleDragAndDropMode() {
  settingsStore.dragAndDropMode = !settingsStore.dragAndDropMode
}

// Switch from the current appearance and persist the chosen light or dark theme.
function toggleDarkMode() {
  settingsStore.themePreference = settingsStore.resolvedTheme === 'dark' ? 'light' : 'dark'
}

// Switch operator text between readable labels and database identifiers.
function toggleOperatorLabels() {
  settingsStore.showOperatorLabels = !settingsStore.showOperatorLabels
}

// Switch group badges between readable modes and logical operators.
function toggleGroupOperatorMode() {
  settingsStore.groupOperatorMode = !settingsStore.groupOperatorMode
}
</script>

<template>
  <div class="builder-controls" role="group" aria-label="Builder display settings">
    <button
      type="button"
      class="builder-control"
      aria-label="Drag Pan"
      :aria-pressed="settingsStore.dragAndDropMode"
      title="Drag Pan"
      @click="toggleDragAndDropMode"
    >
      <span class="material-symbols-outlined" aria-hidden="true">drag_pan</span>
    </button>
    <button
      type="button"
      class="builder-control"
      aria-label="Dark mode"
      :aria-pressed="settingsStore.resolvedTheme === 'dark'"
      :title="
        settingsStore.resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
      "
      @click="toggleDarkMode"
    >
      <span class="material-symbols-outlined" aria-hidden="true">
        {{ settingsStore.resolvedTheme === 'dark' ? 'dark_mode' : 'light_mode' }}
      </span>
    </button>
    <button
      type="button"
      class="builder-control"
      aria-label="Operator labels"
      :aria-pressed="settingsStore.showOperatorLabels"
      :title="settingsStore.showOperatorLabels ? 'Hide operator labels' : 'Show operator labels'"
      @click="toggleOperatorLabels"
    >
      <span class="material-symbols-outlined" aria-hidden="true">label</span>
    </button>
    <button
      type="button"
      class="builder-control"
      aria-label="Group operator mode"
      :aria-pressed="settingsStore.groupOperatorMode"
      :title="settingsStore.groupOperatorMode ? 'Show ALL, ANY, NONE' : 'Show AND, OR, NOR'"
      @click="toggleGroupOperatorMode"
    >
      <span class="material-symbols-outlined" aria-hidden="true">account_tree</span>
    </button>
  </div>
</template>

<style scoped>
.builder-controls {
  display: flex;
  gap: 0.5rem;
}

.builder-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  padding: 0;
  border: 1px solid currentColor;
  border-radius: 50%;
  background: var(--surface-button);
  color: var(--text-muted);
  cursor: pointer;
}

.builder-control[aria-pressed='false'] {
  color: var(--text-inactive);
}

.builder-control[aria-pressed='true'] {
  color: var(--accent-neutral);
}

.builder-control:focus-visible {
  outline: 2px solid var(--accent-neutral);
  outline-offset: 3px;
}

@media (width < 768px) {
  .builder-controls {
    flex-wrap: wrap;
  }

  .builder-control {
    width: 44px;
    height: 44px;
  }
}
</style>
