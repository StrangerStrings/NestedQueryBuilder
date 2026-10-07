import type { DatabaseOperator, ValueDataType } from '../../../../types/databaseOperator'
import type { ConditionValue } from '../../../../types/query'

// Render a catalogue-approved comparison without handling raw SQL or choosing supported features.
export function renderVisualComparison(
  field: string,
  operator: DatabaseOperator,
  value: ConditionValue,
  renderLiteral: (type: ValueDataType, value: unknown) => string,
): string {
  const input = operator.valueInput
  if (!input.hasValue) {
    if (value.hasValue !== false) throw new Error(`${operator.id} does not accept a value.`)
    return `${field} ${operator.id}`
  }
  if (value.hasValue !== true || value.dataShape !== input.dataShape || !input.dataTypes.includes(value.dataType)) {
    throw new Error(`Unsupported value shape or type for ${operator.id}.`)
  }
  const values = value.dataShape === 'single' ? [value.value] : value.value
  if (!Array.isArray(values) || !values.length || (value.dataShape === 'range' && values.length !== 2)) {
    throw new Error('Lists must be nonempty and ranges require both endpoints.')
  }
  const literals = Array.from(values, (content) => renderLiteral(value.dataType, content))
  const operand = value.dataShape === 'list'
    ? `(${literals.join(', ')})`
    : value.dataShape === 'range' ? literals.join(' AND ') : literals[0]
  // Select backslash explicitly instead of relying on the session's LIKE escape default.
  const escape = operator.id === 'LIKE' || operator.id === 'NOT LIKE'
    ? " ESCAPE _utf8mb4 X'5c'"
    : ''
  return `${field} ${operator.id} ${operand}${escape}`
}
