import type { ValueDataType } from '../../../types/databaseOperator'
import { isValidTemporal } from '../../../utils/temporalValue'
import { quoteSqliteField } from '../identifiers'
import { assertSqliteUnicode } from '../unicode'

// Escape only apostrophes, preserving backslashes and valid Unicode as SQLite text.
function textSql(value: string): string {
  assertSqliteUnicode(value, 'SQLite text values')
  return `'${value.replaceAll("'", "''")}'`
}

// Validate primitive editor values without coercion, casts, or temporal transformations.
export function literalSql(type: ValueDataType, value: unknown): string {
  switch (type) {
    case 'text':
      if (typeof value !== 'string') throw new Error('SQLite text values must be primitive strings.')
      return textSql(value)
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error('SQLite number values must be primitive finite numbers.')
      }
      return String(value)
    case 'boolean':
      if (typeof value !== 'boolean') throw new Error('SQLite boolean values must be primitive booleans.')
      return value ? '1' : '0'
    case 'field':
      if (typeof value !== 'string') throw new Error('SQLite field values must be primitive strings.')
      return quoteSqliteField(value)
    case 'date':
    case 'time':
    case 'datetime':
      if (typeof value !== 'string' || !isValidTemporal(value, type)) {
        const format = type === 'date' ? 'YYYY-MM-DD' : type === 'time' ? 'HH:mm:ss' : 'YYYY-MM-DDTHH:mm:ss'
        throw new Error(`Invalid SQLite ${type}: use exact ${format} text without a timezone.`)
      }
      return textSql(value)
    case 'duration':
      throw new Error('SQLite duration values are unsupported.')
    default:
      throw new Error('Unsupported SQLite value type.')
  }
}
