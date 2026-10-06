import type { DatabaseOperator } from '../../types/databaseOperator'

type PostgresqlOperatorKind = 'comparison' | 'membership' | 'between' | 'unary'

type PostgresqlOperatorDefinition = DatabaseOperator & {
  parsing: { kind: PostgresqlOperatorKind }
  serialisation: { kind: PostgresqlOperatorKind }
}

const postgresqlPatternHelp =
  'Patterns are used as entered; no wildcards are added or escaped. PostgreSQL defaults to backslash pattern escaping: use \\% or \\_ for literal wildcards and two backslashes for one. SQL literal quoting is separate; the exporter uses escape-string literals for backslashes.'

export const postgresqlOperators = [
  {
    id: '=' as const,
    parsing: { kind: 'comparison' },
    serialisation: { kind: 'comparison' },
    label: 'equals',
    description: 'Matches values that are equal to the supplied value.',
    valueInput: {
      hasValue: true,
      dataShape: 'single',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration', 'field'],
    },
  },
  {
    id: '<>' as const,
    parsing: { kind: 'comparison' },
    serialisation: { kind: 'comparison' },
    label: 'not equals',
    description: 'Matches values that are not equal to the supplied value. NULL fields do not match. Include NULL explicitly with IS NULL in an any group.',
    valueInput: {
      hasValue: true,
      dataShape: 'single',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration', 'field'],
    },
  },
  {
    id: '>' as const,
    parsing: { kind: 'comparison' },
    serialisation: { kind: 'comparison' },
    label: 'greater than',
    description: 'Matches values that are greater than the supplied value.',
    valueInput: {
      hasValue: true,
      dataShape: 'single',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration', 'field'],
    },
  },
  {
    id: '>=' as const,
    parsing: { kind: 'comparison' },
    serialisation: { kind: 'comparison' },
    label: 'greater than/equal',
    description: 'Matches values that are greater than or equal to the supplied value.',
    valueInput: {
      hasValue: true,
      dataShape: 'single',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration', 'field'],
    },
  },
  {
    id: '<' as const,
    parsing: { kind: 'comparison' },
    serialisation: { kind: 'comparison' },
    label: 'less than',
    description: 'Matches values that are less than the supplied value.',
    valueInput: {
      hasValue: true,
      dataShape: 'single',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration', 'field'],
    },
  },
  {
    id: '<=' as const,
    parsing: { kind: 'comparison' },
    serialisation: { kind: 'comparison' },
    label: 'less than/equal',
    description: 'Matches values that are less than or equal to the supplied value.',
    valueInput: {
      hasValue: true,
      dataShape: 'single',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration', 'field'],
    },
  },
  {
    id: 'BETWEEN' as const,
    parsing: { kind: 'between' },
    serialisation: { kind: 'between' },
    label: 'between',
    description: 'Matches values within a range, including both endpoints.',
    valueInput: {
      hasValue: true,
      dataShape: 'range',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
    },
  },
  {
    id: 'NOT BETWEEN' as const,
    parsing: { kind: 'between' },
    serialisation: { kind: 'between' },
    label: 'not between',
    description: 'Matches values below the lower bound or above the upper bound of a range. NULL fields do not match. Include NULL explicitly with IS NULL in an any group.',
    valueInput: {
      hasValue: true,
      dataShape: 'range',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
    },
  },
  {
    id: 'IN' as const,
    parsing: { kind: 'membership' },
    serialisation: { kind: 'membership' },
    label: 'in list',
    description: 'Matches values that are equal to any value in the supplied list.',
    valueInput: {
      hasValue: true,
      dataShape: 'list',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
    },
  },
  {
    id: 'NOT IN' as const,
    parsing: { kind: 'membership' },
    serialisation: { kind: 'membership' },
    label: 'not in list',
    description:
      'Matches values that are not equal to any value in the supplied list. NULL fields do not match. Include NULL explicitly with IS NULL in an any group. A NULL in the list prevents unmatched values from matching.',
    valueInput: {
      hasValue: true,
      dataShape: 'list',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
    },
  },
  {
    id: 'IS NULL' as const,
    parsing: { kind: 'unary' },
    serialisation: { kind: 'unary' },
    label: 'is null',
    description: 'Matches values that are SQL NULL.',
    valueInput: { hasValue: false },
  },
  {
    id: 'IS NOT NULL' as const,
    parsing: { kind: 'unary' },
    serialisation: { kind: 'unary' },
    label: 'is not null',
    description: 'Matches values that are not SQL NULL.',
    valueInput: { hasValue: false },
  },
  {
    id: 'LIKE' as const,
    parsing: { kind: 'comparison' },
    serialisation: { kind: 'comparison' },
    label: 'matches pattern',
    description:
      'Matches the whole text using a SQL pattern: % matches zero or more characters and _ matches one character. Unlike ILIKE, LIKE does not request locale-based case folding.',
    helpText: postgresqlPatternHelp,
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text', 'field'] },
  },
  {
    id: 'NOT LIKE' as const,
    parsing: { kind: 'comparison' },
    serialisation: { kind: 'comparison' },
    label: 'not match pattern',
    description:
      'Excludes whole-text matches of a SQL pattern: % matches zero or more characters and _ matches one character. Unlike NOT ILIKE, NOT LIKE does not request locale-based case folding. NULL fields do not match. Include NULL explicitly with IS NULL in an any group.',
    helpText: postgresqlPatternHelp,
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text', 'field'] },
  },
  {
    id: 'ILIKE' as const,
    parsing: { kind: 'comparison' },
    serialisation: { kind: 'comparison' },
    label: 'matches pattern, ignore case',
    description:
      'Matches the whole text using a SQL pattern, ignoring case according to the active PostgreSQL locale. % matches zero or more characters and _ matches one character.',
    helpText: postgresqlPatternHelp,
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text', 'field'] },
  },
  {
    id: 'NOT ILIKE' as const,
    parsing: { kind: 'comparison' },
    serialisation: { kind: 'comparison' },
    label: 'not match pattern, ignore case',
    description:
      'Excludes whole-text matches of a SQL pattern, ignoring case according to the active PostgreSQL locale. % matches zero or more characters and _ matches one character. NULL fields do not match. Include NULL explicitly with IS NULL in an any group.',
    helpText: postgresqlPatternHelp,
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text', 'field'] },
  },
  {
    id: 'IS TRUE' as const,
    parsing: { kind: 'unary' },
    serialisation: { kind: 'unary' },
    label: 'is true',
    description: 'Matches Boolean values that are true. False and NULL values do not match.',
    valueInput: { hasValue: false },
  },
  {
    id: 'IS FALSE' as const,
    parsing: { kind: 'unary' },
    serialisation: { kind: 'unary' },
    label: 'is false',
    description: 'Matches Boolean values that are false. True and NULL values do not match.',
    valueInput: { hasValue: false },
  },
] satisfies PostgresqlOperatorDefinition[]

export type PostgresqlOperator = (typeof postgresqlOperators)[number]
