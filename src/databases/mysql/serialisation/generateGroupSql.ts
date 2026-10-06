import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryGroup } from '../../../types/query'
import { generateMysqlConditionSql } from './generateConditionSql'

// Preserve nested all/any/none semantics and empty-group policy, returning errors without partial SQL.
export function generateMysqlGroupSql(group: QueryGroup): SqlResult {
  try {
    if (group.kind !== 'group' || !Array.isArray(group.children)) {
      throw new Error('A query group with a children array is required.')
    }
    const expressions: string[] = []
    for (const child of group.children) {
      const nodeId = child?.id ?? group.id
      if (!child || (child.kind !== 'group' && child.kind !== 'condition')) {
        return { success: false, error: 'Unsupported query node.', nodeId }
      }
      const result = child.kind === 'group' ? generateMysqlGroupSql(child) : generateMysqlConditionSql(child)
      if (!result.success) return result
      if (result.sql) expressions.push(result.sql)
    }
    if (!expressions.length) return { success: true, sql: '' }
    if (!['all', 'any', 'none'].includes(group.mode)) {
      return { success: false, error: `Unsupported group mode: ${group.mode}.`, nodeId: group.id }
    }
    const sql = expressions.join(group.mode === 'all' ? ' AND ' : ' OR ')
    return { success: true, sql: `${group.mode === 'none' ? 'NOT ' : ''}(${sql})` }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid MySQL group.',
      nodeId: group.id,
    }
  }
}
