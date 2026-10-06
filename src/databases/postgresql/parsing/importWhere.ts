import { toSql, type Expr } from 'pgsql-ast-parser'
import type { QueryGroup, QueryNode } from '../../../types/query'
import { createId } from '../../../utils/createId'
import { importWhereCondition } from './importWhereCondition'
import { createImportWhereError, type ImportWhereError } from './importWhereError'
import { parseWhere } from './parseWhere'

export type ImportWhereResult =
  { success: true; tree: QueryGroup } | { success: false; error: ImportWhereError }

type ImportWhereNodeResult =
  { success: true; node: QueryNode } | { success: false; error: ImportWhereError }

// Preserve logical groups and import unsupported conditions as complete raw SQL expressions.
function importWhereNode(expression: Expr): ImportWhereNodeResult {
  if (
    expression.type === 'binary' &&
    !expression.opSchema &&
    (expression.op === 'AND' || expression.op === 'OR')
  ) {
    const left = importWhereNode(expression.left)
    if (!left.success) return left

    const right = importWhereNode(expression.right)
    if (!right.success) return right

    const mode = expression.op === 'AND' ? 'all' : 'any'
    const children: QueryNode[] = []
    for (const child of [left.node, right.node]) {
      if (child.kind === 'group' && child.mode === mode) {
        children.push(...child.children)
      } else {
        children.push(child)
      }
    }

    return {
      success: true,
      node: {
        kind: 'group',
        id: createId(),
        mode,
        children,
      },
    }
  }

  if (expression.type === 'unary' && !expression.opSchema && expression.op === 'NOT') {
    const operand = importWhereNode(expression.operand)
    if (!operand.success) return operand

    const children =
      operand.node.kind === 'group' && operand.node.mode === 'any'
        ? operand.node.children
        : [operand.node]

    return {
      success: true,
      node: { kind: 'group', id: createId(), mode: 'none', children },
    }
  }

  const result = importWhereCondition(expression)
  if (result.success) return { success: true, node: result.condition }

  try {
    return {
      success: true,
      node: {
        kind: 'condition',
        id: createId(),
        rawSql: toSql.expr(expression),
        field: { name: '', modifier: null },
        operatorId: '',
        value: { hasValue: false },
      },
    }
  } catch {
    // Keep the conversion error if the parser cannot serialize the complete condition safely.
    return result
  }
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
