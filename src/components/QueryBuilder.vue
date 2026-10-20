<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useQueryStore } from '../stores/queryStore'
import type { QueryCondition, QueryGroup as QueryGroupModel } from '../types/query'
import BuilderSettings from './BuilderSettings.vue'
import ConditionPanel from './ConditionPanel.vue'
import QueryGroup from './QueryGroup.vue'

defineProps<{
  historyAnnouncement: string
}>()

const queryStore = useQueryStore()
const selectedConditionId = ref<string | null>(null)
const builderContent = ref<HTMLElement | null>(null)
const mobileViewport = window.matchMedia('(width < 768px)')
const isMobile = ref(mobileViewport.matches)
let builderScroll: { top: number; left: number } | null = null

const emit = defineEmits<{
  'mobile-editor-change': [open: boolean]
}>()

// Resolve the selection from the current tree so deleted conditions close their panel.
function findSelectedCondition(group: QueryGroupModel): QueryCondition | null {
  for (const child of group.children) {
    if (child.kind === 'condition' && child.id === selectedConditionId.value) return child
    if (child.kind === 'group') {
      const condition = findSelectedCondition(child)
      if (condition) return condition
    }
  }
  return null
}

// Keep the details panel tied to a condition that still exists in the query.
const selectedCondition = computed(() => findSelectedCondition(queryStore.query))

// Forget a removed selection immediately so a later redo cannot reopen its panel.
watch(() => queryStore.restorationRevision, () => {
  if (selectedConditionId.value && !selectedCondition.value) {
    selectedConditionId.value = null
  }
}, { flush: 'sync' })

// Reconcile after query assignment and its restoration revision have both settled.
watch(
  [() => queryStore.query.id, () => queryStore.restorationRevision, selectedCondition],
  // Retain surviving selection only for restoration; imports and switches keep their reset behavior.
  ([rootId, revision, condition], [previousRootId, previousRevision]) => {
    const restored = revision !== previousRevision
    if ((!restored && rootId !== previousRootId) || !condition) {
      selectedConditionId.value = null
    }
  },
)

// Restrict the covered UI only while a valid condition is open on a phone.
const mobileEditorOpen = computed(() => isMobile.value && !!selectedCondition.value)

// Follow the same breakpoint as the full-screen panel styles without remounting the editor.
function handleViewportChange(event: MediaQueryListEvent) {
  isMobile.value = event.matches
}

// Return keyboard focus to the original condition without moving the builder's scroll position.
function restoreBuilderFocus(conditionId: string) {
  const button = builderContent.value?.querySelector<HTMLButtonElement>(
    `[data-edit-condition-id="${CSS.escape(conditionId)}"]`,
  )
  const target = button ?? builderContent.value
  target?.focus({ preventScroll: true })
}

// Preserve both scroll axes while the mounted tree is covered, and release navigation on close.
watch(
  [mobileEditorOpen, () => selectedCondition.value?.id],
  // Wait for inertness and panel removal to update before restoring focus and scroll offsets.
  async ([open, conditionId], [wasOpen, previousConditionId]) => {
    const revision = queryStore.restorationRevision
    if (open && !wasOpen && builderContent.value) {
      builderScroll = {
        top: builderContent.value.scrollTop,
        left: builderContent.value.scrollLeft,
      }
    }
    if (open !== wasOpen) emit('mobile-editor-change', open)
    await nextTick()
    if (revision !== queryStore.restorationRevision) return
    if (!mobileEditorOpen.value && builderScroll && builderContent.value) {
      builderContent.value.scrollTop = builderScroll.top
      builderContent.value.scrollLeft = builderScroll.left
      builderScroll = null
    }
    if (!conditionId && previousConditionId && !selectedCondition.value) {
      restoreBuilderFocus(previousConditionId)
    }
  },
)

// Subscribe once while this builder owns the selected condition.
onMounted(() => {
  mobileViewport.addEventListener('change', handleViewportChange)
})

// Release app-level modality and the breakpoint listener when the builder is removed.
onBeforeUnmount(() => {
  mobileViewport.removeEventListener('change', handleViewportChange)
  emit('mobile-editor-change', false)
})

// Select a condition by its stable identifier.
function selectCondition(condition: QueryCondition) {
  selectedConditionId.value = condition.id
}

// Clear the current condition selection.
function closeConditionPanel() {
  selectedConditionId.value = null
}
</script>

<template>
  <section class="query-builder" aria-label="Query builder">
    <div class="editor-workspace" :class="{ 'has-selection': selectedCondition }">
      <div
        ref="builderContent"
        class="builder-content"
        role="region"
        aria-label="Query conditions"
        tabindex="0"
        :inert="mobileEditorOpen"
      >
        <div class="conditions">
          <QueryGroup
            :group="queryStore.query"
            :selected-condition-id="selectedCondition?.id"
            @select="selectCondition"
          />
        </div>
      </div>
      <ConditionPanel
        v-if="selectedCondition"
        :key="selectedCondition.id"
        :condition="selectedCondition"
        :mobile="mobileEditorOpen"
        :history-announcement="historyAnnouncement"
        @close="closeConditionPanel"
      />
    </div>
    <BuilderSettings class="builder-settings" :inert="mobileEditorOpen" />
  </section>
</template>

<style scoped>
.query-builder {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.editor-workspace {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  align-items: flex-start;
  gap: 1rem;
}

.builder-content {
  min-width: 0;
  flex: 1;
  height: 100%;
  overflow: auto;
}

.condition-panel {
  max-height: 100%;
  overflow: auto;
}

.builder-content:focus-visible,
.condition-panel:focus-visible {
  outline: 2px solid var(--focus-ring-accent);
  outline-offset: -2px;
}

.conditions {
  display: grid;
  gap: 0.5rem;
  /* Leave room for the group mode badge and its focus outline inside the scroll area. */
  padding-left: 1.5rem;
}

.builder-settings {
  position: fixed;
  bottom: 1rem;
  left: 1.5rem;
  z-index: 1;
}

@media (width < 768px) {
  .editor-workspace {
    gap: 0;
  }

  .conditions {
    /* Grow deep trees within builder-content, leaving room for focus outlines on every edge. */
    grid-template-columns: minmax(min-content, 1fr);
    padding: 0.25rem;
  }

  .builder-settings {
    display: none;
  }
}
</style>
