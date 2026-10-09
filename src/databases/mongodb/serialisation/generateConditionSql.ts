import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryCondition } from '../../../types/query'
import { resolveMongoDBOperator, validateMongoDBCondition } from '../validation'

// Validate a complete condition and serialize its standalone native MongoDB filter.
export function generateMongoDBConditionSql(condition: QueryCondition): SqlResult {
  let nodeId: string | undefined
  try {
    if (condition && typeof condition === 'object' && typeof condition.id === 'string') {
      nodeId = condition.id
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

    const document = { [condition.field.name]: { [nativeOperator]: operand } }
    return { success: true, sql: JSON.stringify(document, null, 2) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Invalid MongoDB condition.', nodeId }
  }
}
