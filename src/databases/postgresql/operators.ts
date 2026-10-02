import type { DatabaseOperator } from '@/types/databaseOperator'

export const postgresqlOperators: DatabaseOperator[] = [
  {
    id: '=',
    label: 'equals',
    description: 'Matches values that are equal to the supplied value.',
    valueInput: {
      hasValue: true,
      dataShapes: ['single'],
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
    },
  },
  {
    id: '<>',
    label: 'not equals',
    description: 'Matches values that are not equal to the supplied value.',
    valueInput: {
      hasValue: true,
      dataShapes: ['single'],
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
    },
  },
  {
    id: '>',
    label: 'greater than',
    description: 'Matches values that are greater than the supplied value.',
    valueInput: {
      hasValue: true,
      dataShapes: ['single'],
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
    },
  },
  {
    id: '>=',
    label: 'greater than/equal',
    description: 'Matches values that are greater than or equal to the supplied value.',
    valueInput: {
      hasValue: true,
      dataShapes: ['single'],
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
    },
  },
  {
    id: '<',
    label: 'less than',
    description: 'Matches values that are less than the supplied value.',
    valueInput: {
      hasValue: true,
      dataShapes: ['single'],
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
    },
  },
  {
    id: '<=',
    label: 'less than/equal',
    description: 'Matches values that are less than or equal to the supplied value.',
    valueInput: {
      hasValue: true,
      dataShapes: ['single'],
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
    },
  },
  {
    id: 'BETWEEN',
    label: 'between',
    description: 'Matches values within a range, including both endpoints.',
    valueInput: {
      hasValue: true,
      dataShapes: ['range'],
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
    },
  },
  {
    id: 'NOT BETWEEN',
    label: 'not between',
    description: 'Matches values below the lower bound or above the upper bound of a range.',
    valueInput: {
      hasValue: true,
      dataShapes: ['range'],
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
    },
  },
  {
    id: 'IN',
    label: 'in list',
    description: 'Matches values that are equal to any value in the supplied list.',
    valueInput: {
      hasValue: true,
      dataShapes: ['list'],
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
    },
  },
  {
    id: 'NOT IN',
    label: 'not in list',
    description:
      'Matches values that are not equal to any value in the supplied list. A NULL in the list prevents unmatched values from matching.',
    valueInput: {
      hasValue: true,
      dataShapes: ['list'],
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'duration'],
    },
  },
  {
    id: 'IS NULL',
    label: 'is null',
    description: 'Matches values that are SQL NULL.',
    valueInput: { hasValue: false },
  },
  {
    id: 'IS NOT NULL',
    label: 'is not null',
    description: 'Matches values that are not SQL NULL.',
    valueInput: { hasValue: false },
  },
  {
    id: 'LIKE',
    label: 'matches pattern',
    description:
      'Matches a text pattern, where % represents any number of characters and _ represents one character.',
    valueInput: { hasValue: true, dataShapes: ['single'], dataTypes: ['text'] },
  },
  {
    id: 'NOT LIKE',
    label: 'not match pattern',
    description:
      'Matches text that does not match the supplied pattern. Use % for any number of characters and _ for one character.',
    valueInput: { hasValue: true, dataShapes: ['single'], dataTypes: ['text'] },
  },
  {
    id: 'ILIKE',
    label: 'matches pattern, ignore case',
    description:
      'Matches a text pattern, ignoring case. Use % for any number of characters and _ for one character.',
    valueInput: { hasValue: true, dataShapes: ['single'], dataTypes: ['text'] },
  },
  {
    id: 'NOT ILIKE',
    label: 'not match pattern, ignore case',
    description:
      'Matches text that does not match the supplied pattern, ignoring case. Use % for any number of characters and _ for one character.',
    valueInput: { hasValue: true, dataShapes: ['single'], dataTypes: ['text'] },
  },
  {
    id: 'IS TRUE',
    label: 'is true',
    description: 'Matches Boolean values that are true. False and NULL values do not match.',
    valueInput: { hasValue: false },
  },
  {
    id: 'IS FALSE',
    label: 'is false',
    description: 'Matches Boolean values that are false. True and NULL values do not match.',
    valueInput: { hasValue: false },
  },
]
