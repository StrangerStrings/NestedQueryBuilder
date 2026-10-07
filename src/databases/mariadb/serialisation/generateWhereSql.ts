import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryGroup } from '../../../types/query'
import { generateMariadbGroupSql } from './generateGroupSql'

// Add WHERE only after the complete MariaDB tree succeeds and contains a nonempty filter.
export function generateMariadbWhereSql(tree: QueryGroup): SqlResult {
  const result = generateMariadbGroupSql(tree)
  return result.success && result.sql ? { success: true, sql: `WHERE ${result.sql}` } : result
}
