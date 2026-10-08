import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryGroup } from '../../../types/query'
import { generateElasticsearchConditionSql } from './generateConditionSql'

// Validate every child and preserve recursive Boolean clauses without returning partial output.
export function generateElasticsearchGroupSql(group: QueryGroup): SqlResult {
  let nodeId: string | undefined
  try {
    if (!group || typeof group !== 'object') {
      throw new Error('An Elasticsearch query group object is required.')
    }
    if (typeof group.id === 'string') nodeId = group.id
    if (Array.isArray(group) || group.kind !== 'group' || !Array.isArray(group.children)) {
      throw new Error('An Elasticsearch query group with a children array is required.')
    }
    if (group.mode !== 'all' && group.mode !== 'any' && group.mode !== 'none') {
      throw new Error('Unsupported Elasticsearch group mode; use all, any, or none.')
    }
    const groupId = nodeId
    const clauses: Record<string, unknown>[] = []
    for (let index = 0; index < group.children.length; index += 1) {
      nodeId = groupId
      if (!Object.prototype.hasOwnProperty.call(group.children, index)) {
        throw new Error('Elasticsearch query groups cannot contain missing children.')
      }
      const child = group.children[index]
      if (!child || typeof child !== 'object') {
        throw new Error('An Elasticsearch query child must be a condition or group object.')
      }
      if (typeof child.id === 'string') nodeId = child.id
      if (Array.isArray(child) || (child.kind !== 'condition' && child.kind !== 'group')) {
        throw new Error('Unsupported Elasticsearch query node kind.')
      }
      const result = child.kind === 'group'
        ? generateElasticsearchGroupSql(child)
        : generateElasticsearchConditionSql(child)
      if (!result.success) return { ...result, nodeId: result.nodeId ?? nodeId }
      if (result.sql) clauses.push(JSON.parse(result.sql))
    }
    if (!clauses.length) return { success: true, sql: '' }
    const bool = group.mode === 'all'
      ? { filter: clauses }
      : group.mode === 'any'
        ? { should: clauses, minimum_should_match: 1 }
        : { must_not: clauses }
    return { success: true, sql: JSON.stringify({ bool }, null, 2) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Invalid Elasticsearch query group.', nodeId }
  }
}
