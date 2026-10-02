import type { Expr } from 'pgsql-ast-parser'
import type { QueryGroup, QueryNode } from '../types/query'
import { createId } from './createId'
import { importWhereCondition } from './importWhereCondition'
import { createImportWhereError, type ImportWhereError } from './importWhereError'
import { parseWhere } from './parseWhere'

export type ImportWhereResult =
  { success: true; tree: QueryGroup } | { success: false; error: ImportWhereError }

type ImportWhereNodeResult =
  { success: true; node: QueryNode } | { success: false; error: ImportWhereError }

// Recursively convert logical nesting, returning the first leaf error without a partial tree.
function importWhereNode(expression: Expr): ImportWhereNodeResult {
  if (expression.type === 'binary' && (expression.op === 'AND' || expression.op === 'OR')) {
    const left = importWhereNode(expression.left)
    if (!left.success) return left

    const right = importWhereNode(expression.right)
    if (!right.success) return right

    return {
      success: true,
      node: {
        kind: 'group',
        id: createId(),
        mode: expression.op === 'AND' ? 'all' : 'any',
        children: [left.node, right.node],
      },
    }
  }

  if (expression.type === 'unary' && expression.op === 'NOT') {
    const operand = importWhereNode(expression.operand)
    if (!operand.success) return operand

    return {
      success: true,
      node: { kind: 'group', id: createId(), mode: 'none', children: [operand.node] },
    }
  }

  const result = importWhereCondition(expression)
  if (!result.success) return result

  return { success: true, node: result.condition }
}

// Return a complete group root or a conversion error for the parsed filter.
export function importWhere(expression: Expr | null | undefined): ImportWhereResult {
  if (expression == null) {
    return {
      success: true,
      tree: { kind: 'group', id: createId(), mode: 'all', children: [] },
    }
  }

  const result = importWhereNode(expression)
  if (!result.success) return result

  return {
    success: true,
    tree:
      result.node.kind === 'group'
        ? result.node
        : { kind: 'group', id: createId(), mode: 'all', children: [result.node] },
  }
}

// Parse and convert a SQL filter atomically through one standalone entry point.
export function importSqlWhere(filter: string): ImportWhereResult {
  const parsed = parseWhere(filter)
  if (!parsed.success) {
    return {
      success: false,
      error: { ...createImportWhereError('syntax', parsed.error), fragment: filter.trim() },
    }
  }

  const result = importWhere(parsed.expression)
  if (!result.success && !result.error.fragment) {
    return { success: false, error: { ...result.error, fragment: filter.trim() } }
  }
  return result
}
