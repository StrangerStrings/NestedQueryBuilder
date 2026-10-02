import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { QueryCondition, QueryGroup } from '../types/query'
import { databaseDefinitions } from '../data/databases'
import {
  assignFieldColours,
  assignConditionColours,
  getConditionColour as resolveConditionColour,
} from '../colours/fieldColours'
import type { ConditionColour } from '../colours/palette'
import { createId } from '../utils/createId'
import { importSqlWhere, type ImportWhereResult } from '../utils/importWhere'
import { generateWhereSql, type GenerateWhereSqlResult } from '../utils/generateWhereSql'

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
        field: 'status',
        operatorId: 'postgresql.eq',
        value: 'online',
      },
      {
        kind: 'condition',
        id: createId(),
        field: 'tatters',
        operatorId: 'postgresql.eq',
        value: 'yes',
      },
      {
        kind: 'condition',
        id: createId(),
        field: 'age',
        operatorId: 'postgresql.eq',
        value: '35',
      },
            {
        kind: 'condition',
        id: createId(),
        field: 'asdf',
        operatorId: 'postgresql.eq',
        value: 'online',
      },      {
        kind: 'condition',
        id: createId(),
        field: 'trew',
        operatorId: 'postgresql.eq',
        value: 'online',
      },
            {
        kind: 'condition',
        id: createId(),
        field: 'rewwer',
        operatorId: 'postgresql.eq',
        value: 'online',
      },
            {
        kind: 'condition',
        id: createId(),
        field: 'age',
        operatorId: 'postgresql.eq',
        value: 'online',
      },
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

// Find an existing condition recursively by its stable identifier.
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

// Manage the query tree and its persistent field-colour assignments.
export const useQueryStore = defineStore('query', () => {
  const database = ref<DatabaseId>('postgresql')
  const query = ref<QueryGroup>(createEmptyQuery())
  const operators = computed(() => databaseDefinitions[database.value].operators)

  // Regenerate SQL whenever the current query tree's fields, values, or structure change.
  const whereSqlResult = computed<GenerateWhereSqlResult>(() => generateWhereSql(query.value))

  // Replace the tree on successful import; the existing watcher assigns imported condition colours.
  function importSqlFilter(filter: string): ImportWhereResult {
    const result = importSqlWhere(filter)
    if (result.success) {
      query.value = result.tree
    }
    return result
  }

  // Save active colours, transferring unused assignments as condition fields change.
  function reserveConditionColours(
    conditions: { id: string; field: string }[],
    previousConditions: { id: string; field: string }[] = [],
  ) {
    const assignments = assignFieldColours(
      conditions,
      query.value.fieldColours,
      previousConditions,
    )

    if (assignments !== query.value.fieldColours) {
      query.value.fieldColours = assignments
    }

    const conditionAssignments = assignConditionColours(
      conditions,
      assignments,
      query.value.conditionColours,
      previousConditions,
    )
    if (conditionAssignments !== query.value.conditionColours) {
      query.value.conditionColours = conditionAssignments
    }
  }

  // Batch tree updates so moving a condition does not temporarily release its colour.
  watch(
    () =>
      getConditions(query.value).map((condition) => ({
        id: condition.id,
        field: condition.field.trim(),
      })),
    reserveConditionColours,
    { immediate: true, flush: 'pre' },
  )

  // Update condition details through the store rather than mutating component props.
  function updateCondition(
    conditionId: string,
    updates: Partial<Pick<QueryCondition, 'field' | 'operatorId' | 'value'>>,
  ) {
    const condition = findConditionById(query.value, conditionId)
    if (condition) Object.assign(condition, updates)
  }

  // Resolve the condition's saved shade in the family associated with its field.
  function getConditionColour(condition: QueryCondition): ConditionColour | undefined {
    return resolveConditionColour(condition, query.value.conditionColours)
  }

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

  // Create a blank-valued condition using the current database and an existing field.
  function createCondition(): QueryCondition {
    return {
      id: createId(),
      kind: 'condition',
      field: uniqueFields.value[0] ?? '',
      operatorId: operators.value[0]?.id ?? '',
      value: '',
    }
  }

  // Add a condition with defaults derived from the current query and database.
  function addCondition(groupId: string) {
    const group = findGroupById(query.value, groupId)

    if (group) {
      group.children.push(createCondition())
    }
  }

  // Add a group containing one condition with the current query and database defaults.
  function addGroup(groupId: string) {
    const group = findGroupById(query.value, groupId)

    if (group) {
      group.children.push({
        id: createId(),
        kind: 'group',
        mode: 'all',
        children: [createCondition()],
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
    operators,
    whereSqlResult,
    importSqlFilter,
    getConditionColour,
    updateCondition,
    uniqueFields,
    changeDatabase,
    cycleGroupMode,
    createCondition,
    addCondition,
    addGroup,
    removeNode,
  }
})
