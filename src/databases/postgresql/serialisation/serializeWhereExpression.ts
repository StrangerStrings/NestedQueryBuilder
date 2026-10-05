import { toSql, type Expr } from 'pgsql-ast-parser'

export type SerializeWhereExpressionResult =
  { success: true; sql: string } | { success: false; error: string }

// Delegate grouping, operator syntax, and escaping to the AST serializer, reporting failures.
export function serializeWhereExpression(expression: Expr): SerializeWhereExpressionResult {
  try {
    return { success: true, sql: toSql.expr(expression) }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? `Unable to serialize SQL expression: ${error.message}`
          : 'Unable to serialize SQL expression.',
    }
  }
}
