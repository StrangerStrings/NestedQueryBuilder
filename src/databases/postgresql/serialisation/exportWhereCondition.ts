import type { Expr, ExprRef } from 'pgsql-ast-parser'
import type { QueryCondition } from '../../../types/query'
import {
  createConditionAst,
  validateConditionValue,
} from '../conditionHandling'
import { exportConditionLiteral } from '../conditionLiteral'
import { postgresqlOperators } from '../operators'

export type ExportWhereConditionResult =
  { success: true; expression: Expr } | { success: false; error: string; nodeId: string }

// Resolve defined operators and validate their fields and values before metadata-driven construction.
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

  const operator = postgresqlOperators.find((candidate) => candidate.id === condition.operatorId)
  if (!operator) {
    return {
      success: false,
      error: `Unsupported condition operator: ${condition.operatorId}.`,
      nodeId: condition.id,
    }
  }
  const value = condition.value
  const compatibilityError = validateConditionValue(operator, value)
  if (compatibilityError) {
    return { success: false, error: compatibilityError, nodeId: condition.id }
  }
  if (!value.hasValue) {
    const result = createConditionAst(operator, reference, [])
    return result.success ? result : { ...result, nodeId: condition.id }
  }
  if (value.dataShape !== 'single' && !Array.isArray(value.value)) {
    return {
      success: false,
      error: `A ${value.dataShape} value must contain an array of homogeneous literals.`,
      nodeId: condition.id,
    }
  }
  if (value.dataShape === 'list' && value.value.length === 0) {
    return { success: false, error: 'Empty lists are not supported.', nodeId: condition.id }
  }
  if (value.dataShape === 'range' && value.value.length !== 2) {
    return { success: false, error: 'A range requires both endpoints.', nodeId: condition.id }
  }

  const values = value.dataShape === 'single' ? [value.value] : value.value
  const literals: Expr[] = []
  for (const content of values) {
    const result = exportConditionLiteral(value.dataType, content)
    if (!result.success) {
      return { success: false, error: result.error, nodeId: condition.id }
    }
    literals.push(result.expression)
  }

  const result = createConditionAst(operator, reference, literals)
  return result.success ? result : { ...result, nodeId: condition.id }
}
