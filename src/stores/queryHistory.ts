import { computed, ref, shallowRef, type Ref } from 'vue'
import type { QueryGroup } from '../types/query'

const HISTORY_LIMIT = 25

type QueryHistoryAction = {
  description: string
  before: QueryGroup
  after: QueryGroup
}

type PendingQueryAction = Pick<QueryHistoryAction, 'description' | 'before'>
type QueryInputSession = PendingQueryAction & { key: string; finalize?: () => void }

type QueryHistoryHooks = {
  /** Settle derived query data before copying a snapshot. */
  beforeCapture: () => void
  /** Reconcile derived data after input normalization, before recording the action. */
  beforeInputComplete: (before: QueryGroup) => void
  /** Reset derived-data tracking before notifying editors of restoration. */
  afterRestore: () => void
}

// Copy the plain query data without losing undefined properties or invalid numeric drafts.
export function copyQueryData<T>(value: T): T {
  if (Array.isArray(value)) return value.map(copyQueryData) as T
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      // Recursively detach every nested query property, including colour maps.
      Object.entries(value).map(([key, entry]) => [key, copyQueryData(entry)]),
    ) as T
  }
  return value
}

// Compare query structure and optional property presence without serializing editable values.
export function queryDataEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object')
    return false
  if (Array.isArray(left) !== Array.isArray(right)) return false
  if (Array.isArray(left) && Array.isArray(right) && left.length !== right.length) return false

  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const keys = Object.keys(leftRecord)
  return (
    keys.length === Object.keys(rightRecord).length &&
    keys.every(
      // Key presence distinguishes omitted optional properties from explicit undefined values.
      (key) =>
        Object.prototype.hasOwnProperty.call(rightRecord, key) &&
        queryDataEqual(leftRecord[key], rightRecord[key]),
    )
  )
}

// Create one history engine owned by the query store, with explicit derived-data boundaries.
export function createQueryHistory(query: Ref<QueryGroup>, hooks: QueryHistoryHooks) {
  const undoActions = shallowRef<QueryHistoryAction[]>([])
  const redoActions = shallowRef<QueryHistoryAction[]>([])
  const activeInputSession = shallowRef<QueryInputSession>()
  const restorationRevision = ref(0)
  let transactionDepth = 0
  let finalizingInputSession = false
  let applyingSnapshot = false

  // Include an active changed session so its first undo can finish and reverse it.
  const canUndo = computed(
    () =>
      undoActions.value.length > 0 ||
      (activeInputSession.value !== undefined &&
        !queryDataEqual(activeInputSession.value.before, query.value)),
  )
  // Report whether a reversed completed action is available.
  const canRedo = computed(() => redoActions.value.length > 0)

  // Capture the entire editable query after the store settles its derived data.
  function captureQuerySnapshot(): QueryGroup {
    hooks.beforeCapture()
    return copyQueryData(query.value)
  }

  // Record genuine completed changes, retaining redo when an action returns to its start.
  function completeQueryAction(action: PendingQueryAction) {
    if (applyingSnapshot) return
    const after = captureQuerySnapshot()
    if (queryDataEqual(action.before, after)) return
    undoActions.value = [
      ...undoActions.value,
      { description: action.description, before: copyQueryData(action.before), after },
    ].slice(-HISTORY_LIMIT)
    redoActions.value = []
  }

  // Finish normalization and derived-data reconciliation before recording the input session.
  function finishInputSession(key?: string) {
    const session = activeInputSession.value
    if (
      applyingSnapshot || finalizingInputSession || !session ||
      (key !== undefined && session.key !== key)
    ) return

    finalizingInputSession = true
    try {
      session.finalize?.()
    } finally {
      try {
        if (activeInputSession.value === session) {
          hooks.beforeInputComplete(session.before)
          activeInputSession.value = undefined
          completeQueryAction(session)
        }
      } finally {
        finalizingInputSession = false
      }
    }
  }

  // Retain one input's starting query until blur, Enter, or another query action.
  function beginInputSession(key: string, description: string, finalize?: () => void): boolean {
    if (applyingSnapshot || finalizingInputSession || transactionDepth > 0) return false
    if (activeInputSession.value?.key === key) return true
    finishInputSession()
    activeInputSession.value = { key, description, before: captureQuerySnapshot(), finalize }
    return true
  }

  // Own the outer synchronous action locally; nested calls and normalization join their owner.
  function runQueryAction<T>(description: string, mutate: () => T): T {
    if (applyingSnapshot) return mutate()

    let action: PendingQueryAction | undefined
    if (transactionDepth === 0 && !finalizingInputSession) {
      finishInputSession()
      action = { description, before: captureQuerySnapshot() }
    }

    transactionDepth += 1
    try {
      return mutate()
    } finally {
      transactionDepth -= 1
      if (action) completeQueryAction(action)
    }
  }

  // Restore independent data and reset store tracking before notifying editors.
  function restoreQuerySnapshot(snapshot: QueryGroup) {
    applyingSnapshot = true
    try {
      query.value = copyQueryData(snapshot)
      hooks.afterRestore()
      restorationRevision.value += 1
    } finally {
      applyingSnapshot = false
    }
  }

  // Finish any live input and reverse the most recent action without recording restoration.
  function undo(): string | undefined {
    if (applyingSnapshot || finalizingInputSession || transactionDepth > 0) return
    finishInputSession()
    const action = undoActions.value[undoActions.value.length - 1]
    if (!action) return
    restoreQuerySnapshot(action.before)
    undoActions.value = undoActions.value.slice(0, -1)
    redoActions.value = [...redoActions.value, copyQueryData(action)]
    return action.description
  }

  // Reapply a reversed action, unless a completed input edit has invalidated redo.
  function redo(): string | undefined {
    if (applyingSnapshot || finalizingInputSession || transactionDepth > 0) return
    finishInputSession()
    const action = redoActions.value[redoActions.value.length - 1]
    if (!action) return
    restoreQuerySnapshot(action.after)
    redoActions.value = redoActions.value.slice(0, -1)
    undoActions.value = [...undoActions.value, copyQueryData(action)].slice(-HISTORY_LIMIT)
    return action.description
  }

  // Discard history and the active draft when the store switches databases successfully.
  function clearHistory() {
    undoActions.value = []
    redoActions.value = []
    activeInputSession.value = undefined
    transactionDepth = 0
  }

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    restorationRevision,
    runQueryAction,
    beginInputSession,
    finishInputSession,
    clearHistory,
    // Let the store suppress colour allocation while a saved snapshot is being applied.
    get isRestoring() {
      return applyingSnapshot
    },
  }
}
