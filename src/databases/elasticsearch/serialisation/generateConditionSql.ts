import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryCondition } from '../../../types/query'
import { resolveElasticsearchOperator, validateElasticsearchCondition } from '../validation'

// Validate a complete condition and serialize its standalone Query DSL clause without coercion.
export function generateElasticsearchConditionSql(condition: QueryCondition): SqlResult {
  let nodeId: string | undefined
  try {
    if (condition && typeof condition === 'object' && typeof condition.id === 'string') {
      nodeId = condition.id
    }
    validateElasticsearchCondition(condition)
    const operator = resolveElasticsearchOperator(condition.operatorId)
    const field = condition.field.name
    const value = condition.value.hasValue ? condition.value.value : undefined
    let clause: Record<string, unknown>

    switch (operator.id) {
      case 'term':
      case 'not_term':
        clause = { term: { [field]: value } }
        break
      case 'terms':
      case 'not_terms':
        clause = { terms: { [field]: value } }
        break
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        clause = { range: { [field]: { [operator.id]: value } } }
        break
      case 'between':
      case 'not_between': {
        const endpoints = value as [unknown, unknown]
        clause = { range: { [field]: { gte: endpoints[0], lte: endpoints[1] } } }
        break
      }
      case 'exists':
      case 'missing':
        clause = { exists: { field } }
        break
      case 'match':
      case 'match_phrase':
      case 'prefix':
      case 'wildcard':
        clause = { [operator.id]: { [field]: value } }
        break
    }

    if (operator.id === 'not_term' || operator.id === 'not_terms' || operator.id === 'not_between' || operator.id === 'missing') {
      clause = { bool: { must_not: [clause] } }
    }
    return { success: true, sql: JSON.stringify(clause, null, 2) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Invalid Elasticsearch condition.', nodeId }
  }
}
