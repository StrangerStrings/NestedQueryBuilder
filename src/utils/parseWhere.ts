import { parse, type Expr } from 'pgsql-ast-parser'

export type ParseWhereResult =
  { success: true; expression: Expr | null } | { success: false; error: string }

// Parse one SQL filter, rejecting extra statements or clauses outside its WHERE expression.
export function parseWhere(filter: string): ParseWhereResult {
  const trimmed = filter.trim()

  if (!trimmed) {
    return { success: true, expression: null }
  }

  const condition = trimmed.replace(/^where\b/i, '').trim()

  try {
    const statements = parse(`SELECT 1 WHERE ${condition}`)
    const statement = statements[0]

    if (statements.length !== 1 || statement?.type !== 'select' || !statement.where) {
      return { success: false, error: 'Expected a single SQL filter expression.' }
    }

    if (
      statement.groupBy ||
      statement.having ||
      statement.orderBy ||
      statement.limit ||
      statement.for ||
      statement.skip
    ) {
      return { success: false, error: 'Expected a SQL filter without additional SELECT clauses.' }
    }

    return { success: true, expression: statement.where }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid SQL filter syntax.',
    }
  }
}
