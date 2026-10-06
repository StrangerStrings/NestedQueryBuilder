import type { Expr } from 'pgsql-ast-parser'
import type { ConditionValue } from '../../types/query'
import type { PostgresqlOperator } from './operators'

type ConditionAstParts = {
  field: Expr
  literals: Expr[]
  dataShape: 'single' | 'list' | 'range' | null
  valueExpression: Expr
}
type ReadConditionAstResult =
  { success: true; parts: ConditionAstParts } | { success: false; error: string }
type CreateConditionAstResult =
  { success: true; expression: Expr } | { success: false; error: string }

// The installed parser represents both SQL inequality spellings as != in its AST.
export function normaliseConditionOperatorId(operatorId: string): string {
  return operatorId === '!=' ? '<>' : operatorId
}

// Extract metadata-selected AST positions, accepting the parser's canonical inequality alias.
export function readConditionAst(
  operator: PostgresqlOperator,
  expression: Expr,
): ReadConditionAstResult {
  switch (operator.parsing.kind) {
    case 'comparison':
      if (
        expression.type === 'binary' &&
        normaliseConditionOperatorId(expression.op) === operator.id
      ) {
        return {
          success: true,
          parts: {
            field: expression.left,
            literals: [expression.right],
            dataShape: 'single',
            valueExpression: expression.right,
          },
        }
      }
      break
    case 'membership':
      if (expression.type === 'binary' && expression.op === operator.id) {
        return {
          success: true,
          parts: {
            field: expression.left,
            // The parser unwraps a one-item IN list into its lone expression.
            literals:
              expression.right.type === 'list'
                ? expression.right.expressions
                : [expression.right],
            dataShape: 'list',
            valueExpression: expression.right,
          },
        }
      }
      break
    case 'between':
      if (expression.type === 'ternary' && expression.op === operator.id) {
        return {
          success: true,
          parts: {
            field: expression.value,
            literals: [expression.lo, expression.hi],
            dataShape: 'range',
            valueExpression: expression,
          },
        }
      }
      break
    case 'unary':
      if (expression.type === 'unary' && expression.op === operator.id) {
        return {
          success: true,
          parts: {
            field: expression.operand,
            literals: [],
            dataShape: null,
            valueExpression: expression,
          },
        }
      }
      break
  }
  return { success: false, error: `Unsupported AST structure for SQL operator: ${operator.id}.` }
}

// Validate presence, shape, and type against the operator's inferred valueInput metadata.
export function validateConditionValue(
  operator: PostgresqlOperator,
  value: ConditionValue,
): string | undefined {
  const valueInput = operator.valueInput
  if (!valueInput.hasValue) {
    return value.hasValue === false
      ? undefined
      : `${operator.id} requires a value with hasValue: false.`
  }
  if (value.hasValue !== true) {
    return `Operator ${operator.id} requires a supported value with hasValue: true.`
  }
  if (value.dataShape !== valueInput.dataShape) {
    return `Unsupported value shape for ${operator.id}: ${value.dataShape}. Expected ${valueInput.dataShape}.`
  }
  if (!valueInput.dataTypes.some((dataType) => dataType === value.dataType)) {
    return `Value type ${value.dataType} is not supported by operator ${operator.id}.`
  }
  return undefined
}

// Narrow the whole operator union so category dispatch retains valid PostgreSQL AST operation types.
function serialisesAs<K extends PostgresqlOperator['serialisation']['kind']>(
  operator: PostgresqlOperator,
  kind: K,
): operator is Extract<PostgresqlOperator, { serialisation: { kind: K } }> {
  return operator.serialisation.kind === kind
}

// Build conditions around a field expression, using != for canonical <> as required by parser types.
export function createConditionAst(
  operator: PostgresqlOperator,
  field: Expr,
  literals: Expr[],
): CreateConditionAstResult {
  const operatorId = operator.id
  if (serialisesAs(operator, 'unary')) {
    return { success: true, expression: { type: 'unary', op: operator.id, operand: field } }
  }
  if (serialisesAs(operator, 'membership')) {
    if (!literals.length) return { success: false, error: 'Empty lists are not supported.' }
    return {
      success: true,
      expression: {
        type: 'binary',
        op: operator.id,
        left: field,
        right: { type: 'list', expressions: literals },
      },
    }
  }
  const [first, second] = literals
  if (!first) return { success: false, error: 'A value is required.' }
  if (serialisesAs(operator, 'between')) {
    if (!second || literals.length !== 2) {
      return { success: false, error: 'A range requires both endpoints.' }
    }
    return {
      success: true,
      expression: { type: 'ternary', op: operator.id, value: field, lo: first, hi: second },
    }
  }
  if (serialisesAs(operator, 'comparison')) {
    return {
      success: true,
      expression: {
        type: 'binary',
        op: operator.id === '<>' ? '!=' : operator.id,
        left: field,
        right: first,
      },
    }
  }
  return { success: false, error: `Unsupported condition operator: ${operatorId}.` }
}
