import type { FilterImportResult } from '../../../types/databaseAdapter'
import type { QueryGroup, QueryNode } from '../../../types/query'
import { createId } from '../../../utils/createId'
import { generateMysqlConditionSql } from '../serialisation/generateConditionSql'
import { importMysqlCondition } from './importCondition'
import { parseMysqlWhere, type MysqlExpression } from './parseWhere'
import { validateMysqlRaw } from './validateRaw'

type NodeResult =
  | { success: true; node: QueryNode }
  | Extract<FilterImportResult, { success: false }>

// Convert complete logical operands, flattening only groups with the same combining mode.
function importNode(expression: MysqlExpression): NodeResult {
  if (expression.kind === 'logical') {
    const children: QueryNode[] = []
    for (const operand of expression.children) {
      const result = importNode(operand)
      if (!result.success) return result
      if (result.node.kind === 'group' && result.node.mode === expression.mode) children.push(...result.node.children)
      else children.push(result.node)
    }
    return { success: true, node: { kind: 'group', id: createId(), mode: expression.mode, children } }
  }
  if (expression.kind === 'not') {
    const result = importNode(expression.child)
    if (!result.success) return result
    const children = result.node.kind === 'group' && result.node.mode === 'any' ? result.node.children : [result.node]
    return { success: true, node: { kind: 'group', id: createId(), mode: 'none', children } }
  }
  const converted = importMysqlCondition(expression)
  if (converted.success && generateMysqlConditionSql(converted.condition).success) {
    return { success: true, node: converted.condition }
  }
  const raw = validateMysqlRaw(expression.source)
  if (!raw.success) {
    return { success: false, error: { kind: 'unsupported-expression', message: raw.error, fragment: expression.source } }
  }
  return { success: true, node: {
    kind: 'condition', id: createId(), rawSql: expression.source,
    field: { name: '', modifier: null }, operatorId: '', value: { hasValue: false },
  } }
}

// Parse and convert atomically; the store replaces the query only after this returns a complete tree.
export function importMysqlWhere(sql: string): FilterImportResult {
  const parsed = parseMysqlWhere(sql)
  if (!parsed.success) return { success: false, error: { kind: 'syntax', message: parsed.error, fragment: sql.trim() } }
  if (!parsed.expression) return { success: true, tree: { kind: 'group', id: createId(), mode: 'all', children: [] } }
  const result = importNode(parsed.expression)
  if (!result.success) return result
  const tree: QueryGroup = result.node.kind === 'group'
    ? result.node : { kind: 'group', id: createId(), mode: 'all', children: [result.node] }
  return { success: true, tree }
}

// Convert raw text to one visual condition without conflating valid opaque SQL with syntax errors.
export function parseMysqlRawCondition(sql: string):
  | { success: true; condition: Extract<QueryNode, { kind: 'condition' }> }
  | { success: false; error: string } {
  const parsed = parseMysqlWhere(sql)
  if (!parsed.success) return parsed
  if (!parsed.expression) return { success: false, error: 'A condition expression is required.' }
  if (parsed.expression.kind !== 'leaf') return { success: false, error: 'This expression requires Raw mode. Logical expressions cannot become a single visual condition.' }
  const result = importMysqlCondition(parsed.expression)
  if (!result.success) return { success: false, error: `This expression requires Raw mode. ${result.error.message}` }
  const generated = generateMysqlConditionSql(result.condition)
  return generated.success ? result : { success: false, error: `This expression requires Raw mode. ${generated.error}` }
}
