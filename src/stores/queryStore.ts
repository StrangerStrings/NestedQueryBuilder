import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { ConditionValue, QueryCondition, QueryGroup } from '../types/query'
import type { DatabaseOperator, ValueDataType } from '../types/databaseOperator'
import { databaseDefinitions } from '../databases/DatabaseDefinitions'
import {
  assignFieldColours,
  assignConditionColours,
  getConditionColour as resolveConditionColour,
} from '../colours/fieldColours'
import type { ConditionColour } from '../colours/palette'
import { createId } from '../utils/createId'
import { convertConditionValue } from '../utils/convertConditionValue'
import type { DatabaseAdapter, FilterImportResult, SchemaImportResult, SqlResult } from '../types/databaseAdapter'
import type { DatabaseId } from '../databases/DatabaseDefinitions'
export type { DatabaseId } from '../databases/DatabaseDefinitions'

// Allow the literal and field types implemented by the shared converter.
function isSupportedValueType(
  dataType: ValueDataType,
): dataType is 'text' | 'number' | 'boolean' | 'date' | 'time' | 'datetime' | 'field' {
  return (
    dataType === 'text' ||
    dataType === 'number' ||
    dataType === 'boolean' ||
    dataType === 'date' ||
    dataType === 'time' ||
    dataType === 'datetime' ||
    dataType === 'field'
  )
}

// Resolve allowed literal or field targets from metadata and convert their values and shapes.
function convertOperatorValue(
  source: ConditionValue,
  operator: DatabaseOperator,
  requestedType?: ValueDataType,
): ConditionValue | undefined {
  const input = operator.valueInput
  if (!input.hasValue) {
    return requestedType === undefined
      ? convertConditionValue(source, { hasValue: false })
      : undefined
  }
  if (source.hasValue && !isSupportedValueType(source.dataType)) {
    source = { hasValue: false }
  }

  const dataType =
    requestedType ??
    (source.hasValue && input.dataTypes.includes(source.dataType)
      ? source.dataType
      : input.dataTypes.find(isSupportedValueType))
  if (!dataType || !isSupportedValueType(dataType) || !input.dataTypes.includes(dataType)) return

  const shape = input.dataShape
  switch (dataType) {
    case 'field':
    case 'text':
    case 'date':
    case 'time':
    case 'datetime':
      return convertConditionValue(
        source,
        shape === 'single'
          ? { hasValue: true, dataType, dataShape: shape, value: '' }
          : shape === 'range'
            ? { hasValue: true, dataType, dataShape: shape, value: ['', ''] }
            : { hasValue: true, dataType, dataShape: shape, value: [''] },
      )
    case 'number':
      return convertConditionValue(
        source,
        shape === 'single'
          ? { hasValue: true, dataType, dataShape: shape, value: 0 }
          : shape === 'range'
            ? { hasValue: true, dataType, dataShape: shape, value: [0, 0] }
            : { hasValue: true, dataType, dataShape: shape, value: [0] },
      )
    case 'boolean':
      return convertConditionValue(
        source,
        shape === 'single'
          ? { hasValue: true, dataType, dataShape: shape, value: false }
          : shape === 'range'
            ? { hasValue: true, dataType, dataShape: shape, value: [false, false] }
            : { hasValue: true, dataType, dataShape: shape, value: [false] },
      )
  }
}

