import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryCondition } from '../../../types/query'
import { validateSqliteRaw } from '../parsing/validateRaw'
import { renderSqliteVisualComparison } from './renderVisualComparison'

// Validate each condition and revalidate complete Raw source before embedding it safely.
export function generateSqliteConditionSql(condition: QueryCondition): SqlResult {
  let nodeId: string | undefined
  try {
    if (!condition || typeof condition !== 'object') {
      throw new Error('A SQLite condition object is required.')
    }
    if (typeof condition.id === 'string') nodeId = condition.id
    if (Array.isArray(condition) || condition.kind !== 'condition') {
      throw new Error('A SQLite condition must have kind condition.')
    }
    const rawSql = condition.rawSql
    if (rawSql !== undefined) {
      if (typeof rawSql !== 'string') {
        throw new Error('SQLite Raw SQL must be a primitive string.')
      }
      const raw = validateSqliteRaw(rawSql)
      if (!raw.success) return { success: false, error: raw.error.message, nodeId }
      // The newline prevents trailing line comments from swallowing generated closing syntax.
      return { success: true, sql: `(${raw.value.source}\n)` }
    }
    return {
      success: true,
      sql: renderSqliteVisualComparison(condition.field, condition.operatorId, condition.value),
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Invalid SQLite condition.', nodeId }
  }
}
