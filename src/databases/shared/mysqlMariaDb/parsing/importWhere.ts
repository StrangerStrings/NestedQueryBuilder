import type { FilterImportResult, SqlResult } from '../../../../types/databaseAdapter'
import type { QueryGroup, QueryNode } from '../../../../types/query'
import { createId } from '../../../../utils/createId'
import type { VisualConditionResult } from './importCondition'
import type { SqlFilterExpression, SqlFilterParseResult } from './parseWhere'

type RawResult = { success: true; expression: SqlFilterExpression } | { success: false; error: string }
type FilterOperations = {
  parse: (sql: string) => SqlFilterParseResult
  importCondition: (expression: SqlFilterExpression) => VisualConditionResult
  generateCondition: (condition: Extract<QueryNode, { kind: 'condition' }>) => SqlResult
  validateRaw: (sql: string) => RawResult
}

type NodeResult =
  | { success: true; node: QueryNode }
  | Extract<FilterImportResult, { success: false }>

// Convert complete logical operands, flattening only groups with the same combining mode.
function importNode(expression: SqlFilterExpression, operations: FilterOperations): NodeResult {
  if (expression.kind === 'logical') {
    const children: QueryNode[] = []
    for (const operand of expression.children) {
      const result = importNode(operand, operations)
      if (!result.success) return result
      if (result.node.kind === 'group' && result.node.mode === expression.mode) children.push(...result.node.children)
      else children.push(result.node)
    }
    return { success: true, node: { kind: 'group', id: createId(), mode: expression.mode, children } }
  }
  if (expression.kind === 'not') {
    const result = importNode(expression.child, operations)
    if (!result.success) return result
    const children = result.node.kind === 'group' && result.node.mode === 'any' ? result.node.children : [result.node]
    return { success: true, node: { kind: 'group', id: createId(), mode: 'none', children } }
  }
  const converted = operations.importCondition(expression)
  if (converted.success && operations.generateCondition(converted.condition).success) {
    return { success: true, node: converted.condition }
  }
  const raw = operations.validateRaw(expression.source)
  if (!raw.success) {
    return { success: false, error: { kind: 'unsupported-expression', message: raw.error, fragment: expression.source } }
  }
  return { success: true, node: {
    kind: 'condition', id: createId(), rawSql: expression.source,
    field: { name: '', modifier: null }, operatorId: '', value: { hasValue: false },
  } }
}

// Parse and convert atomically; the store replaces the query only after this returns a complete tree.
export function importCompatibleWhere(sql: string, operations: FilterOperations): FilterImportResult {
  const parsed = operations.parse(sql)
  if (!parsed.success) return { success: false, error: { kind: parsed.kind ?? 'syntax', message: parsed.error, fragment: sql.trim() } }
  if (!parsed.expression) return { success: true, tree: { kind: 'group', id: createId(), mode: 'all', children: [] } }
  const result = importNode(parsed.expression, operations)
  if (!result.success) return result
  const tree: QueryGroup = result.node.kind === 'group'
    ? result.node : { kind: 'group', id: createId(), mode: 'all', children: [result.node] }
  return { success: true, tree }
}

// Convert raw text to one visual condition without conflating valid opaque SQL with syntax errors.
export function parseCompatibleRawCondition(sql: string, operations: FilterOperations):
  | { success: true; condition: Extract<QueryNode, { kind: 'condition' }> }
  | { success: false; error: string } {
  const parsed = operations.parse(sql)
  if (!parsed.success) return parsed
  if (!parsed.expression) return { success: false, error: 'A condition expression is required.' }
  if (parsed.expression.kind !== 'leaf') return { success: false, error: 'This expression requires Raw mode. Logical expressions cannot become a single visual condition.' }
  const result = operations.importCondition(parsed.expression)
  if (!result.success) return { success: false, error: `This expression requires Raw mode. ${result.error.message}` }
  const generated = operations.generateCondition(result.condition)
  return generated.success ? result : { success: false, error: `This expression requires Raw mode. ${generated.error}` }
}
