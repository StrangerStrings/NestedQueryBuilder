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
    id: '<=>',
    label: 'equals (NULL-safe)',
    description: 'Native NULL-safe equality: two NULLs are equal, and one NULL is unequal to a non-NULL value. Compare with a value or field reference; literal NULL requires Raw mode. Text comparisons follow the applicable collation.',
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
    id: 'IS TRUE',
    label: 'is true',
    description: 'Native MySQL truth test: matches nonzero values, not just 1. NULL does not match; no value is required.',
    valueInput: { hasValue: false },
  },
  {
    id: 'IS FALSE',
    label: 'is false',
    description: 'Native MySQL truth test: matches zero values. NULL does not match; no value is required.',
    valueInput: { hasValue: false },
  },
  {
    id: 'IS NOT TRUE',
    label: 'is not true',
    description: 'Native MySQL truth test: matches zero values and NULL. No value is required.',
    valueInput: { hasValue: false },
  },
  {
    id: 'IS NOT FALSE',
    label: 'is not false',
    description: 'Native MySQL truth test: matches nonzero values and NULL, not just 1. No value is required.',
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
  {
    id: 'REGEXP',
    label: 'matches regular expression',
    description: 'Matches a native MySQL regular expression supplied as text or a field reference. Use anchors for a whole-text match. Case sensitivity follows the applicable collation. Patterns are used as entered, without added wildcards or LIKE escapes.',
    valueInput: {
      hasValue: true,
      dataShape: 'single',
      dataTypes: ['text', 'field'],
    },
  },
  {
    id: 'NOT REGEXP',
    label: 'does not match regular expression',
    description: 'Excludes native MySQL regular-expression matches supplied as text or a field reference. NULL fields do not match; include NULL explicitly with IS NULL in an any group. Case sensitivity follows the applicable collation. Patterns are used as entered, without added wildcards or LIKE escapes.',
    valueInput: {
      hasValue: true,
      dataShape: 'single',
      dataTypes: ['text', 'field'],
    },
  },
]
