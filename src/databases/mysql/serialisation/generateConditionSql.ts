import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryCondition } from '../../../types/query'
import { mysqlOperators } from '../operators'
import { mysqlFieldModifiers } from '../modifiers'
import { validateMysqlRaw } from '../parsing/validateRaw'
import { quoteMysqlField } from '../identifiers'
import { literalSql } from './conditionLiteral'

// Export validated visual conditions using only explicitly allowlisted MySQL functions.
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
    const input = operator.valueInput
    const value = condition.value
    if (!input.hasValue) {
      if (value.hasValue !== false) throw new Error(`${operator.id} does not accept a value.`)
      return { success: true, sql: `${field} ${operator.id}` }
    }
    if (value.hasValue !== true || value.dataShape !== input.dataShape || !input.dataTypes.includes(value.dataType)) {
      throw new Error(`Unsupported value shape or type for ${operator.id}.`)
    }
    const values = value.dataShape === 'single' ? [value.value] : value.value
    if (!Array.isArray(values) || !values.length || (value.dataShape === 'range' && values.length !== 2)) {
      throw new Error('Lists must be nonempty and ranges require both endpoints.')
    }
    const literals = Array.from(values, (content) => literalSql(value.dataType, content))
    const operand = value.dataShape === 'list'
      ? `(${literals.join(', ')})`
      : value.dataShape === 'range' ? literals.join(' AND ') : literals[0]
    // Fix pattern escaping explicitly because NO_BACKSLASH_ESCAPES also changes LIKE's default.
    const escape = operator.id === 'LIKE' || operator.id === 'NOT LIKE'
      ? " ESCAPE _utf8mb4 X'5c'"
      : ''
    return { success: true, sql: `${field} ${operator.id} ${operand}${escape}` }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Invalid MySQL condition.', nodeId: condition.id }
  }
}
