import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryGroup } from '../../../types/query'
import { generateMysqlGroupSql } from './generateGroupSql'

// Add WHERE only when the shared tree contains a nonempty filter.
export function generateMysqlWhereSql(tree: QueryGroup): SqlResult {
  const result = generateMysqlGroupSql(tree)
  return result.success && result.sql ? { success: true, sql: `WHERE ${result.sql}` } : result
}
