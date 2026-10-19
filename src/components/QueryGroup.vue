<script setup lang="ts">
import { inject, onBeforeUnmount, provide, ref, shallowRef, watch } from 'vue'
import Draggable from 'vuedraggable'
import { useQueryStore } from '../stores/queryStore'
import { useSettingsStore } from '../stores/settingsStore'
import QueryCondition from './QueryCondition.vue'
import type {
  QueryCondition as QueryConditionModel,
  QueryGroup as QueryGroupModel,
  QueryNode,
} from '../types/query'
import { querySortingKey, type QueryDrag } from '../utils/querySorting'
import { findGroupById } from '../utils/queryTree'

type QuerySortEvent = { item: HTMLElement; from: HTMLElement; to: HTMLElement }

const props = withDefaults(
  defineProps<{
    group: QueryGroupModel
    canDelete?: boolean
    selectedConditionId?: string
  }>(),
  { canDelete: false },
)

const queryStore = useQueryStore()
const settingsStore = useSettingsStore()
const inheritedSorting = inject(querySortingKey, null)
const sorting = inheritedSorting ?? {
  drag: shallowRef<QueryDrag | null>(null),
  feedback: shallowRef<{ group: QueryGroupModel; top: number } | null>(null),
  version: ref(0),
  blockClick: ref(false),
}
provide(querySortingKey, sorting)

// Require the original tree, direct parent and exact node object throughout a drag.
function validDrag(drag: QueryDrag): boolean {
  return (
    queryStore.query === drag.root && drag.node.id === drag.nodeId &&
    findGroupById(queryStore.query, drag.sourceGroupId) === drag.source &&
    drag.source.children.includes(drag.node)
  )
}

// Capture wrapper proposals without applying its independent add/remove mutations.
function proposeOrder(children: QueryNode[]) {
  const drag = sorting.drag.value
  if (drag && children.includes(drag.node)) {
    drag.proposal = { group: props.group, children }
  }
}

// Start only from a handle belonging to this direct child, excluding nested handles.
function filterDragSource(event: Event, item: HTMLElement | null) {
  const handle = event.target instanceof Element
    ? event.target.closest('.condition-drag-handle, .group-drag-handle')
    : null
  return (
    !item || item.parentElement?.dataset.groupId !== props.group.id ||
    handle?.closest('.child-slot') !== item
  )
}

// Admit only a live condition from this builder; groups never leave their parent.
function allowTransfer(to: { el: HTMLElement }, from: { el: HTMLElement }, item: HTMLElement) {
  const drag = sorting.drag.value
  return (
    !!drag && validDrag(drag) && drag.node.kind === 'condition' &&
    drag.item === item && drag.from === from.el &&
    !!findGroupById(queryStore.query, to.el.dataset.groupId ?? '')
  )
}

// Validate the actual dragged kind while Sortable routes nested receiving lists.
function allowMove(event: {
  from: HTMLElement
  to: HTMLElement
  draggedContext: { element: QueryNode }
}) {
  const drag = sorting.drag.value
  return (
    !!drag && validDrag(drag) && event.from === drag.from &&
    event.draggedContext.element === drag.node &&
    !!findGroupById(queryStore.query, event.to.dataset.groupId ?? '') &&
    (event.from === event.to || drag.node.kind === 'condition')
  )
}

// Follow Sortable's DOM change event (the wrapper's @change instead reports final array updates).
function updateInsertionFeedback(event: QuerySortEvent) {
  const drag = sorting.drag.value
  if (
    !drag || !validDrag(drag) || event.item !== drag.item || event.from !== drag.from ||
    event.from.dataset.groupId !== props.group.id ||
    event.item.parentElement !== event.to ||
    (drag.node.kind === 'group' && event.to !== drag.from)
  ) return

  const group = findGroupById(queryStore.query, event.to.dataset.groupId ?? '')
  if (!group) return

  // The positioned list is the placeholder's offset parent; no viewport or scroll offsets are needed.
  sorting.feedback.value = { group, top: event.item.offsetTop - 4 }
}

// Capture source identity, initialise feedback and suppress trailing drag clicks.
function startSorting(event: { item: HTMLElement; from: HTMLElement }) {
  sorting.blockClick.value = true
  const node = props.group.children.find((child) => child.id === event.item.dataset.nodeId)
  if (!node || event.from.dataset.groupId !== props.group.id) {
    resetSorting()
    return
  }
  sorting.drag.value = {
    root: queryStore.query,
    source: props.group,
    sourceGroupId: props.group.id,
    node,
    nodeId: node.id,
    item: event.item,
    from: event.from,
  }
  updateInsertionFeedback({ ...event, to: event.from })
}

