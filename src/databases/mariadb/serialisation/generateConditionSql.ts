import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryCondition } from '../../../types/query'
import { renderVisualComparison } from '../../shared/mysqlMariaDb/serialisation/renderVisualComparison'
import { mariadbOperators } from '../operators'
import { mariadbFieldModifiers } from '../modifiers'
import { quoteMariadbField } from '../identifiers'
import { mariadbLiteralSql } from './conditionLiteral'
import { validateMariadbRaw } from '../parsing/validateRaw'

// Export visual conditions or opaque SQL only after independent MariaDB raw validation succeeds.
export function generateMariadbConditionSql(condition: QueryCondition): SqlResult {
  try {
    if (!condition || condition.kind !== 'condition') throw new Error('A MariaDB condition is required.')
    if (condition.rawSql !== undefined) {
      const raw = validateMariadbRaw(condition.rawSql)
      if (!raw.success) throw new Error(raw.error)
      // A trailing line comment cannot consume the closing parenthesis or surrounding group SQL.
      return { success: true, sql: `(${raw.expression.source}\n)` }
    }
    if (!condition.field || typeof condition.field.name !== 'string' || !condition.value || typeof condition.value !== 'object') {
      throw new Error('An incomplete MariaDB condition requires a field, operator, and value selection.')
    }
    let field = quoteMariadbField(condition.field.name)
    if (condition.field.modifier !== null) {
      const modifier = condition.field.modifier
      if (!mariadbFieldModifiers.includes(modifier)) throw new Error(`Unsupported MariaDB field modifier: ${modifier}.`)
      field = `${modifier.toUpperCase()}(${field})`
    }
    const operator = mariadbOperators.find((candidate) => candidate.id === condition.operatorId)
    if (!operator) throw new Error(`Unsupported MariaDB operator: ${condition.operatorId}.`)
    return { success: true, sql: renderVisualComparison(field, operator, condition.value, mariadbLiteralSql) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Invalid MariaDB condition.', nodeId: condition?.id }
  }
}
