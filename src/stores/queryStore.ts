import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import type { QueryCondition, QueryGroup } from '../types/query'
import { createId } from '../utils/createId'

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

  const query = reactive<QueryGroup>({
    kind: 'group',
    id: createId(),
    mode: 'all',
    children: [
      {
        id: createId(),
        kind: 'condition',
        field: 'name'
      },{
        id: createId(),
        kind: 'condition',
        field: 'age'
      },
      {
        id: createId(),
        kind: 'condition',
        field: 'country'
      },
    ],
  })

  function cycleGroupMode(groupId: string) {
    const group = findGroupById(query, groupId)

    if (group) {
      group.mode = group.mode === 'all' ? 'any' : group.mode === 'any' ? 'none' : 'all'
    }
  }

  function addCondition(groupId: string) {
    const group = findGroupById(query, groupId)

    if (group) {
      group.children.push({
        id: createId(),
        kind: 'condition',
        field: 'status'
      })
    }
  }

  function addGroup(groupId: string) {
    const group = findGroupById(query, groupId)

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
    if (nodeId !== query.id) {
      if (removeNodeFromGroup(query, nodeId)) {
      }
    }
  }

  return {
    query,
    cycleGroupMode,
    addCondition,
    addGroup,
    removeNode
  }
})
