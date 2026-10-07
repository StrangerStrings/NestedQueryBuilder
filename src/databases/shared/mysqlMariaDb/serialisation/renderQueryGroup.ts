import type { QueryCondition, QueryGroup } from '../../../../types/query'
import type { SqlResult } from '../../../../types/databaseAdapter'

// Preserve the common nested-group and empty-group policy using the caller's condition exporter.
export function renderQueryGroup(
  group: QueryGroup,
  generateCondition: (condition: QueryCondition) => SqlResult,
  invalidGroupError: string,
): SqlResult {
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
      const result = child.kind === 'group'
        ? renderQueryGroup(child, generateCondition, invalidGroupError)
        : generateCondition(child)
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
      error: error instanceof Error ? error.message : invalidGroupError,
      nodeId: group.id,
    }
  }
}
