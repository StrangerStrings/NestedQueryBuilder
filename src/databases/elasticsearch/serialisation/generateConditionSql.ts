import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryCondition } from '../../../types/query'
import { resolveElasticsearchOperator, validateElasticsearchCondition } from '../validation'

// Validate and serialize Raw JSON or visual clauses, including analyzed prefixes and configured parameters.
export function generateElasticsearchConditionSql(condition: QueryCondition): SqlResult {
  let nodeId: string | undefined
  try {
    if (condition && typeof condition === 'object' && typeof condition.id === 'string') {
      nodeId = condition.id
    }
    if (!condition || typeof condition !== 'object' || Array.isArray(condition) || condition.kind !== 'condition') {
      throw new Error('Elasticsearch requires a structured condition.')
    }
    if ('rawSql' in condition) {
      if (typeof condition.rawSql !== 'string' || !condition.rawSql.trim()) {
        throw new Error('Enter one Elasticsearch query clause as JSON.')
      }
      let rawClause: unknown
      try {
        rawClause = JSON.parse(condition.rawSql)
      } catch {
        throw new Error('Invalid JSON; enter a valid Elasticsearch query clause.')
      }
      if (!rawClause || typeof rawClause !== 'object' || Array.isArray(rawClause) || Object.keys(rawClause).length !== 1) {
        throw new Error('Use a JSON object with exactly one top-level query clause.')
      }
      return { success: true, sql: JSON.stringify(rawClause, null, 2) }
    }
    validateElasticsearchCondition(condition)
    const operator = resolveElasticsearchOperator(condition.operatorId)
    const field = condition.field.name
    const value = condition.value.hasValue ? condition.value.value : undefined
    let fieldValue: unknown = value
    if (condition.parameters?.length) {
      const member = operator.id === 'match' || operator.id === 'match_phrase' ? 'query' : 'value'
      const options: Record<string, unknown> = { [member]: value }
      for (const parameter of condition.parameters) {
        options[parameter.name] = parameter.value
      }
      fieldValue = options
    }
    let clause: Record<string, unknown>

    switch (operator.id) {
      case 'term':
      case 'not_term':
        clause = { term: { [field]: fieldValue } }
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
      case 'match_phrase_prefix':
      case 'match_bool_prefix':
      case 'prefix':
      case 'wildcard':
        clause = { [operator.id]: { [field]: fieldValue } }
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
