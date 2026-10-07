import { defineStore } from 'pinia'
import { ref } from 'vue'

// Store operator display preferences and the builder's drag-and-drop mode.
export const useSettingsStore = defineStore('settings', () => {
  const showOperatorLabels = ref(false)
  const dragAndDropMode = ref(false)

  return { showOperatorLabels, dragAndDropMode }
})
