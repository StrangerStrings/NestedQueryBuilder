import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { QueryCondition, QueryGroup } from '../types/query'
import { createId } from '../utils/createId'

export type DatabaseId = 'postgresql' | 'elasticsearch'

// Create a fresh empty query tree for the selected database.
function createEmptyQuery(): QueryGroup {
  return {
    kind: 'group',
    id: createId(),
    mode: 'all',
    children: [
      {
        kind: 'condition',
        id: createId(),
        field: 'status'
      },
      {
        kind: 'condition',
        id: createId(),
        field: 'tatters'
      },
      {
        kind: 'condition',
        id: createId(),
        field: 'age'
      }
    ],
  }
}

function findGroupById(group: QueryGroup, groupId: string): QueryGroup | undefined {
  if (group.id === groupId) {
    return group
  }

  for (const child of group.children) {
    if (child.kind === 'group') {
      const nestedGroup = findGroupById(child, groupId)

      if (nestedGroup) {
        return nestedGroup
      }
    }
  }
}

function removeNodeFromGroup(group: QueryGroup, nodeId: string): boolean {
  const childIndex = group.children.findIndex((child) => child.id === nodeId)

  if (childIndex !== -1) {
    group.children.splice(childIndex, 1)
    return true
  }

  for (const child of group.children) {
    if (child.kind === 'group' && removeNodeFromGroup(child, nodeId)) {
      return true
    }
  }

  return false
}

function findConditionById(group: QueryGroup, conditionId: string): QueryCondition | undefined {
  for (const child of group.children) {
    if (child.kind === 'condition' && child.id === conditionId) {
      return child
    }

    if (child.kind === 'group') {
      const nestedCondition = findConditionById(child, conditionId)

      if (nestedCondition) {
        return nestedCondition
      }
    }
  }
}

function getConditions(group: QueryGroup): QueryCondition[] {
  return group.children.flatMap((child) =>
    child.kind === 'condition' ? [child] : getConditions(child),
  )
}

export const useQueryStore = defineStore('query', () => {
  const database = ref<DatabaseId>('postgresql')
  const query = ref<QueryGroup>(createEmptyQuery())

  // Collect distinct nonempty fields from every condition, including nested groups.
  const uniqueFields = computed(() => {
    const fields = new Set<string>()

    for (const condition of getConditions(query.value)) {
      if (condition.field.trim()) {
        fields.add(condition.field)
      }
    }

    return [...fields]
  })

  // Switch databases and reset the query tree when the selection changes.
  function changeDatabase(next: DatabaseId) {
    if (next === database.value) return

    database.value = next
    query.value = createEmptyQuery()
  }

  function cycleGroupMode(groupId: string) {
    const group = findGroupById(query.value, groupId)

    if (group) {
      group.mode = group.mode === 'all' ? 'any' : group.mode === 'any' ? 'none' : 'all'
    }
  }

  function addCondition(groupId: string) {
    const group = findGroupById(query.value, groupId)

    if (group) {
      group.children.push({
        id: createId(),
        kind: 'condition',
        field: 'status'
      })
    }
  }

  function addGroup(groupId: string) {
    const group = findGroupById(query.value, groupId)

    if (group) {
      group.children.push({
        id: createId(),
        kind: 'group',
        mode: 'all',
        children: [],
      })
    }
  }

  function removeNode(nodeId: string) {
    if (nodeId !== query.value.id) {
      if (removeNodeFromGroup(query.value, nodeId)) {
      }
    }
  }

  return {
    database,
    query,
    uniqueFields,
    changeDatabase,
    cycleGroupMode,
    addCondition,
    addGroup,
    removeNode
  }
})
