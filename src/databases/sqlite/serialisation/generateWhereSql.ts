import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryGroup } from '../../../types/query'
import { generateSqliteGroupSql } from './generateGroupSql'

// Prefix only a complete nonempty SQLite root group, forwarding validation failures unchanged.
export function generateSqliteWhereSql(tree: QueryGroup): SqlResult {
  try {
    const result = generateSqliteGroupSql(tree)
    return result.success && result.sql ? { success: true, sql: `WHERE ${result.sql}` } : result
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Invalid SQLite WHERE fragment.' }
  }
}
