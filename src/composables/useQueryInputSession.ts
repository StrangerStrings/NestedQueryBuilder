import { onBeforeUnmount, watch } from 'vue'
import { useQueryStore } from '../stores/queryStore'

// Share input-session ownership while leaving value normalization and UI behavior with the editor.
export function useQueryInputSession(description: string, finalize?: () => void) {
  const queryStore = useQueryStore()
  let ownedSessionKey: string | undefined

  // Discard ownership without committing a draft after history restores the query.
  function releaseEditing() {
    ownedSessionKey = undefined
  }

  // Release ownership before normalizing so nested updates cannot finalize the same draft twice.
  function finalizeEditing() {
    if (ownedSessionKey === undefined) return
    releaseEditing()
    finalize?.()
  }

  // Capture the first change and retain the accepted key until this input session ends.
  function beginEditing(key: string) {
    const ownsSession = queryStore.beginInputSession(key, description, finalizeEditing)
    ownedSessionKey = ownsSession ? key : undefined
  }

  // Finish only this editor's session on blur, Enter, or unmount.
  function finishEditing() {
    if (ownedSessionKey !== undefined) queryStore.finishInputSession(ownedSessionKey)
  }

  // Invalidate ownership before a restored query can trigger a late blur or unmount.
  watch(() => queryStore.restorationRevision, releaseEditing, { flush: 'sync' })
  onBeforeUnmount(finishEditing)

  return { beginEditing, finishEditing }
}
