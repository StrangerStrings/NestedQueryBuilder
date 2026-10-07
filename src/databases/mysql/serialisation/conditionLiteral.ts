import type { ValueDataType } from '../../../types/databaseOperator'
import { renderScalarLiteral } from '../../shared/mysqlMariaDb/serialisation/conditionLiteral'
import { quoteMysqlField } from '../identifiers'

// Validate the common literal subset while retaining MySQL's field handling and diagnostics.
export function literalSql(type: ValueDataType, value: unknown): string {
  if (type === 'field' && typeof value === 'string') return quoteMysqlField(value)
  const sql = renderScalarLiteral(type, value)
  if (sql !== undefined) return sql
  if ((type === 'date' || type === 'time' || type === 'datetime') && typeof value === 'string') {
    throw new Error(`Invalid MySQL ${type}: use an exact local value, with date years 1000–9999.`)
  }
  throw new Error(`Invalid or unsupported MySQL value type: ${type}.`)
}
