import { toSql, type Expr, type ExprCall, type ExprRef } from 'pgsql-ast-parser'
import { normaliseConditionOperatorId } from '../conditionHandling'
import { postgresqlOperators } from '../operators'

export type SerializeWhereExpressionResult =
  { success: true; sql: string } | { success: false; error: string }

// Recognise only editor-generated scalar literals and explicit local temporal casts as atomic values.
function isEditorLiteral(expression: Expr): boolean {
  if (
    expression.type === 'string' ||
    expression.type === 'integer' ||
    expression.type === 'numeric' ||
    expression.type === 'boolean'
  ) {
    return true
  }
  return (
    expression.type === 'cast' &&
    expression.operand.type === 'string' &&
    expression.to.kind !== 'array' &&
    !expression.to.schema &&
    !expression.to.doubleQuoted &&
    !expression.to.config &&
    ['date', 'time without time zone', 'timestamp without time zone'].includes(expression.to.name)
  )
}

// Use library literal escaping without scalar parentheses, retaining conservative cast rendering.
function renderLiteral(expression: Expr): string {
  if (
    expression.type === 'string' ||
    expression.type === 'integer' ||
    expression.type === 'numeric' ||
    expression.type === 'boolean'
  ) {
    return toSql.constant(expression)
  }
  return toSql.expr(expression)
}

// Recognise column references and a single function call whose sole argument is a column reference.
function isEditorField(expression: Expr): expression is ExprRef | ExprCall {
  return (
    expression.type === 'ref' ||
    (expression.type === 'call' &&
      !expression.function.schema &&
      expression.args.length === 1 &&
      expression.args[0]?.type === 'ref')
  )
}

// Use library escaping for plain and modified fields without unnecessary expression parentheses.
function renderField(expression: ExprRef | ExprCall): string {
  return expression.type === 'ref' ? toSql.ref(expression) : toSql.call(expression)
}

// Render logical chains and conditions, including column comparisons, grouping other shapes safely.
function renderReadableExpression(expression: Expr, parentLogical?: 'AND' | 'OR'): string {
  if (expression.type === 'binary' && !expression.opSchema) {
    if (expression.op === 'AND' || expression.op === 'OR') {
      const sql = [
        renderReadableExpression(expression.left, expression.op),
        renderReadableExpression(expression.right, expression.op),
      ].join(` ${expression.op} `)
      return parentLogical && parentLogical !== expression.op ? `(${sql})` : sql
    }
  }
  if (expression.type === 'unary' && !expression.opSchema && expression.op === 'NOT') {
    return `NOT (${renderReadableExpression(expression.operand)})`
  }

  if (
    (expression.type === 'binary' || expression.type === 'unary' || expression.type === 'ternary') &&
    !((expression.type === 'binary' || expression.type === 'unary') && expression.opSchema)
  ) {
    const kind = postgresqlOperators.find(
      (operator) => operator.id === normaliseConditionOperatorId(expression.op),
    )?.serialisation.kind
    if (expression.type === 'binary' && isEditorField(expression.left)) {
      if (kind === 'comparison' && expression.right.type === 'ref') {
        return `${renderField(expression.left)} ${expression.op} ${renderField(expression.right)}`
      }
      if (kind === 'comparison' && isEditorLiteral(expression.right)) {
        return `${renderField(expression.left)} ${expression.op} ${renderLiteral(expression.right)}`
      }
      if (
        kind === 'membership' &&
        expression.right.type === 'list' &&
        expression.right.expressions.length > 0 &&
        expression.right.expressions.every(isEditorLiteral)
      ) {
        const values = expression.right.expressions.map(renderLiteral).join(', ')
        return `${renderField(expression.left)} ${expression.op} (${values})`
      }
    }
    if (
      kind === 'between' &&
      expression.type === 'ternary' &&
      isEditorField(expression.value) &&
      isEditorLiteral(expression.lo) &&
      isEditorLiteral(expression.hi)
    ) {
      return `${renderField(expression.value)} ${expression.op} ${renderLiteral(expression.lo)} AND ${renderLiteral(expression.hi)}`
    }
    if (kind === 'unary' && expression.type === 'unary' && isEditorField(expression.operand)) {
      return `${renderField(expression.operand)} ${expression.op}`
    }
  }

  return isEditorLiteral(expression) ? renderLiteral(expression) : toSql.expr(expression)
}

// Render readable supported expressions while preserving the public result and serialization errors.
export function serializeWhereExpression(expression: Expr): SerializeWhereExpressionResult {
  try {
    return { success: true, sql: renderReadableExpression(expression) }
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
