import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryCondition } from '../../../types/query'
import { mysqlOperators } from '../operators'
import { mysqlFieldModifiers } from '../modifiers'
import { validateMysqlRaw } from '../parsing/validateRaw'
import { quoteMysqlField } from '../identifiers'
import { literalSql } from './conditionLiteral'
import { renderVisualComparison } from '../../shared/mysqlMariaDb/serialisation/renderVisualComparison'

// Keep MySQL raw validation local and render visual conditions using the compatible shared syntax.
export function generateMysqlConditionSql(condition: QueryCondition): SqlResult {
  try {
    if (condition.rawSql !== undefined) {
      const raw = validateMysqlRaw(condition.rawSql)
      if (!raw.success) throw new Error(raw.error)
      // A newline keeps a trailing line comment from swallowing the closing parenthesis.
      return { success: true, sql: `(${raw.expression.source}\n)` }
    }
    let field = quoteMysqlField(condition.field.name)
    if (condition.field.modifier !== null) {
      const modifier = condition.field.modifier
      if (!mysqlFieldModifiers.includes(modifier)) throw new Error(`Unsupported MySQL field modifier: ${modifier}.`)
      field = `${modifier.toUpperCase()}(${field})`
    }
    const operator = mysqlOperators.find((candidate) => candidate.id === condition.operatorId)
    if (!operator) throw new Error(`Unsupported MySQL operator: ${condition.operatorId}.`)
    return { success: true, sql: renderVisualComparison(field, operator, condition.value, literalSql) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Invalid MySQL condition.', nodeId: condition.id }
  }
}
