import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

type ResolvedTheme = 'light' | 'dark'

// Store display preferences and synchronize appearance without changing query state.
export const useSettingsStore = defineStore('settings', () => {
  const showOperatorLabels = ref(false)
  const groupOperatorMode = ref(false)
  const dragAndDropMode = ref(false)
  const resolvedTheme = ref<ResolvedTheme>('light')

  try {
    showOperatorLabels.value = localStorage.getItem('query-builder.showOperatorLabels') === 'true'
  } catch {
    // Keep labels off when storage is unavailable.
  }

  try {
    groupOperatorMode.value = localStorage.getItem('query-builder.groupOperatorMode') === 'true'
  } catch {
    // Keep the default group labels when storage is unavailable.
  }

  // Save group label preferences without changing the query's logical modes.
  watch(
    groupOperatorMode,
    (enabled) => {
      try {
        localStorage.setItem('query-builder.groupOperatorMode', String(enabled))
      } catch {
        // Keep the in-memory preference when storage is unavailable.
      }
    },
    { flush: 'sync' },
  )

  // Persist label changes immediately while keeping the toggle usable without storage.
  watch(
    showOperatorLabels,
    (showLabels) => {
      try {
        localStorage.setItem('query-builder.showOperatorLabels', String(showLabels))
      } catch {
        // Keep the in-memory selection when storage is unavailable.
      }
    },
    { flush: 'sync' },
  )

  // Apply presentation changes directly to the root without remounting views.
  function applyAppearance(appearance: ResolvedTheme) {
    resolvedTheme.value = appearance
    document.documentElement.dataset.theme = appearance
  }

  // Adopt the saved theme applied by the early head script.
  function initializeAppearance() {
    applyAppearance(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  }

  // Apply a manual theme choice immediately and save it for future visits.
  function setTheme(appearance: ResolvedTheme) {
    applyAppearance(appearance)
    try {
      localStorage.setItem('query-builder.theme', appearance)
    } catch {
      // Keep the in-memory selection when storage is unavailable.
    }
  }

  return {
    showOperatorLabels,
    groupOperatorMode,
    dragAndDropMode,
    setTheme,
    resolvedTheme,
    initializeAppearance,
  }
})
