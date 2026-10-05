import type { DatabaseOperator } from '../../types/databaseOperator'

type PostgresqlOperatorKind = 'comparison' | 'membership' | 'between' | 'unary'

type PostgresqlOperatorDefinition = DatabaseOperator & {
  parsing: { kind: PostgresqlOperatorKind }
  serialisation: { kind: PostgresqlOperatorKind }
}

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
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
    },
  },
  {
    id: '<>' as const,
    parsing: { kind: 'comparison' },
    serialisation: { kind: 'comparison' },
    label: 'not equals',
    description: 'Matches values that are not equal to the supplied value.',
    valueInput: {
      hasValue: true,
      dataShape: 'single',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
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
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
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
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
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
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
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
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
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
    description: 'Matches values below the lower bound or above the upper bound of a range.',
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
      'Matches values that are not equal to any value in the supplied list. A NULL in the list prevents unmatched values from matching.',
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
      'Matches a text pattern, where % represents any number of characters and _ represents one character.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text'] },
  },
  {
    id: 'NOT LIKE' as const,
    parsing: { kind: 'comparison' },
    serialisation: { kind: 'comparison' },
    label: 'not match pattern',
    description:
      'Matches text that does not match the supplied pattern. Use % for any number of characters and _ for one character.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text'] },
  },
  {
    id: 'ILIKE' as const,
    parsing: { kind: 'comparison' },
    serialisation: { kind: 'comparison' },
    label: 'matches pattern, ignore case',
    description:
      'Matches a text pattern, ignoring case. Use % for any number of characters and _ for one character.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text'] },
  },
  {
    id: 'NOT ILIKE' as const,
    parsing: { kind: 'comparison' },
    serialisation: { kind: 'comparison' },
    label: 'not match pattern, ignore case',
    description:
      'Matches text that does not match the supplied pattern, ignoring case. Use % for any number of characters and _ for one character.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text'] },
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