// Preserve the existing startup example for the default database.
function createInitialQuery(): QueryGroup {
  return {
    kind: 'group',
    id: createId(),
    mode: 'all',
    children: [
      {
        kind: 'condition',
        id: createId(),
        field: { name: 'status', modifier: null },
        operatorId: '=',
        value: { hasValue: true, dataType: 'text', dataShape: 'single', value: 'online' },
      },
      {
        kind: 'condition',
        id: createId(),
        field: { name: 'tatters', modifier: null },
        operatorId: '=',
        value: { hasValue: true, dataType: 'text', dataShape: 'single', value: 'yes' },
      },
      {
        kind: 'condition',
        id: createId(),
        field: { name: 'age', modifier: null },
        operatorId: '=',
        value: { hasValue: true, dataType: 'text', dataShape: 'single', value: '35' },
      },
      {
        kind: 'condition',
        id: createId(),
        field: { name: 'asdf', modifier: null },
        operatorId: '=',
        value: { hasValue: true, dataType: 'text', dataShape: 'single', value: 'online' },
      },
      {
        kind: 'condition',
        id: createId(),
        field: { name: 'trew', modifier: null },
        operatorId: '=',
        value: { hasValue: true, dataType: 'text', dataShape: 'single', value: 'online' },
      },
      {
        kind: 'condition',
        id: createId(),
        field: { name: 'rewwer', modifier: null },
        operatorId: '=',
        value: { hasValue: true, dataType: 'text', dataShape: 'single', value: 'online' },
      },
      {
        kind: 'condition',
        id: createId(),
        field: { name: 'age', modifier: null },
        operatorId: '=',
        value: { hasValue: true, dataType: 'text', dataShape: 'single', value: 'online' },
      },
    ],
  }
}

