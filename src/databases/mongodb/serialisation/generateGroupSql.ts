import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryGroup } from '../../../types/query'
import { generateMongoDBConditionSql } from './generateConditionSql'

// Read structural members without accepting inherited properties.
function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

// Validate every child and preserve separate filter documents in recursive logical arrays.
export function generateMongoDBGroupSql(group: QueryGroup): SqlResult {
  let nodeId: string | undefined
  try {
    if (!group || typeof group !== 'object') {
      throw new Error('A MongoDB query group object is required.')
    }
    if (typeof group.id === 'string') nodeId = group.id
    if (Array.isArray(group) || !hasOwn(group, 'id') || !hasOwn(group, 'kind')
      || !hasOwn(group, 'children') || !hasOwn(group, 'mode')
      || typeof group.id !== 'string' || group.kind !== 'group' || !Array.isArray(group.children)) {
      throw new Error('A MongoDB query group requires its own string ID, kind, mode and children array.')
    }
    if (group.mode !== 'all' && group.mode !== 'any' && group.mode !== 'none') {
      throw new Error('Unsupported MongoDB group mode; use all, any, or none.')
    }
    const groupId = nodeId
    const clauses: Record<string, unknown>[] = []
    for (let index = 0; index < group.children.length; index += 1) {
      nodeId = groupId
      if (!hasOwn(group.children, index)) {
        throw new Error('MongoDB query groups cannot contain missing children.')
      }
      const child = group.children[index]
      if (!child || typeof child !== 'object') {
        throw new Error('A MongoDB query child must be a condition or group object.')
      }
      if (typeof child.id === 'string') nodeId = child.id
      if (Array.isArray(child) || !hasOwn(child, 'id') || typeof child.id !== 'string'
        || !hasOwn(child, 'kind') || (child.kind !== 'condition' && child.kind !== 'group')) {
        throw new Error('A MongoDB query child requires its own string ID and a supported node kind.')
      }
      const result = child.kind === 'group'
        ? generateMongoDBGroupSql(child)
        : generateMongoDBConditionSql(child)
      if (!result.success) return { ...result, nodeId: result.nodeId ?? nodeId }
      if (result.sql) clauses.push(JSON.parse(result.sql))
    }
    if (!clauses.length) return { success: true, sql: '' }
    const operator = group.mode === 'all' ? '$and' : group.mode === 'any' ? '$or' : '$nor'
    return { success: true, sql: JSON.stringify({ [operator]: clauses }, null, 2) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Invalid MongoDB query group.', nodeId }
  }
}
