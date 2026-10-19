<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import BuilderSettings from './BuilderSettings.vue'
import { useQueryStore } from '../stores/queryStore'

const queryStore = useQueryStore()
const mobileViewport = window.matchMedia('(width < 768px)')
const isMobile = ref(mobileViewport.matches)
const menuOpen = ref(false)
const menu = ref<HTMLElement | null>(null)
const burger = ref<HTMLButtonElement | null>(null)
const tabGroups = [
  { position: 'left', tabs: [{ id: 'databases', label: 'Databases' }] },
  {
    position: 'center',
    tabs: [
      { id: 'schema', label: 'Schema' },
      { id: 'import', label: 'Import' },
      { id: 'builder', label: 'Builder' },
      { id: 'output', label: 'Output' },
    ],
  },
] as const

// Hide unavailable import views while retaining the existing placeholder database navigation.
const visibleTabGroups = computed(() =>
  tabGroups.map((group) => ({
    ...group,
    tabs: group.tabs.filter(
      (tab) =>
        queryStore.adapter.placeholder ||
        ((tab.id !== 'import' || !!queryStore.adapter.importSqlFilter) &&
          (tab.id !== 'schema' || !!queryStore.adapter.importSchemaSql)),
    ),
  })),
)

type Tab = (typeof tabGroups)[number]['tabs'][number]['id']

defineProps<{
  activeTab: Tab
}>()

const emit = defineEmits<{
  select: [tab: Tab]
}>()

// Close the disclosure and keep focus on its visible trigger.
function closeMenu() {
  menuOpen.value = false
  if (isMobile.value) burger.value?.focus()
}

// Toggle the phone navigation without changing the selected screen.
function toggleMenu() {
  if (menuOpen.value) closeMenu()
  else menuOpen.value = true
}

// Emit every screen selection, including the already active screen.
function selectTab(tab: Tab) {
  closeMenu()
  emit('select', tab)
}

// Dismiss the disclosure from any of its controls with Escape.
function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !menuOpen.value) return
  event.preventDefault()
  closeMenu()
}

// Clear phone state and rescue focus when a responsive control becomes hidden.
async function handleViewportChange() {
  const focused = document.activeElement
  const focusInMenu = focused instanceof Node && !!menu.value?.contains(focused)
  const focusOnBurger = focused === burger.value
  isMobile.value = mobileViewport.matches
  menuOpen.value = false
  await nextTick()
  if (isMobile.value && focusInMenu) burger.value?.focus()
  else if (!isMobile.value && (focusOnBurger || focusInMenu)) {
    const target =
      menu.value?.querySelector<HTMLButtonElement>('button[aria-current="page"]') ??
      menu.value?.querySelector<HTMLButtonElement>('button')
    target?.focus()
  }
}

// Subscribe to the same breakpoint used by the navigation styles.
onMounted(() => {
  mobileViewport.addEventListener('change', handleViewportChange)
})

// Release the viewport subscription when navigation is removed.
onUnmounted(() => {
  mobileViewport.removeEventListener('change', handleViewportChange)
})
</script>

<template>
  <nav class="tab-navigation" aria-label="Query views" @keydown="handleKeydown">
    <button
      ref="burger"
      type="button"
      class="menu-toggle"
      :aria-label="menuOpen ? 'Close navigation menu' : 'Open navigation menu'"
      :aria-expanded="menuOpen"
      aria-controls="query-navigation-menu"
      @click="toggleMenu"
    >
      <span class="material-symbols-outlined" aria-hidden="true">menu</span>
    </button>
    <div
      id="query-navigation-menu"
      ref="menu"
      class="navigation-menu"
      :hidden="isMobile && !menuOpen"
    >
      <div
        v-for="group in visibleTabGroups"
        :key="group.position"
        class="tab-group"
        :class="group.position"
      >
        <button
          v-for="tab in group.tabs"
          :key="tab.id"
          type="button"
          :class="{ active: activeTab === tab.id }"
          :aria-current="activeTab === tab.id ? 'page' : undefined"
          :aria-label="
            tab.id === 'databases'
              ? `Databases, current database: ${queryStore.adapter.label}`
              : undefined
          "
          @click="selectTab(tab.id)"
        >
          <span
            v-if="tab.id === 'databases'"
            class="database-icon"
            :style="{ '--database-icon': `url(${JSON.stringify(queryStore.adapter.icon)})` }"
            aria-hidden="true"
          />
          {{ tab.label }}
        </button>
      </div>
      <div class="mobile-settings">
        <p>Builder settings</p>
        <BuilderSettings />
      </div>
    </div>
    <span class="brand-logo" role="img" aria-label="n(q(b">n(q(b</span>
  </nav>
</template>

<style scoped>
.tab-navigation {
  position: relative;
  flex: 1;
  background: var(--surface-navigation);
}

.navigation-menu {
  display: grid;
  grid-template-columns: minmax(max-content, 1fr) auto minmax(7rem, 1fr);
}

.brand-logo {
  position: absolute;
  top: 50%;
  right: 1rem;
  transform: translateY(-50%);
  font-family: 'Tomorrow', sans-serif;
  font-size: 1.5rem;
  font-weight: 400;
  line-height: 1;
  color: var(--text-secondary);
}

.navigation-menu[hidden],
.menu-toggle,
.mobile-settings {
  display: none;
}

button:focus-visible {
  outline: 2px solid var(--focus-ring-accent);
  outline-offset: -3px;
}

.tab-group {
  display: flex;
  gap: 0.25rem;
}

.tab-group.center {
  justify-content: center;
}

button {
  display: inline-flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

button.active {
  border-bottom-color: var(--accent-primary);
  color: var(--text-primary);
  font-weight: 600;
}

.database-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  background: var(--text-secondary);
  -webkit-mask: var(--database-icon) center / contain no-repeat;
  mask: var(--database-icon) center / contain no-repeat;
}

@media (width < 768px) {
  .menu-toggle {
    display: inline-flex;
    min-height: 48px;
    color: var(--text-secondary);
  }

  .navigation-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    display: block;
    max-height: calc(100vh - 49px);
    max-height: calc(100dvh - 49px);
    box-sizing: border-box;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.5rem;
    background: var(--surface-navigation);
    border: 1px solid var(--border-panel);
  }

  .tab-group {
    flex-direction: column;
  }

  .tab-group button {
    min-height: 44px;
    width: 100%;
    font-size: 1.125rem;
    text-align: left;
  }

  .mobile-settings {
    display: block;
    margin-top: 0.5rem;
    padding: 0.75rem;
    border-top: 1px solid var(--border-panel);
    color: var(--text-primary);
  }

  .mobile-settings p {
    margin: 0 0 0.75rem;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
}
</style>
