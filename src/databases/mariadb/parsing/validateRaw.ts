import type { SqlFilterExpression } from '../../shared/mysqlMariaDb/parsing/parseWhere'
import { rawModeError } from '../../shared/mysqlMariaDb/parsing/validateRawModes'
import { parseMariadbWhere } from './parseWhere'

export type MariadbRawResult =
  | { success: true; expression: SqlFilterExpression }
  | { success: false; error: string }

// Validate raw SQL against the MariaDB subset and mode-safety rules independently of visual conversion.
export function validateMariadbRaw(sql: string): MariadbRawResult {
  const parsed = parseMariadbWhere(sql)
  if (!parsed.success) return parsed
  if (!parsed.expression) return { success: false, error: 'A MariaDB condition expression is required.' }
  const error = rawModeError(parsed.expression)
  return error ?? { success: true, expression: parsed.expression }
}
