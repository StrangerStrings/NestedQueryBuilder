import { toSql, type Expr } from 'pgsql-ast-parser'

export type SerializeWhereExpressionResult =
  { success: true; sql: string } | { success: false; error: string }

// Use SQL precedence to keep only necessary brackets, retaining library escaping and fallback output.
function serializeReadableExpression(expression: Expr, parentPrecedence = 0): string {
  let precedence = 6
  let sql: string

  if (
    expression.type === 'binary' &&
    !expression.opSchema &&
    (expression.op === 'AND' || expression.op === 'OR')
  ) {
    precedence = expression.op === 'AND' ? 2 : 1
    const left = serializeReadableExpression(expression.left, precedence)
    const right = serializeReadableExpression(expression.right, precedence)
    sql = `${left} ${expression.op} ${right}`
  } else if (
    expression.type === 'binary' &&
    !expression.opSchema &&
    (expression.op === '=' || expression.op === '>')
  ) {
    precedence = 4
    const left = serializeReadableExpression(expression.left, precedence + 1)
    const right = serializeReadableExpression(expression.right, precedence + 1)
    sql = `${left} ${expression.op} ${right}`
  } else if (expression.type === 'unary' && !expression.opSchema && expression.op === 'NOT') {
    precedence = 3
    sql = `NOT ${serializeReadableExpression(expression.operand, precedence)}`
  } else if (
    expression.type === 'unary' &&
    !expression.opSchema &&
    expression.op === 'IS NULL' &&
    expression.operand.type === 'ref'
  ) {
    precedence = 4
    sql = `${toSql.ref(expression.operand)} IS NULL`
  } else if (expression.type === 'ref') {
    sql = toSql.ref(expression)
  } else if (
    expression.type === 'string' ||
    expression.type === 'integer' ||
    expression.type === 'numeric' ||
    expression.type === 'boolean' ||
    expression.type === 'null'
  ) {
    sql = toSql.constant(expression)
  } else {
    sql = toSql.expr(expression)
  }

  return precedence < parentPrecedence ? `(${sql})` : sql
}

// Serialize a WHERE expression with readable grouping and report serialization failures.
export function serializeWhereExpression(expression: Expr): SerializeWhereExpressionResult {
  try {
    return { success: true, sql: serializeReadableExpression(expression) }
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
