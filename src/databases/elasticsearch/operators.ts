import type { DatabaseOperator, ValueDataType } from '../../types/databaseOperator'

const exactTypes: ValueDataType[] = ['text', 'number', 'boolean', 'date', 'datetime']
const orderedTypes: ValueDataType[] = ['text', 'number', 'date', 'datetime']

export const elasticsearchOperators = [
  {
    id: 'term' as const,
    label: 'exact term',
    description: 'Matches an exact indexed term without analyzing the supplied value. Text matching depends on the indexed terms, including case.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: exactTypes },
  },
  {
    id: 'not_term' as const,
    label: 'not exact term',
    description: 'Excludes documents matching the exact indexed term without analyzing the supplied value. Documents with a missing field can match.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: exactTypes },
  },
  {
    id: 'terms' as const,
    label: 'any exact term in list',
    description: 'Matches any exact indexed term in the supplied list, without analyzing the values. Only one listed term needs to match.',
    valueInput: { hasValue: true, dataShape: 'list', dataTypes: exactTypes },
  },
  {
    id: 'not_terms' as const,
    label: 'no exact term in list',
    description: 'Excludes documents matching any exact indexed term in the supplied list. Documents with a missing field can match.',
    valueInput: { hasValue: true, dataShape: 'list', dataTypes: exactTypes },
  },
  {
    id: 'gt' as const,
    label: 'greater than',
    description: 'Matches indexed values greater than the supplied exclusive lower bound.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: orderedTypes },
  },
  {
    id: 'gte' as const,
    label: 'greater than/equal',
    description: 'Matches indexed values greater than or equal to the supplied inclusive lower bound.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: orderedTypes },
  },
  {
    id: 'lt' as const,
    label: 'less than',
    description: 'Matches indexed values less than the supplied exclusive upper bound.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: orderedTypes },
  },
  {
    id: 'lte' as const,
    label: 'less than/equal',
    description: 'Matches indexed values less than or equal to the supplied inclusive upper bound.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: orderedTypes },
  },
  {
    id: 'between' as const,
    label: 'between',
    description: 'Matches an indexed value within one range, including both endpoints. The first endpoint is the lower bound and the second is the upper bound.',
    valueInput: { hasValue: true, dataShape: 'range', dataTypes: orderedTypes },
  },
  {
    id: 'not_between' as const,
    label: 'not between',
    description: 'Excludes documents with an indexed value in the inclusive range, including both endpoints. Documents with a missing field can match.',
    valueInput: { hasValue: true, dataShape: 'range', dataTypes: orderedTypes },
  },
  {
    id: 'exists' as const,
    label: 'exists',
    description: 'Matches documents with an indexed value for the field. Source presence alone is insufficient; null and empty arrays normally have no indexed value, while empty strings can have one.',
    valueInput: { hasValue: false },
  },
  {
    id: 'missing' as const,
    label: 'missing',
    description: 'Matches documents without an indexed value for the field by negating exists. This can include absent fields, null, empty arrays and values excluded from indexing; mapping settings can change null handling.',
    valueInput: { hasValue: false },
  },
  {
    id: 'match' as const,
    label: 'analyzed match',
    description: 'Analyzes the supplied text using the field analyzer and matches the resulting terms with Elasticsearch defaults, rather than matching an exact term.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text'] },
  },
  {
    id: 'match_phrase' as const,
    label: 'analyzed phrase',
    description: 'Analyzes the supplied text and matches the resulting phrase in term order using Elasticsearch defaults, rather than matching an exact term.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text'] },
  },
  {
    id: 'prefix' as const,
    label: 'indexed term prefix',
    description: 'Matches indexed terms beginning with the supplied prefix without analyzing it. Matching depends on the indexed terms, including case.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text'] },
  },
  {
    id: 'wildcard' as const,
    label: 'indexed term wildcard',
    description: 'Matches indexed terms with Elasticsearch wildcard syntax: * matches zero or more characters and ? matches one character. The pattern is not analyzed; matching depends on the indexed terms, including case.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text'] },
  },
] satisfies DatabaseOperator[]

export type ElasticsearchOperator = (typeof elasticsearchOperators)[number]
