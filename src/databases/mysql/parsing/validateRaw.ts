import { rawModeError } from '../../shared/mysqlMariaDb/parsing/validateRawModes'
import { parseMysqlWhere, type MysqlExpression } from './parseWhere'

export type MysqlRawResult =
  | { success: true; expression: MysqlExpression }
  | { success: false; error: string }

// Validate opaque SQL independently of visual conversion, rejecting mode-sensitive raw expressions.
export function validateMysqlRaw(sql: string): MysqlRawResult {
  const parsed = parseMysqlWhere(sql)
  if (!parsed.success) return parsed
  const expression = parsed.expression
  if (!expression) return { success: false, error: 'A condition expression is required.' }
  const error = rawModeError(expression)
  return error ?? { success: true, expression }
}
