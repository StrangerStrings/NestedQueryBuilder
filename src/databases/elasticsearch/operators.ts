import type { DatabaseOperator, ValueDataType } from '../../types/databaseOperator'

const exactTypes: ValueDataType[] = ['text', 'number', 'boolean', 'date', 'datetime']
const orderedTypes: ValueDataType[] = ['text', 'number', 'date', 'datetime']

export const elasticsearchOperators = [
  {
    id: 'term' as const,
    label: 'exact term',
    description: 'Matches an exact indexed term without analyzing the value. Optional case_insensitive ignores case.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: exactTypes },
  },
  {
    id: 'not_term' as const,
    label: 'not exact term',
    description: 'Excludes an exact indexed term without analyzing the value. Optional case_insensitive ignores case. Missing fields can match.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: exactTypes },
  },
  {
    id: 'terms' as const,
    label: 'any exact term in list',
    description: 'Matches any exact indexed term in the supplied list, without analyzing the values.',
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
    description: 'Matches an indexed value within a range, including both endpoints.',
    valueInput: { hasValue: true, dataShape: 'range', dataTypes: orderedTypes },
  },
  {
    id: 'not_between' as const,
    label: 'not between',
    description: 'Excludes documents with an indexed value within the range, including both endpoints. Missing fields can match.',
    valueInput: { hasValue: true, dataShape: 'range', dataTypes: orderedTypes },
  },
  {
    id: 'exists' as const,
    label: 'exists',
    description: 'Matches fields with an indexed value. Null and empty arrays normally do not match; empty strings can match.',
    valueInput: { hasValue: false },
  },
  {
    id: 'missing' as const,
    label: 'missing',
    description: 'Matches fields without an indexed value, including absent fields and values excluded from indexing.',
    valueInput: { hasValue: false },
  },
  {
    id: 'match' as const,
    label: 'analyzed match',
    description: 'Analyzes the text and matches the resulting terms. Optional parameters select OR or AND, allow fuzzy matching, and set Minimum words matched for analyzed terms with OR. AND still requires every term.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text'] },
  },
  {
    id: 'match_phrase' as const,
    label: 'analyzed phrase',
    description: 'Analyzes the text and matches the resulting phrase. Optional slop allows gaps or changes in word position.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text'] },
  },
  {
    id: 'match_phrase_prefix' as const,
    label: 'analyzed phrase prefix',
    description: 'Analyzes the text and treats the final term as a prefix, preserving phrase order by default.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text'] },
  },
  {
    id: 'match_bool_prefix' as const,
    label: 'analyzed boolean prefix',
    description: 'Analyzes the text and treats the final term as a prefix. Default Boolean behavior requires neither phrase order nor every preceding term.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text'] },
  },
  {
    id: 'prefix' as const,
    label: 'indexed term prefix',
    description: 'Matches indexed terms beginning with the supplied prefix, without analyzing it. Optional case_insensitive ignores case.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text'] },
  },
  {
    id: 'wildcard' as const,
    label: 'indexed term wildcard',
    description: 'Matches indexed terms using a pattern: * matches zero or more characters and ? matches one. The pattern is not analyzed. Optional case_insensitive ignores case.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text'] },
  },
] satisfies DatabaseOperator[]

export type ElasticsearchOperator = (typeof elasticsearchOperators)[number]
