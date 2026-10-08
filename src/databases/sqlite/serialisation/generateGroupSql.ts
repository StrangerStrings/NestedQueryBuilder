import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryGroup } from '../../../types/query'
import { generateSqliteConditionSql } from './generateConditionSql'

// Validate every node and preserve group semantics without returning partial descendant SQL.
export function generateSqliteGroupSql(group: QueryGroup): SqlResult {
  let nodeId: string | undefined
  try {
    if (!group || typeof group !== 'object') {
      throw new Error('A SQLite query group object is required.')
    }
    if (typeof group.id === 'string') nodeId = group.id
    if (Array.isArray(group) || group.kind !== 'group' || !Array.isArray(group.children)) {
      throw new Error('A SQLite query group with a children array is required.')
    }
    if (group.mode !== 'all' && group.mode !== 'any' && group.mode !== 'none') {
      throw new Error('Unsupported SQLite group mode; use all, any, or none.')
    }
    const groupId = nodeId
    const expressions: string[] = []
    for (let index = 0; index < group.children.length; index += 1) {
      nodeId = groupId
      if (!Object.prototype.hasOwnProperty.call(group.children, index)) {
        throw new Error('SQLite query groups cannot contain missing children.')
      }
      const child = group.children[index]
      if (!child || typeof child !== 'object') {
        throw new Error('A SQLite query child must be a condition or group object.')
      }
      if (typeof child.id === 'string') nodeId = child.id
      if (Array.isArray(child) || (child.kind !== 'condition' && child.kind !== 'group')) {
        throw new Error('Unsupported SQLite query node kind.')
      }
      const result = child.kind === 'group'
        ? generateSqliteGroupSql(child)
        : generateSqliteConditionSql(child)
      if (!result.success) return { ...result, nodeId: result.nodeId ?? nodeId }
      if (result.sql) expressions.push(result.sql)
    }
    if (!expressions.length) return { success: true, sql: '' }
    const sql = expressions.join(group.mode === 'all' ? ' AND ' : ' OR ')
    return { success: true, sql: `${group.mode === 'none' ? 'NOT ' : ''}(${sql})` }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Invalid SQLite query group.', nodeId }
  }
}
