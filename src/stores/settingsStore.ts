import { defineStore } from 'pinia'
import { ref } from 'vue'

// Store whether operators should use labels instead of database syntax.
export const useSettingsStore = defineStore('settings', () => {
  const showOperatorLabels = ref(false)

  return { showOperatorLabels }
})
