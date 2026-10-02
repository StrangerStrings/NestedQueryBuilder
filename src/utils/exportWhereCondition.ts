import type { Expr, ExprRef } from 'pgsql-ast-parser'
import type { QueryCondition } from '../types/query'

export type ExportWhereConditionResult =
  | { success: true; expression: Expr }
  | { success: false; error: string; nodeId: string }

// Export string contents exactly, including blanks, while validating the field and operator.
export function exportWhereCondition(condition: QueryCondition): ExportWhereConditionResult {
  const field = condition.field.trim()
  if (!field) {
    return {
      success: false,
      error: 'Incomplete condition: a field is required.',
      nodeId: condition.id,
    }
  }

  const parts = field.split('.').map((part) => part.trim())
  const [name, tableName, columnName] = parts
  if (!name || parts.some((part) => !part || part === '*') || parts.length > 3) {
    return { success: false, error: `Unsupported field reference: ${field}.`, nodeId: condition.id }
  }

  const reference: ExprRef = { type: 'ref', name }
  if (tableName) {
    reference.name = tableName
    reference.table = { name }
    if (columnName) {
      reference.name = columnName
      reference.table = { schema: name, name: tableName }
    }
  }

  if (!condition.operatorId) {
    return {
      success: false,
      error: `Incomplete condition for ${field}: an operator is required.`,
      nodeId: condition.id,
    }
  }

  if (condition.operatorId === 'postgresql.isNull') {
    return {
      success: true,
      expression: { type: 'unary', op: 'IS NULL', operand: reference },
    }
  }

  if (condition.operatorId !== 'postgresql.eq' && condition.operatorId !== 'postgresql.gt') {
    return {
      success: false,
      error: `Unsupported condition operator: ${condition.operatorId}.`,
      nodeId: condition.id,
    }
  }

  return {
    success: true,
    expression: {
      type: 'binary',
      op: condition.operatorId === 'postgresql.eq' ? '=' : '>',
      left: reference,
      right: { type: 'string', value: condition.value },
    },
  }
}
