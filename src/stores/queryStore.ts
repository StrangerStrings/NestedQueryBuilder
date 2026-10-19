import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import type { ConditionValue, QueryCondition, QueryGroup } from '../types/query'
import type { DatabaseOperator, ValueDataType } from '../types/databaseOperator'
import { databaseDefinitions } from '../databases/DatabaseDefinitions'
import { getElasticsearchParameterNames } from '../databases/elasticsearch/parameters'
import {
  assignFieldColours,
  assignConditionColours,
  getConditionColour as resolveConditionColour,
} from '../colours/fieldColours'
import type { ConditionColour } from '../colours/palette'
import { createId } from '../utils/createId'
import { findGroupById } from '../utils/queryTree'
import { convertConditionValue } from '../utils/convertConditionValue'
import type {
  DatabaseAdapter,
  FilterImportResult,
  SchemaImportResult,
  SqlResult,
} from '../types/databaseAdapter'
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

// Create the shared default example with operators supported by the selected database.
function createInitialQuery(database: DatabaseId): QueryGroup {
  const equalityOperator = database === 'elasticsearch' ? 'term' : database === 'mongodb' ? 'eq' : '='
  const greaterThanOperator = database === 'elasticsearch' || database === 'mongodb' ? 'gt' : '>'

  return {
    kind: 'group',
    id: createId(),
    mode: 'all',
    children: [
      {
        kind: 'condition',
        id: createId(),
        field: { name: 'status', modifier: null },
        operatorId: equalityOperator,
        value: { hasValue: true, dataType: 'text', dataShape: 'single', value: 'active' },
      },

      {
        kind: 'condition',
        id: createId(),
        field: { name: 'status', modifier: null },
        operatorId: equalityOperator,
        value: { hasValue: true, dataType: 'text', dataShape: 'single', value: 'active' },
      },
      {
        kind: 'condition',
        id: createId(),
        field: { name: 'status', modifier: null },
        operatorId: equalityOperator,
        value: { hasValue: true, dataType: 'text', dataShape: 'single', value: 'active' },
      },
      {
        kind: 'condition',
        id: createId(),
        field: { name: 'status', modifier: null },
        operatorId: equalityOperator,
        value: { hasValue: true, dataType: 'text', dataShape: 'single', value: 'active' },
      },
      {
        kind: 'condition',
        id: createId(),
        field: { name: 'status', modifier: null },
        operatorId: equalityOperator,
        value: { hasValue: true, dataType: 'text', dataShape: 'single', value: 'active' },
      },
      {
        kind: 'condition',
        id: createId(),
        field: { name: 'status', modifier: null },
        operatorId: equalityOperator,
        value: { hasValue: true, dataType: 'text', dataShape: 'single', value: 'active' },
      },
      {
        kind: 'condition',
        id: createId(),
        field: { name: 'status', modifier: null },
        operatorId: equalityOperator,
        value: { hasValue: true, dataType: 'text', dataShape: 'single', value: 'active' },
      },
      {
        kind: 'condition',
        id: createId(),
        field: { name: 'status', modifier: null },
        operatorId: equalityOperator,
        value: { hasValue: true, dataType: 'text', dataShape: 'single', value: 'active' },
      },
      {
        kind: 'condition',
        id: createId(),
        field: { name: 'status', modifier: null },
        operatorId: equalityOperator,
        value: { hasValue: true, dataType: 'text', dataShape: 'single', value: 'active' },
      },
      {
        kind: 'condition',
        id: createId(),
        field: { name: 'score', modifier: null },
        operatorId: greaterThanOperator,
        value: { hasValue: true, dataType: 'number', dataShape: 'single', value: 9 },
      },
    ],
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

// Manage the query tree, on-demand database loading, and persistent field colours.
export const useQueryStore = defineStore('query', () => {
  const database = ref<DatabaseId>('postgresql')
  const loadedAdapter = shallowRef<DatabaseAdapter>()
  const databaseLoading = ref<DatabaseId | null>(null)
  const databaseLoadError = ref('')
  // Mount database-dependent views only after the initial adapter is available.
  const databaseReady = computed(() => loadedAdapter.value !== undefined)

  try {
    const savedDatabase = localStorage.getItem('query-builder.database')
    if (savedDatabase && Object.prototype.hasOwnProperty.call(databaseDefinitions, savedDatabase)) {
      database.value = savedDatabase as DatabaseId
    }
  } catch {
    // Keep PostgreSQL as the default when storage is unavailable.
  }

  const schemaFields = ref<string[]>([])
  const query = ref<QueryGroup>(createInitialQuery(database.value))

  // Persist the database selection immediately without saving query or schema contents.
  watch(
    database,
    (selectedDatabase) => {
      try {
        localStorage.setItem('query-builder.database', selectedDatabase)
      } catch {
        // Keep the in-memory selection when storage is unavailable.
      }
    },
    { flush: 'sync' },
  )

  // Require initialization before exposing database capabilities to query views.
  const adapter = computed<DatabaseAdapter>(() => {
    if (!loadedAdapter.value) throw new Error('The selected database has not loaded yet.')
    return loadedAdapter.value
  })
  const operators = computed(() => adapter.value.operators)

  // Preserve the previous schema suggestions unless the entire import succeeds.
  function importSchemaSql(sql: string): SchemaImportResult {
    const importer = adapter.value.importSchemaSql
    if (!importer)
      return {
        success: false,
        error: `${adapter.value.label} ${adapter.value.presentation?.schemaImportLabel ?? 'schema'} import is not supported.`,
      }
    const result = importer(sql)
    if (result.success) schemaFields.value = result.fields
    return result
  }

  // Regenerate SQL whenever the current query tree's fields, values, or structure change.
  const whereSqlResult = computed<SqlResult>(() => adapter.value.generateWhereSql(query.value))

  // Replace the tree on successful import; the existing watcher assigns imported condition colours.
  function importSqlFilter(filter: string): FilterImportResult {
    const importer = adapter.value.importSqlFilter
    if (!importer)
      return {
        success: false,
        error: {
          kind: 'unsupported-expression',
          message: `${adapter.value.label} ${adapter.value.presentation?.queryImportLabel ?? 'SQL filter'} import is not supported.`,
        },
      }
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

  // Convert operator values and discard parameters incompatible with the selected operator.
  function changeConditionOperator(conditionId: string, operatorId: string): boolean {
    const condition = findConditionById(query.value, conditionId)
    const operator = operators.value.find((candidate) => candidate.id === operatorId)
    if (!condition || !operator) return false

    const value = convertOperatorValue(condition.value, operator)
    if (value === undefined) return false

    Object.assign(condition, { operatorId, value })
    if (database.value === 'elasticsearch' && condition.parameters !== undefined) {
      const supported = getElasticsearchParameterNames(operatorId)
      // Narrow database-specific names before consulting the Elasticsearch catalogue.
      condition.parameters = condition.parameters.filter((parameter) =>
        parameter.name !== '$options' && supported.includes(parameter.name),
      )
    }
    if (database.value === 'mongodb' && condition.parameters !== undefined) {
      // Retain native regex options only on a compatible visual condition.
      condition.parameters = operatorId === 'regex' && condition.rawSql === undefined
        ? condition.parameters.filter(
          // Exclude parameter rows belonging to Elasticsearch.
          (parameter) => parameter.name === '$options',
        )
        : []
    }
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

  // Store Raw drafts and keep combined operator/parameter updates database-compatible.
  function updateCondition(
    conditionId: string,
    updates: Partial<
      Pick<QueryCondition, 'field' | 'operatorId' | 'value' | 'rawSql' | 'parameters'>
    >,
  ) {
    const condition = findConditionById(query.value, conditionId)
    if (!condition) return

    if (updates.rawSql !== undefined) {
      if (adapter.value.rawCondition || adapter.value.parseRawCondition) {
        condition.rawSql = updates.rawSql
        if (database.value === 'mongodb') delete condition.parameters
      }
      return
    }

    if (
      updates.field?.modifier != null &&
      !adapter.value.fieldModifiers?.includes(updates.field.modifier)
    )
      return

    if (updates.operatorId !== undefined) {
      if (!changeConditionOperator(conditionId, updates.operatorId)) return
    } else if (updates.value !== undefined) {
      condition.value = updates.value
    }

    if (updates.field !== undefined) condition.field = updates.field
    if (database.value === 'elasticsearch' && 'parameters' in updates) {
      condition.parameters = updates.parameters?.filter(
        // Keep MongoDB regex state outside Elasticsearch conditions.
        (parameter) => parameter.name !== '$options',
      )
      if (updates.operatorId !== undefined && condition.parameters !== undefined) {
        const supported = getElasticsearchParameterNames(condition.operatorId)
        // Exclude MongoDB options from combined Elasticsearch operator updates.
        condition.parameters = condition.parameters.filter((parameter) =>
          parameter.name !== '$options' && supported.includes(parameter.name),
        )
      }
    }
    if (database.value === 'mongodb' && 'parameters' in updates) {
      // Never attach regex state to another operator or a Raw condition.
      condition.parameters = condition.operatorId === 'regex' && condition.rawSql === undefined
        ? updates.parameters?.filter(
          // Store only the single native MongoDB parameter type.
          (parameter) => parameter.name === '$options',
        )
        : undefined
    }
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

  // Load before switching, then reset the query to the selected database’s default example.
  async function changeDatabase(next: DatabaseId) {
    if (
      databaseLoading.value ||
      (next === database.value && databaseReady.value) ||
      !Object.prototype.hasOwnProperty.call(databaseDefinitions, next)
    )
      return

    databaseLoading.value = next
    databaseLoadError.value = ''
    try {
      const nextAdapter = await databaseDefinitions[next].load()
      loadedAdapter.value = nextAdapter
      if (next !== database.value) {
        schemaFields.value = []
        query.value = createInitialQuery(next)
        database.value = next
      }
    } catch {
      databaseLoadError.value = `Could not load ${databaseDefinitions[next].label}. Please try again.`
    } finally {
      databaseLoading.value = null
    }
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

  // Move a direct child to an original-array boundary (0..length), not a final index.
  function moveNode(parentGroupId: string, nodeId: string, insertionIndex: number): boolean {
    const parent = findGroupById(query.value, parentGroupId)
    if (
      !parent ||
      nodeId === query.value.id ||
      !Number.isInteger(insertionIndex) ||
      insertionIndex < 0 ||
      insertionIndex > parent.children.length
    )
      return false

    const nodeIndex = parent.children.findIndex((child) => child.id === nodeId)
    const node = parent.children[nodeIndex]
    if (!node) return false

    if (insertionIndex === nodeIndex || insertionIndex === nodeIndex + 1) return true

    // Removing the source shifts later boundaries left by one; retain the original node.
    const destinationIndex = insertionIndex > nodeIndex ? insertionIndex - 1 : insertionIndex
    parent.children.splice(nodeIndex, 1)
    parent.children.splice(destinationIndex, 0, node)
    return true
  }

  // Transfer a direct child condition to a pre-mutation boundary, preserving its identity.
  function transferCondition(
    sourceGroupId: string,
    destinationGroupId: string,
    conditionId: string,
    insertionIndex: number,
  ): boolean {
    const source = findGroupById(query.value, sourceGroupId)
    const destination = findGroupById(query.value, destinationGroupId)
    if (
      !source ||
      !destination ||
      !Number.isInteger(insertionIndex) ||
      insertionIndex < 0 ||
      insertionIndex > destination.children.length
    )
      return false

    const conditionIndex = source.children.findIndex(
      (child) => child.kind === 'condition' && child.id === conditionId,
    )
    const condition = source.children[conditionIndex]
    if (!condition || condition.kind !== 'condition') return false

    if (source === destination) {
      return moveNode(sourceGroupId, conditionId, insertionIndex)
    }

    source.children.splice(conditionIndex, 1)
    destination.children.splice(insertionIndex, 0, condition)
    return true
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

  // Clear Raw conditions in place when configured, otherwise convert SQL atomically on success.
  function editRawCondition(conditionId: string): string | null {
    const condition = findConditionById(query.value, conditionId)
    if (!condition) return 'Condition no longer exists.'
    if (condition.rawSql === undefined) return null
    if (adapter.value.rawCondition?.clearOnReturn) {
      const operator = operators.value[0]
      const value = operator ? convertOperatorValue({ hasValue: false }, operator) : undefined
      condition.field = { name: '', modifier: null }
      condition.operatorId = value !== undefined && operator ? operator.id : ''
      condition.value = value ?? { hasValue: false }
      delete condition.rawSql
      delete condition.parameters
      return null
    }
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
    loadedAdapter,
    databaseReady,
    databaseLoading,
    databaseLoadError,
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
    moveNode,
    transferCondition,
    addGroup,
    removeNode,
  }
})
