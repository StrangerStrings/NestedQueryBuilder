import type { ValueDataType } from '../../../types/databaseOperator'
import { renderScalarLiteral } from '../../shared/mysqlMariaDb/serialisation/conditionLiteral'
import { quoteMariadbField } from '../identifiers'

// Render the MariaDB 11.4 literal subset, keeping unsupported-value errors dialect-specific.
export function mariadbLiteralSql(type: ValueDataType, value: unknown): string {
  if (type === 'field' && typeof value === 'string') return quoteMariadbField(value)
  const sql = renderScalarLiteral(type, value)
  if (sql !== undefined) return sql
  if ((type === 'date' || type === 'time' || type === 'datetime') && typeof value === 'string') {
    throw new Error(`Invalid MariaDB ${type}: use an exact local value, with date years 1000–9999.`)
  }
  throw new Error(`Invalid or unsupported MariaDB value type: ${type}.`)
}
