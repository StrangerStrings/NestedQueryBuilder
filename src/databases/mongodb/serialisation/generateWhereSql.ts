import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryGroup } from '../../../types/query'
import { generateMongoDBGroupSql } from './generateGroupSql'

// Return the validated bare root filter, using an empty document for an effectively empty tree.
export function generateMongoDBWhereSql(tree: QueryGroup): SqlResult {
  const result = generateMongoDBGroupSql(tree)
  if (!result.success) return result
  return { success: true, sql: result.sql || '{}' }
}
