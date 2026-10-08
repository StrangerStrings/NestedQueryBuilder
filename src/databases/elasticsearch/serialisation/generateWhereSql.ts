import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryGroup } from '../../../types/query'
import { generateElasticsearchGroupSql } from './generateGroupSql'

// Wrap a fully validated root in filter context, using match_all for an effectively empty tree.
export function generateElasticsearchWhereSql(tree: QueryGroup): SqlResult {
  try {
    const result = generateElasticsearchGroupSql(tree)
    if (!result.success) return result
    const clause = result.sql ? JSON.parse(result.sql) : { match_all: {} }
    return { success: true, sql: JSON.stringify({ query: { bool: { filter: [clause] } } }, null, 2) }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid Elasticsearch query envelope.',
      nodeId: tree && typeof tree.id === 'string' ? tree.id : undefined,
    }
  }
}
