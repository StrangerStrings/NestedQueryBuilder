import type { ElasticsearchConditionParameter } from '../../types/query'

export type ElasticsearchParameterName = ElasticsearchConditionParameter['name']

// Initialise each selected parameter with a fresh object and its approved starting value.
export function initialParameter(name: ElasticsearchParameterName): ElasticsearchConditionParameter {
  switch (name) {
    case 'operator': return { name, value: 'or' }
    case 'fuzziness': return { name, value: 'AUTO' }
    case 'slop': return { name, value: 0 }
    case 'minimum_should_match': return { name, value: 0 }
    case 'case_insensitive': return { name, value: false }
  }
}

const supportedParameters: Record<string, readonly ElasticsearchParameterName[]> = {
  match: ['operator', 'fuzziness', 'minimum_should_match'],
  match_phrase: ['slop'],
  term: ['case_insensitive'],
  not_term: ['case_insensitive'],
  prefix: ['case_insensitive'],
  wildcard: ['case_insensitive'],
}

// Return supported parameter names in their editor order, without introducing defaults.
export function getElasticsearchParameterNames(operatorId: string): readonly ElasticsearchParameterName[] {
  return Object.prototype.hasOwnProperty.call(supportedParameters, operatorId)
    ? supportedParameters[operatorId]!
    : []
}
