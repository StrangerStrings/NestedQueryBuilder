<script setup lang="ts">
import { useQueryStore } from '../stores/queryStore'
import { useSettingsStore } from '../stores/settingsStore'

const queryStore = useQueryStore()
const settingsStore = useSettingsStore()
</script>

<template>
  <section aria-labelledby="settings-heading">
    <h2 id="settings-heading">Settings</h2>
    <fieldset class="appearance">
      <legend>Appearance</legend>
      <div class="display-options">
        <label for="appearance-system">
          <input
            id="appearance-system"
            v-model="settingsStore.themePreference"
            type="radio"
            name="appearance"
            value="system"
          />
          System
        </label>
        <label for="appearance-light">
          <input
            id="appearance-light"
            v-model="settingsStore.themePreference"
            type="radio"
            name="appearance"
            value="light"
          />
          Light
        </label>
        <label for="appearance-dark">
          <input
            id="appearance-dark"
            v-model="settingsStore.themePreference"
            type="radio"
            name="appearance"
            value="dark"
          />
          Dark
        </label>
      </div>
    </fieldset>
    <fieldset class="operators-display">
      <legend>Operators display</legend>
      <div class="display-options">
        <label>
          <input
            v-model="settingsStore.showOperatorLabels"
            type="radio"
            name="operators-display"
            :value="false"
          />
          {{ queryStore.adapter.label }} ID
        </label>
        <label>
          <input
            v-model="settingsStore.showOperatorLabels"
            type="radio"
            name="operators-display"
            :value="true"
          />
          Label
        </label>
      </div>
    </fieldset>
  </section>
</template>

<style scoped>
fieldset {
  margin: 0;
  padding: 1rem;
  border: 1px solid var(--border-panel);
  border-radius: 0.5rem;
  background: var(--surface-panel);
}

.appearance {
  margin-bottom: 1rem;
}

legend {
  padding: 0 0.25rem;
  font-weight: 600;
}

.display-options {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}

label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

input {
  margin: 0;
  accent-color: var(--accent-primary);
}

input:focus-visible {
  outline: 2px solid var(--focus-ring-accent);
  outline-offset: 3px;
}
</style>
