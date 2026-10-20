import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useQueryStore } from '../stores/queryStore'

// Own application history shortcuts and provide announcement text for the existing status regions.
export function useQueryHistoryShortcuts() {
  const queryStore = useQueryStore()
  const historyAnnouncement = ref('')
  const isMac = /Mac/.test(navigator.platform)

  // Override query text undo while leaving import drafts and composition to the browser.
  async function handleQueryHistory(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.altKey) return
    if (isMac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) return
    if (event.target instanceof Element && event.target.closest('[data-native-history]')) return

    const key = event.key.toLowerCase()
    const undo = key === 'z' && !event.shiftKey
    const redo = (key === 'z' && event.shiftKey) || (!isMac && key === 'y' && !event.shiftKey)
    if (!undo && !redo) return

    event.preventDefault()
    const description = undo ? queryStore.undo() : queryStore.redo()
    if (!description) return

    // Render an empty status first so identical completions are announced again.
    historyAnnouncement.value = ''
    await nextTick()
    historyAnnouncement.value = `${undo ? 'Undid' : 'Redid'} ${description}.`
  }

  // Register shortcuts once when the owning application component mounts.
  onMounted(() => {
    window.addEventListener('keydown', handleQueryHistory)
  })

  // Release the listener when the owning application component is removed.
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleQueryHistory)
  })

  return { historyAnnouncement }
}
