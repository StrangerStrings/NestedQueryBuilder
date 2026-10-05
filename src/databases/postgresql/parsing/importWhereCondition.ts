import type { Expr } from 'pgsql-ast-parser'
import type { ConditionValue, QueryCondition } from '../../../types/query'
import { createId } from '../../../utils/createId'
import {
  normaliseConditionOperatorId,
  readConditionAst,
  validateConditionValue,
} from '../conditionHandling'
import { importConditionLiteral } from '../conditionLiteral'
import { postgresqlOperators } from '../operators'
import { createImportWhereError, type ImportWhereError } from './importWhereError'

export type ImportWhereConditionResult =
  { success: true; condition: QueryCondition } | { success: false; error: ImportWhereError }

type ImportConditionValueResult =
  { success: true; value: ConditionValue } | { success: false; error: ImportWhereError }

// Convert homogeneous literals in order, retaining the offending SQL fragment on failure.
function importConditionValue(
  expressions: Expr[],
  dataShape: 'single' | 'list' | 'range',
  expression: Expr,
): ImportConditionValueResult {
  const first = expressions[0]
  if (
    !first ||
    (dataShape === 'range' &&
      (expressions.length !== 2 || expressions.some((literal) => !literal)))
  ) {
    return {
      success: false,
      error: createImportWhereError(
        'unsupported-value',
        dataShape === 'range' ? 'A range requires both endpoints.' : 'Empty lists are not supported.',
        expression,
      ),
    }
  }
  const firstResult = importConditionLiteral(first)
  if (!firstResult.success) {
    return {
      success: false,
      error: createImportWhereError('unsupported-value', firstResult.error, first),
    }
  }
  if (dataShape === 'single') return firstResult

  const values = [firstResult.value.value]
  for (const literal of expressions.slice(1)) {
    const result = importConditionLiteral(literal)
    if (!result.success) {
      return {
        success: false,
        error: createImportWhereError('unsupported-value', result.error, literal),
      }
    }
    if (result.value.dataType !== firstResult.value.dataType) {
      return {
        success: false,
        error: createImportWhereError(
          'unsupported-value',
          `Mixed value types are not supported in a ${dataShape}: expected ${firstResult.value.dataType}, received ${result.value.dataType}.`,
          literal,
        ),
      }
    }
    values.push(result.value.value)
  }

  // Type equality and the endpoint count above guarantee the model's homogeneous array/tuple.
  const value = {
    hasValue: true,
    dataType: firstResult.value.dataType,
    dataShape,
    value: values,
  } as ConditionValue
  return { success: true, value }
}

// Resolve canonical operators before metadata-driven extraction, value conversion, and validation.
export function importWhereCondition(expression: Expr): ImportWhereConditionResult {
  let operatorId: string

  if ((expression.type === 'binary' || expression.type === 'unary') && expression.opSchema) {
    return {
      success: false,
      error: createImportWhereError(
        'unsupported-operator',
        `Unsupported schema-qualified SQL operator: ${expression.opSchema}.${expression.op}.`,
        expression,
      ),
    }
  }

  if (
    expression.type === 'binary' ||
    expression.type === 'ternary' ||
    expression.type === 'unary'
  ) {
    operatorId = normaliseConditionOperatorId(expression.op)
  } else {
    return {
      success: false,
      error: createImportWhereError(
        'unsupported-expression',
        `Unsupported condition expression: ${expression.type}.`,
        expression,
      ),
    }
  }

  const operator = postgresqlOperators.find((candidate) => candidate.id === operatorId)
  if (!operator) {
    return {
      success: false,
      error: createImportWhereError(
        'unsupported-operator',
        `Unsupported SQL operator: ${operatorId}.`,
        expression,
      ),
    }
  }
  const structure = readConditionAst(operator, expression)
  if (!structure.success) {
    return {
      success: false,
      error: createImportWhereError('unsupported-expression', structure.error, expression),
    }
  }
  const { field, literals, dataShape, valueExpression } = structure.parts
  let value: ConditionValue
  if (dataShape === null) {
    value = { hasValue: false }
  } else {
    const result = importConditionValue(literals, dataShape, valueExpression)
    if (!result.success) return result
    value = result.value
  }
  if (validateConditionValue(operator, value)) {
    return {
      success: false,
      error: createImportWhereError(
        'unsupported-value',
        `Unsupported value type or shape for SQL operator: ${operatorId}.`,
        valueExpression,
      ),
    }
  }

  if (field.type !== 'ref') {
    return {
      success: false,
      error: createImportWhereError(
        'unsupported-expression',
        `Unsupported field expression: ${field.type}.`,
        field,
      ),
    }
  }

  if (field.name === '*') {
    return {
      success: false,
      error: createImportWhereError(
        'unsupported-expression',
        'Unsupported field expression: wildcard (*).',
        field,
      ),
    }
  }

  const fieldName = [field.table?.schema, field.table?.name, field.name]
    .filter((part) => part !== undefined)
    .join('.')

  return {
    success: true,
    condition: { kind: 'condition', id: createId(), field: fieldName, operatorId, value },
  }
}
