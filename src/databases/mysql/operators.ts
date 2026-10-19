import type { DatabaseOperator } from '../../types/databaseOperator'

// Explicit MySQL 8.4 capabilities, independent of PostgreSQL operators and AST metadata.
export const mysqlOperators: DatabaseOperator[] = [
  {
    id: '=',
    label: 'equals',
    description: 'Matches values equal to the supplied value. Text comparisons follow the applicable collation.',
    valueInput: {
      hasValue: true,
      dataShape: 'single',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'field'],
    },
  },
  {
    id: '<>',
    label: 'not equals',
    description: 'Matches values unequal to the supplied value. NULL fields do not match. Include NULL explicitly with IS NULL in an any group. Text comparisons follow the applicable collation.',
    valueInput: {
      hasValue: true,
      dataShape: 'single',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'field'],
    },
  },
  {
    id: '>',
    label: 'greater than',
    description: 'Matches values greater than the supplied value. Text comparisons follow the applicable collation.',
    valueInput: {
      hasValue: true,
      dataShape: 'single',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'field'],
    },
  },
  {
    id: '>=',
    label: 'greater than/equal',
    description: 'Matches values greater than or equal to the supplied value. Text comparisons follow the applicable collation.',
    valueInput: {
      hasValue: true,
      dataShape: 'single',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'field'],
    },
  },
  {
    id: '<',
    label: 'less than',
    description: 'Matches values less than the supplied value. Text comparisons follow the applicable collation.',
    valueInput: {
      hasValue: true,
      dataShape: 'single',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'field'],
    },
  },
  {
    id: '<=',
    label: 'less than/equal',
    description: 'Matches values less than or equal to the supplied value. Text comparisons follow the applicable collation.',
    valueInput: {
      hasValue: true,
      dataShape: 'single',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'field'],
    },
  },
  {
    id: 'IN',
    label: 'in list',
    description: 'Matches any value in a non-empty list. Text comparisons follow the applicable collation.',
    valueInput: {
      hasValue: true,
      dataShape: 'list',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'field'],
    },
  },
  {
    id: 'NOT IN',
    label: 'not in list',
    description: 'Matches values absent from a non-empty list. NULL fields do not match. Include NULL explicitly with IS NULL in an any group. A NULL list item prevents unmatched values from matching. Text comparisons follow the applicable collation.',
    valueInput: {
      hasValue: true,
      dataShape: 'list',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'field'],
    },
  },
  {
    id: 'BETWEEN',
    label: 'between',
    description: 'Matches an inclusive range; both endpoints are required. Text comparisons follow the applicable collation.',
    valueInput: {
      hasValue: true,
      dataShape: 'range',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'field'],
    },
  },
  {
    id: 'NOT BETWEEN',
    label: 'not between',
    description: 'Matches values outside an inclusive range; both endpoints are required. NULL fields do not match. Include NULL explicitly with IS NULL in an any group. Text comparisons follow the applicable collation.',
    valueInput: {
      hasValue: true,
      dataShape: 'range',
      dataTypes: ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'field'],
    },
  },
  {
    id: 'IS NULL',
    label: 'is null',
    description: 'Matches SQL NULL; no value is required.',
    valueInput: { hasValue: false },
  },
  {
    id: 'IS NOT NULL',
    label: 'is not null',
    description: 'Matches values that are not SQL NULL; no value is required.',
    valueInput: { hasValue: false },
  },
  {
    id: 'LIKE',
    label: 'matches SQL pattern',
    description: 'Matches the whole text using an SQL pattern: % matches zero or more characters and _ matches one character. Case sensitivity follows the applicable collation.',
    valueInput: {
      hasValue: true,
      dataShape: 'single',
      dataTypes: ['text', 'field'],
    },
  },
  {
    id: 'NOT LIKE',
    label: 'does not match SQL pattern',
    description: 'Excludes whole-text matches of an SQL pattern: % matches zero or more characters and _ matches one character. NULL fields do not match. Include NULL explicitly with IS NULL in an any group. Case sensitivity follows the applicable collation.',
    valueInput: {
      hasValue: true,
      dataShape: 'single',
      dataTypes: ['text', 'field'],
    },
  },
]
