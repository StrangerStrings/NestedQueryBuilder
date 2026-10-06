import type { Expr } from 'pgsql-ast-parser'
import type { ConditionValue, FieldModifier, QueryCondition } from '../../../types/query'
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

const supportedFieldModifiers: readonly FieldModifier[] = [
  'lower',
  'upper',
  'trim',
  'ltrim',
  'rtrim',
  'initcap',
  'reverse',
  'length',
  'abs',
  'round',
  'floor',
  'ceil',
  'trunc',
  'sqrt',
]

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

// Resolve operators and values, then import a plain field or one supported modifier call.
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

  let reference = field
  let modifier: FieldModifier | null = null
  if (field.type === 'call') {
    if (field.function.schema !== undefined) {
      return {
        success: false,
        error: createImportWhereError(
          'unsupported-expression',
          `Unsupported schema-qualified field function: ${field.function.schema}.${field.function.name}.`,
          field,
        ),
      }
    }

    const functionName = field.function.name.toLowerCase()
    const supportedModifier = supportedFieldModifiers.find((candidate) => candidate === functionName)
    if (!supportedModifier) {
      return {
        success: false,
        error: createImportWhereError(
          'unsupported-expression',
          `Unsupported field modifier: ${field.function.name}.`,
          field,
        ),
      }
    }

    const argument = field.args[0]
    if (field.args.length !== 1 || !argument) {
      return {
        success: false,
        error: createImportWhereError(
          'unsupported-expression',
          `Field modifier ${supportedModifier} requires exactly one column-reference argument.`,
          field,
        ),
      }
    }
    if (field.distinct || field.orderBy || field.filter || field.withinGroup || field.over) {
      return {
        success: false,
        error: createImportWhereError(
          'unsupported-expression',
          `Aggregate and window clauses are not supported for field modifier ${supportedModifier}.`,
          field,
        ),
      }
    }
    if (argument.type !== 'ref') {
      return {
        success: false,
        error: createImportWhereError(
          'unsupported-expression',
          argument.type === 'call'
            ? `Nested field modifiers are not supported: ${supportedModifier}.`
            : `Field modifier ${supportedModifier} requires a column reference; received ${argument.type}.`,
          field,
        ),
      }
    }
    reference = argument
    modifier = supportedModifier
  }

  if (reference.type !== 'ref') {
    return {
      success: false,
      error: createImportWhereError(
        'unsupported-expression',
        `Unsupported field expression: ${reference.type}.`,
        field,
      ),
    }
  }

  if (reference.name === '*') {
    return {
      success: false,
      error: createImportWhereError(
        'unsupported-expression',
        'Unsupported field expression: wildcard (*).',
        field,
      ),
    }
  }

  const fieldName = [reference.table?.schema, reference.table?.name, reference.name]
    .filter((part) => part !== undefined)
    .join('.')

  return {
    success: true,
    condition: {
      kind: 'condition',
      id: createId(),
      field: { name: fieldName, modifier },
      operatorId,
      value,
    },
  }
}
