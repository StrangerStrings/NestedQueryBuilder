import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryCondition } from '../../../types/query'
import { resolveMongoDBOperator, validateMongoDBCondition } from '../validation'

// Serialize Raw JSON or validated native predicates, including paired regex options.
export function generateMongoDBConditionSql(condition: QueryCondition): SqlResult {
  let nodeId: string | undefined
  try {
    if (condition && typeof condition === 'object' && typeof condition.id === 'string') {
      nodeId = condition.id
    }
    if (!condition || typeof condition !== 'object' || Array.isArray(condition) || condition.kind !== 'condition') {
      throw new Error('MongoDB requires a structured condition.')
    }
    if ('rawSql' in condition) {
      if (typeof condition.rawSql !== 'string' || !condition.rawSql.trim()) {
        throw new Error('Enter a MongoDB filter object as JSON.')
      }
      let rawFilter: unknown
      try {
        rawFilter = JSON.parse(condition.rawSql)
      } catch {
        throw new Error('Invalid JSON; enter a valid MongoDB filter object.')
      }
      if (!rawFilter || typeof rawFilter !== 'object' || Array.isArray(rawFilter)) {
        throw new Error('Use a JSON object for the MongoDB filter.')
      }
      return { success: true, sql: JSON.stringify(rawFilter, null, 2) }
    }
    validateMongoDBCondition(condition)
    const operator = resolveMongoDBOperator(condition.operatorId)
    let nativeOperator: string
    let operand: unknown = condition.value.hasValue ? condition.value.value : undefined

    switch (operator.id) {
      case 'eq':
      case 'ne':
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
      case 'in':
      case 'nin':
      case 'all':
      case 'regex':
      case 'size':
        nativeOperator = `$${operator.id}`
        break
      case 'type':
      case 'type_list':
        nativeOperator = '$type'
        break
      case 'exists':
      case 'missing':
        nativeOperator = '$exists'
        operand = operator.id === 'exists'
        break
      case 'equals_null':
      case 'not_equals_null':
        nativeOperator = operator.id === 'equals_null' ? '$eq' : '$ne'
        operand = null
        break
      default:
        throw new Error('Unsupported MongoDB condition operator.')
    }

    const predicate: Record<string, unknown> = { [nativeOperator]: operand }
    const options = condition.parameters?.find(
      // Regex flags form one native parameter alongside the unchanged pattern string.
      (parameter) => parameter.name === '$options',
    )
    if (options?.name === '$options' && options.value) predicate.$options = options.value
    const document = { [condition.field.name]: predicate }
    return { success: true, sql: JSON.stringify(document, null, 2) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Invalid MongoDB condition.', nodeId }
  }
}
