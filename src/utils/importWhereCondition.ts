import type { Expr } from 'pgsql-ast-parser'
import type { QueryCondition } from '../types/query'
import { createId } from './createId'
import { createImportWhereError, type ImportWhereError } from './importWhereError'

export type ImportWhereConditionResult =
  | { success: true; condition: QueryCondition }
  | { success: false; error: ImportWhereError }

// Convert a supported leaf or report its unsupported operator, expression, or value.
export function importWhereCondition(expression: Expr): ImportWhereConditionResult {
  let field: Expr
  let operatorId: string
  let value: string

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

  if (expression.type === 'binary') {
    if (expression.op === '=') {
      operatorId = 'postgresql.eq'
    } else if (expression.op === '>') {
      operatorId = 'postgresql.gt'
    } else {
      return {
        success: false,
        error: createImportWhereError(
          'unsupported-operator',
          `Unsupported SQL operator: ${expression.op}.`,
          expression,
        ),
      }
    }

    field = expression.left
    if (expression.right.type !== 'string') {
      return {
        success: false,
        error: createImportWhereError(
          'unsupported-value',
          `Unsupported value expression: ${expression.right.type}. Only string literals are supported.`,
          expression.right,
        ),
      }
    }
    value = expression.right.value
  } else if (expression.type === 'unary') {
    if (expression.op !== 'IS NULL') {
      return {
        success: false,
        error: createImportWhereError(
          'unsupported-operator',
          `Unsupported SQL operator: ${expression.op}.`,
          expression,
        ),
      }
    }

    field = expression.operand
    operatorId = 'postgresql.isNull'
    value = ''
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
