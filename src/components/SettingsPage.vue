<script setup lang="ts">
import { useQueryStore } from '../stores/queryStore'
import { useSettingsStore } from '../stores/settingsStore'

const queryStore = useQueryStore()
const settingsStore = useSettingsStore()
</script>

<template>
  <section aria-labelledby="settings-heading">
    <h2 id="settings-heading">Settings</h2>
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
          {{ queryStore.database }}
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
.operators-display {
  margin: 0;
  padding: 1rem;
  border: 1px solid #d9dee7;
  border-radius: 0.5rem;
  background: #fff;
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
  accent-color: #2563eb;
}
</style>