// Commit once via Pinia, converting full-array positions to original-array boundaries.
function finishSorting(event: QuerySortEvent) {
  const drag = sorting.drag.value
  if (drag && event.item !== drag.item) return
  const proposal = drag?.proposal
  if (
    drag && proposal && validDrag(drag) && event.from === drag.from &&
    event.to.dataset.groupId === proposal.group.id &&
    findGroupById(queryStore.query, proposal.group.id) === proposal.group
  ) {
    const current = proposal.group.children
    const newIndex = proposal.children.indexOf(drag.node)
    const sameParent = drag.source === proposal.group
    const otherChildren = sameParent ? current.filter((child) => child !== drag.node) : current
    const nextOtherChildren = proposal.children.filter((child) => child !== drag.node)
    if (
      newIndex !== -1 && newIndex === proposal.children.lastIndexOf(drag.node) &&
      otherChildren.length === nextOtherChildren.length &&
      otherChildren.every((child, index) => child === nextOtherChildren[index])
    ) {
      if (sameParent) {
        const oldIndex = current.indexOf(drag.node)
        const insertionIndex = newIndex > oldIndex ? newIndex + 1 : newIndex
        queryStore.moveNode(drag.sourceGroupId, drag.nodeId, insertionIndex)
      } else if (drag.node.kind === 'condition') {
        queryStore.transferCondition(drag.sourceGroupId, proposal.group.id, drag.nodeId, newIndex)
      }
    }
  }
  resetSorting()
}

// Restore rendering from Pinia and dispose feedback after completion, rejection or cancellation.
function resetSorting() {
  sorting.drag.value = null
  sorting.feedback.value = null
  sorting.version.value += 1
}

// Dispose the old sorting session when an import, database switch, or group replacement occurs.
watch([() => queryStore.query, () => props.group], () => {
  if (sorting.drag.value) resetSorting()
}, { flush: 'sync' })

// Cancel stale sources after synchronous store mutations have completed.
watch(() => sorting.drag.value && !validDrag(sorting.drag.value), (invalid) => {
  if (invalid) resetSorting()
})

// Nested source unmounting must not clear shared data before the drop finishes.
onBeforeUnmount(() => {
  if (!inheritedSorting) {
    sorting.drag.value = null
    sorting.feedback.value = null
  }
})

// Let the next deliberate pointer gesture select, edit, or delete normally.
function beginPointerGesture() {
  sorting.blockClick.value = false
}

// Ignore a trailing mouse click from dragging while allowing keyboard activation.
function preventDragClick(event: MouseEvent) {
  if (sorting.blockClick.value && event.detail > 0) {
    event.preventDefault()
    event.stopPropagation()
  }
}

const emit = defineEmits<{
  select: [condition: QueryConditionModel]
}>()

// Select the new condition only when the condition panel is already open.
function addCondition() {
  const condition = queryStore.addCondition(props.group.id)
  if (condition && props.selectedConditionId) emit('select', condition)
}

// Select the new group's initial condition only when the condition panel is already open.
function addGroup() {
  const condition = queryStore.addGroup(props.group.id)
  if (condition && props.selectedConditionId) emit('select', condition)
}

// Narrow child nodes to conditions before rendering their editable button.
function isQueryCondition(child: QueryNode): child is QueryConditionModel {
  return child.kind === 'condition'
}
</script>

<template>
  <section
    class="query-group"
    :class="`mode-${group.mode}`"
    @pointerdown.capture="beginPointerGesture"
    @click.capture="preventDragClick"
  >
    <button
      type="button"
      class="mode-badge"
      aria-label="Cycle group mode"
      @click="queryStore.cycleGroupMode(group.id)"
    >
      <h3>{{ group.mode }}</h3>
    </button>
    <button
      v-if="settingsStore.dragAndDropMode && group.id !== queryStore.query.id"
      type="button"
      class="group-drag-handle"
      aria-label="Drag to reorder group within its parent"
      title="Drag to reorder group within its parent"
      @click.stop
    >
      <span class="material-symbols-outlined" aria-hidden="true">drag_indicator</span>
    </button>
    <Draggable
      :key="sorting.version.value"
      :model-value="group.children"
      @update:model-value="proposeOrder"
      class="children"
      :data-group-id="group.id"
      item-key="id"
      handle=".condition-drag-handle, .group-drag-handle"
      :group="{ name: 'query-children', pull: allowTransfer, put: allowTransfer }"
      :empty-insert-threshold="12"
      :filter="filterDragSource"
      :prevent-on-filter="false"
      :dragover-bubble="false"
      :move="allowMove"
      direction="vertical"
      ghost-class="query-drop-placeholder"
      drag-class="query-dragging"
      :component-data="{ onChange: updateInsertionFeedback }"
      @start="startSorting"
      @end="finishSorting"
    >
      <template #item="{ element: child }">
        <div
          class="child-slot"
          :data-node-id="child.id"
        >
          <QueryCondition
            v-if="isQueryCondition(child)"
            :condition="child"
            :selected="child.id === selectedConditionId"
            editable
            @select="emit('select', $event)"
          />
          <QueryGroup
            v-else
            :group="child"
            :selected-condition-id="selectedConditionId"
            can-delete
            @select="emit('select', $event)"
          />
        </div>
      </template>
      <template #footer>
        <span
          v-show="sorting.feedback.value?.group === group"
          class="query-insertion-line"
          :style="{ top: `${sorting.feedback.value?.top ?? 0}px` }"
          aria-hidden="true"
        />
      </template>
    </Draggable>
    <div class="group-actions" :class="{ 'root-group-actions': group.id === queryStore.query.id }">
      <button
        type="button"
        class="icon-button"
        aria-label="Add condition"
        @click="addCondition"
      >
        <span class="material-symbols-outlined" aria-hidden="true">add_box</span>
      </button>
      <button
        type="button"
        class="icon-button"
        aria-label="Add child group"
        @click="addGroup"
      >
        <span class="material-symbols-outlined" aria-hidden="true">library_add</span>
      </button>
      <button
        v-if="props.canDelete"
        type="button"
        class="icon-button delete-group-button"
        aria-label="Delete group"
        @click="queryStore.removeNode(group.id)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">delete</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.query-group {
  position: relative;
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem 1.2rem 2.75rem 2.3rem;
  padding: 0.85rem 1.2rem 2.75rem 2.8rem;
  margin: 5px 0;
  border: 4px solid var(--group-border-color);
  border-radius: 36px;
  background: var(--group-background-color);
  --group-border-color: var(--group-default-border);
  --group-background-color: var(--group-default-surface);

}

