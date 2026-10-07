import { parseMysqlMariaDbWhere, type SqlFilterParseResult } from '../../shared/mysqlMariaDb/parsing/parseWhere'
import { mariadbSubsetError } from './validateSubset'

// Require both common grammar validity and the independently established MariaDB 11.4 subset.
export function parseMariadbWhere(sql: string): SqlFilterParseResult {
  const parsed = parseMysqlMariaDbWhere(sql, 'MariaDB')
  if (!parsed.success || !parsed.expression) return parsed
  const error = mariadbSubsetError(parsed.expression)
  return error ? { success: false, error, kind: 'unsupported-expression' } : parsed
}
