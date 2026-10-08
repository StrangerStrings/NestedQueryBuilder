import type { ConditionField, ConditionValue } from '../../../types/query'
import { quoteSqliteField } from '../identifiers'
import { sqliteFieldModifiers } from '../modifiers'
import { sqliteOperators } from '../operators'
import { literalSql } from './conditionLiteral'

// Validate and render one visual comparison, leaving Raw SQL and groups to later hooks.
export function renderSqliteVisualComparison(
  field: ConditionField,
  operatorId: string,
  value: ConditionValue,
): string {
  if (!field || typeof field !== 'object' || Array.isArray(field)) {
    throw new Error('A SQLite condition requires a field object.')
  }
  let fieldSql = quoteSqliteField(field.name)
  if (field.modifier !== null) {
    if (typeof field.modifier !== 'string' || !sqliteFieldModifiers.includes(field.modifier)) {
      throw new Error('Unsupported SQLite field modifier; use one allowlisted modifier or null.')
    }
    fieldSql = `${field.modifier.toUpperCase()}(${fieldSql})`
  }

  // Resolve only canonical catalogue IDs before interpolating an operator.
  const operator = sqliteOperators.find((candidate) => candidate.id === operatorId)
  if (!operator) throw new Error('Unsupported SQLite operator; use a canonical catalogue ID.')
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('A SQLite condition requires a value object.')
  }
  const input = operator.valueInput
  if (!input.hasValue) {
    if (value.hasValue !== false) throw new Error(`${operator.id} does not accept a value.`)
    return `${fieldSql} ${operator.id}`
  }
  if (value.hasValue !== true || value.dataShape !== input.dataShape || !input.dataTypes.includes(value.dataType)) {
    throw new Error(`Unsupported SQLite value shape or type for ${operator.id}.`)
  }
  if (value.dataShape === 'single') {
    return `${fieldSql} ${operator.id} ${literalSql(value.dataType, value.value)}`
  }

  const values = value.value
  if (!Array.isArray(values) || values.length === 0 || (value.dataShape === 'range' && values.length !== 2)) {
    throw new Error('SQLite lists must be nonempty and ranges require exactly two endpoints.')
  }
  const literals: string[] = []
  for (let index = 0; index < values.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(values, index)) {
      throw new Error('SQLite lists and ranges cannot contain missing elements.')
    }
    literals.push(literalSql(value.dataType, values[index]))
  }
  const operand = value.dataShape === 'list' ? `(${literals.join(', ')})` : literals.join(' AND ')
  return `${fieldSql} ${operator.id} ${operand}`
}
