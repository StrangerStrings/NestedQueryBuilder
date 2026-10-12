import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

type ThemePreference = 'system' | 'light' | 'dark'
type ResolvedTheme = 'light' | 'dark'

// Store display preferences and synchronize appearance without changing query state.
export const useSettingsStore = defineStore('settings', () => {
  const showOperatorLabels = ref(false)
  const dragAndDropMode = ref(false)
  const selectedPreference = ref<ThemePreference>('system')
  const resolvedTheme = ref<ResolvedTheme>('light')
  let appearanceInitialized = false
  let systemAppearance: MediaQueryList | null = null

  try {
    showOperatorLabels.value = localStorage.getItem('query-builder.showOperatorLabels') === 'true'
  } catch {
    // Keep labels off when storage is unavailable.
  }

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
    document.documentElement.dataset.themePreference = selectedPreference.value
  }

  // Resolve explicit choices or the current operating-system appearance.
  function resolveAppearance(): ResolvedTheme {
    if (selectedPreference.value !== 'system') return selectedPreference.value
    return systemAppearance?.matches ? 'dark' : 'light'
  }

  // Follow system changes only while the selected preference is System.
  function handleSystemAppearanceChange() {
    if (selectedPreference.value === 'system') applyAppearance(resolveAppearance())
  }

  // Adopt the early head-script snapshot and own one subscription for the app lifetime.
  function initializeAppearance() {
    if (appearanceInitialized) return
    appearanceInitialized = true
    const root = document.documentElement
    const preference = root.dataset.themePreference
    selectedPreference.value =
      preference === 'light' || preference === 'dark' ? preference : 'system'
    applyAppearance(root.dataset.theme === 'dark' ? 'dark' : 'light')
    try {
      systemAppearance = window.matchMedia('(prefers-color-scheme: dark)')
      systemAppearance.addEventListener('change', handleSystemAppearanceChange)
    } catch {
      // Appearance detection and subscriptions are optional browser capabilities.
    }
    // Catch any system appearance change between the head snapshot and subscription.
    handleSystemAppearanceChange()
  }

  // Switch immediately and persist only the preference; storage failures are harmless.
  function setThemePreference(preference: ThemePreference) {
    selectedPreference.value = preference
    applyAppearance(resolveAppearance())
    try {
      localStorage.setItem('query-builder.theme', preference)
    } catch {
      // Keep the in-memory selection when storage is unavailable.
    }
  }

  const themePreference = computed({
    // Expose the selected choice separately from its resolved appearance.
    get: () => selectedPreference.value,
    set: setThemePreference,
  })

  return {
    showOperatorLabels,
    dragAndDropMode,
    themePreference,
    resolvedTheme,
    initializeAppearance,
  }
})
