import type { Expr } from 'pgsql-ast-parser'
import type { QueryGroup } from '../types/query'
import { exportWhereCondition } from './exportWhereCondition'

export type ExportWhereGroupResult =
  { success: true; expression: Expr | null } | { success: false; error: string; nodeId: string }

// Omit empty children and propagate conversion errors with the offending node's ID.
export function exportWhereGroup(group: QueryGroup): ExportWhereGroupResult {
  const expressions: Expr[] = []

  for (const child of group.children) {
    const result = child.kind === 'group' ? exportWhereGroup(child) : exportWhereCondition(child)
    if (!result.success) return result
    if (result.expression === null) continue

    expressions.push(result.expression)
  }

  const [first, ...remaining] = expressions
  if (!first) return { success: true, expression: null }

  if (group.mode !== 'all' && group.mode !== 'any' && group.mode !== 'none') {
    return { success: false, error: `Unsupported group mode: ${group.mode}.`, nodeId: group.id }
  }

  let expression: Expr = first
  const operator = group.mode === 'all' ? 'AND' : 'OR'
  for (const child of remaining) {
    expression = { type: 'binary', op: operator, left: expression, right: child }
  }

  if (group.mode === 'none') {
    expression = { type: 'unary', op: 'NOT', operand: expression }
  }

  return { success: true, expression }
}