.query-group.mode-all {
  --group-border-color: var(--group-all-border);
  --group-background-color: var(--group-all-surface);
}

.query-group.mode-none {
  --group-background-color: var(--group-none-surface);
  --group-border-color: var(--group-none-border);
}

.group-actions {
  position: absolute;
  right: 0.75rem;
  bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.root-group-actions {
  margin-right: 53px;
}

.mode-badge {
  position: absolute;
  top: 50%;
  left: -1.2rem;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.35rem;
  border: 4px solid var(--group-border-color);
  border-radius: 16px;
  color: var(--group-border-color);
  background: var(--group-background-color);
  font-family: inherit;
  cursor: pointer;
}

h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  text-transform: uppercase;
  writing-mode: vertical-rl;
  text-orientation: upright;
}

.children {
  position: relative;
  display: grid;
  gap: 0.5rem;
  min-height: 2.5rem;
}

.group-drag-handle {
  position: absolute;
  bottom: 0.5rem;
  left: 0.75rem;
  z-index: 1;
  border: 0;
  cursor: grab;
}

.mode-badge:focus-visible,
.group-drag-handle:focus-visible,
.icon-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.group-drag-handle:active,
.query-dragging > .query-group > .group-drag-handle {
  cursor: grabbing;
}

.child-slot {
  position: relative;
  display: grid;
  min-width: 0;
}

.query-insertion-line {
  position: absolute;
  z-index: 1;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 2px;
  background: var(--drag-indicator);
  transform: translateY(-50%);
  pointer-events: none;
}

.query-drop-placeholder > .query-condition {
  opacity: 0.35;
}

.query-dragging > .query-condition {
  opacity: 0.65;
}

.query-drop-placeholder > .query-group {
  opacity: 0.7;
}

.query-dragging > .query-group {
  opacity: 0.85;
  box-shadow: 0 0 0 2px var(--shadow-drag);
}

button {
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--border-control);
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
}

.icon-button:hover,
.icon-button:focus-visible {
  background: var(--surface-icon-hover);
  color: var(--text-primary);
}

.delete-group-button {
  opacity: 0;
  pointer-events: none;
}

.query-group:hover:not(:has(.query-group:hover, .query-condition:hover))
  > .group-actions
  > .delete-group-button,
.query-group:focus-within > .group-actions > .delete-group-button {
  opacity: 1;
  pointer-events: auto;
}

.material-symbols-outlined {
  font-size: 1.3rem;
}

@media (width < 768px) {
  .query-group {
    display: flex;
    flex-direction: column;
    min-width: min-content;
    padding: 0.5rem;
    border-radius: 16px;
  }

  .mode-badge {
    position: static;
    align-self: flex-start;
    transform: none;
    min-width: 44px;
    min-height: 44px;
    box-sizing: border-box;
    /* Reserve a separate header target for the optional group drag handle. */
    margin-right: 52px;
    padding: 0.25rem 0.5rem;
  }

  h3 {
    writing-mode: horizontal-tb;
  }

  .children {
    /* Let nested groups retain their controls instead of compressing or clipping them. */
    min-width: min-content;
  }

  .group-actions {
    position: static;
    align-self: flex-end;
    margin-right: 0;
  }

  .icon-button,
  .group-drag-handle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    box-sizing: border-box;
    padding: 0;
  }

  .group-drag-handle {
    top: 0.5rem;
    right: 0.5rem;
    bottom: auto;
    left: auto;
  }

  .delete-group-button {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