// Start a database switch with an empty shared root and fresh identity.
function createEmptyQuery(): QueryGroup {
  return { kind: 'group', id: createId(), mode: 'all', children: [] }
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
  const schemaFields = ref<string[]>([])
  const query = ref<QueryGroup>(createInitialQuery())
  // Resolve capabilities and SQL operations from the active database adapter.
  const adapter = computed<DatabaseAdapter>(() => databaseDefinitions[database.value])
  const operators = computed(() => adapter.value.operators)

  // Preserve the previous schema suggestions unless the entire import succeeds.
  function importSchemaSql(sql: string): SchemaImportResult {
    const importer = adapter.value.importSchemaSql
    if (!importer) return { success: false, error: `${adapter.value.label} schema import is not supported.` }
    const result = importer(sql)
    if (result.success) schemaFields.value = result.fields
    return result
  }

  // Regenerate SQL whenever the current query tree's fields, values, or structure change.
  const whereSqlResult = computed<SqlResult>(() => adapter.value.generateWhereSql(query.value))

  // Replace the tree on successful import; the existing watcher assigns imported condition colours.
  function importSqlFilter(filter: string): FilterImportResult {
    const importer = adapter.value.importSqlFilter
    if (!importer) return { success: false, error: { kind: 'unsupported-expression', message: `${adapter.value.label} SQL filter import is not supported.` } }
    const result = importer(filter)
    if (result.success) {
      query.value = result.tree
    }
    return result
  }

  // Save active colours, transferring unused assignments as condition fields change.
  function reserveConditionColours(
    conditions: Pick<QueryCondition, 'id' | 'field'>[],
    previousConditions: Pick<QueryCondition, 'id' | 'field'>[] = [],
  ) {
    const assignments = assignFieldColours(conditions, query.value.fieldColours, previousConditions)

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
        field: { ...condition.field, name: condition.field.name.trim() },
      })),
    reserveConditionColours,
    { immediate: true, flush: 'pre' },
  )

  // Convert before applying the operator and value together, leaving unsupported requests unchanged.
  function changeConditionOperator(conditionId: string, operatorId: string): boolean {
    const condition = findConditionById(query.value, conditionId)
    const operator = operators.value.find((candidate) => candidate.id === operatorId)
    if (!condition || !operator) return false

    const value = convertOperatorValue(condition.value, operator)
    if (value === undefined) return false

    Object.assign(condition, { operatorId, value })
    return true
  }

  // Change an allowed selected type using the current operator's required input shape.
  function changeConditionValueType(conditionId: string, dataType: ValueDataType) {
    const condition = findConditionById(query.value, conditionId)
    if (!condition) return

    const operator = operators.value.find((candidate) => candidate.id === condition.operatorId)
    if (!operator) return

    const value = convertOperatorValue(condition.value, operator, dataType)
    if (value !== undefined) condition.value = value
  }

  // Enforce adapter capabilities before applying fields, raw text, or operator/value edits.
  function updateCondition(
    conditionId: string,
    updates: Partial<Pick<QueryCondition, 'field' | 'operatorId' | 'value' | 'rawSql'>>,
  ) {
    const condition = findConditionById(query.value, conditionId)
    if (!condition) return

    if (updates.rawSql !== undefined) {
      if (adapter.value.parseRawCondition) condition.rawSql = updates.rawSql
      return
    }

    if (updates.field?.modifier != null && !adapter.value.fieldModifiers?.includes(updates.field.modifier)) return

    if (updates.operatorId !== undefined) {
      if (!changeConditionOperator(conditionId, updates.operatorId)) return
    } else if (updates.value !== undefined) {
      condition.value = updates.value
    }

    if (updates.field !== undefined) condition.field = updates.field
  }

  // Resolve the condition's saved shade in the family associated with its field.
  function getConditionColour(condition: QueryCondition): ConditionColour | undefined {
    return resolveConditionColour(condition, query.value.conditionColours)
  }

  // Combine imported schema fields with query-derived suggestions, removing duplicates.
  const uniqueFields = computed(() => {
    const fields = new Set<string>(schemaFields.value)

    for (const condition of getConditions(query.value)) {
      if (condition.field.name.trim()) {
        fields.add(condition.field.name)
      }
    }

    return [...fields]
  })

  // Clear query and schema state only when changing to a different supported database.
  function changeDatabase(next: DatabaseId) {
    if (next === database.value || !(next in databaseDefinitions)) return

    database.value = next
    schemaFields.value = []
    query.value = createEmptyQuery()
  }

  function cycleGroupMode(groupId: string) {
    const group = findGroupById(query.value, groupId)

    if (group) {
      group.mode = group.mode === 'all' ? 'any' : group.mode === 'any' ? 'none' : 'all'
    }
  }

  // Derive fresh defaults from the selected operator's metadata through the shared converter.
  function createCondition(): QueryCondition {
    const operator = operators.value[0]
    const value = operator ? convertOperatorValue({ hasValue: false }, operator) : undefined

    return {
      id: createId(),
      kind: 'condition',
      field: { name: uniqueFields.value[0] ?? '', modifier: null },
      operatorId: value !== undefined && operator ? operator.id : '',
      value: value ?? { hasValue: false },
    }
  }

  // Add and return a condition so the editor can select it immediately.
  function addCondition(groupId: string) {
    const group = findGroupById(query.value, groupId)

    if (group) {
      const condition = createCondition()
      group.children.push(condition)
      return condition
    }
  }

  // Add a group and return its initial condition so the editor can select it.
  function addGroup(groupId: string) {
    const group = findGroupById(query.value, groupId)

    if (group) {
      const condition = createCondition()
      group.children.push({
        id: createId(),
        kind: 'group',
        mode: 'all',
        children: [condition],
      })
      return condition
    }
  }

  function removeNode(nodeId: string) {
    if (nodeId !== query.value.id) {
      if (removeNodeFromGroup(query.value, nodeId)) {
      }
    }
  }

  // Convert supported raw SQL atomically, leaving the current expression intact on failure.
  function editRawCondition(conditionId: string): string | null {
    const condition = findConditionById(query.value, conditionId)
    if (!condition) return 'Condition no longer exists.'
    if (condition.rawSql === undefined) return null
    const parser = adapter.value.parseRawCondition
    if (!parser) return `${adapter.value.label} raw SQL editing is not supported.`
    const result = parser(condition.rawSql)
    if (!result.success) return result.error
    const { field, operatorId, value } = result.condition
    Object.assign(condition, { field, operatorId, value })
    delete condition.rawSql
    return null
  }

  return {
    database,
    adapter,
    schemaFields,
    importSchemaSql,
    editRawCondition,
    query,
    operators,
    whereSqlResult,
    importSqlFilter,
    getConditionColour,
    updateCondition,
    changeConditionOperator,
    changeConditionValueType,
    uniqueFields,
    changeDatabase,
    cycleGroupMode,
    createCondition,
    addCondition,
    addGroup,
    removeNode,
  }
})
