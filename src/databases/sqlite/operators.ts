import type { DatabaseOperator, ValueDataType } from '../../types/databaseOperator'

const comparisonTypes: ValueDataType[] = ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'field']

// SQLite capabilities use the existing scalar, list, range, and no-value controls.
export const sqliteOperators: DatabaseOperator[] = [
  {
    id: '=',
    label: 'equals',
    description: 'Matches values equal to the supplied value.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: [...comparisonTypes] },
  },
  {
    id: '<>',
    label: 'not equals',
    description: 'Matches values unequal to the supplied value. NULL fields do not match. Include NULL with IS NULL in an any group.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: [...comparisonTypes] },
  },
  {
    id: '<',
    label: 'less than',
    description: 'Matches values less than the supplied value.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: [...comparisonTypes] },
  },
  {
    id: '<=',
    label: 'less than/equal',
    description: 'Matches values less than or equal to the supplied value.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: [...comparisonTypes] },
  },
  {
    id: '>',
    label: 'greater than',
    description: 'Matches values greater than the supplied value.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: [...comparisonTypes] },
  },
  {
    id: '>=',
    label: 'greater than/equal',
    description: 'Matches values greater than or equal to the supplied value.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: [...comparisonTypes] },
  },
  {
    id: 'IS',
    label: 'is (null-safe)',
    description: 'Matches equal values, including two NULL values. Boolean editor values compare as 1 or 0.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: [...comparisonTypes] },
  },
  {
    id: 'IS NOT',
    label: 'is not (null-safe)',
    description: 'Matches unequal values, including when only one value is NULL. Boolean editor values compare as 1 or 0.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: [...comparisonTypes] },
  },
  {
    id: 'IN',
    label: 'in list',
    description: 'Matches values equal to any value in the supplied list.',
    valueInput: { hasValue: true, dataShape: 'list', dataTypes: [...comparisonTypes] },
  },
  {
    id: 'NOT IN',
    label: 'not in list',
    description: 'Matches values absent from the supplied list. NULL fields do not match. A NULL in an imported Raw list prevents unmatched values from matching.',
    valueInput: { hasValue: true, dataShape: 'list', dataTypes: [...comparisonTypes] },
  },
  {
    id: 'BETWEEN',
    label: 'between',
    description: 'Matches values within a range, including both endpoints.',
    valueInput: { hasValue: true, dataShape: 'range', dataTypes: [...comparisonTypes] },
  },
  {
    id: 'NOT BETWEEN',
    label: 'not between',
    description: 'Matches values below the lower bound or above the upper bound. NULL fields do not match. Include NULL with IS NULL in an any group.',
    valueInput: { hasValue: true, dataShape: 'range', dataTypes: [...comparisonTypes] },
  },
  {
    id: 'IS NULL',
    label: 'is null',
    description: 'Matches SQL NULL; no operand is required.',
    valueInput: { hasValue: false },
  },
  {
    id: 'IS NOT NULL',
    label: 'is not null',
    description: 'Matches values other than SQL NULL; no operand is required.',
    valueInput: { hasValue: false },
  },
  {
    id: 'LIKE',
    label: 'matches SQL pattern',
    description: 'Matches the whole text using a SQL pattern: % matches zero or more characters and _ matches one. Normally ignores ASCII case. Backslashes are ordinary characters.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text', 'field'] },
  },
  {
    id: 'NOT LIKE',
    label: 'does not match SQL pattern',
    description: 'Excludes whole-text SQL pattern matches: % matches zero or more characters and _ matches one. Normally ignores ASCII case. Backslashes are ordinary characters. NULL fields do not match.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text', 'field'] },
  },
  {
    id: 'GLOB',
    label: 'matches glob pattern',
    description: 'Matches the whole text using a glob pattern: * matches zero or more characters, ? matches one, [...] matches a character class and [^...] excludes one. Normally case-sensitive.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text', 'field'] },
  },
  {
    id: 'NOT GLOB',
    label: 'does not match glob pattern',
    description: 'Excludes whole-text glob matches: * matches zero or more characters, ? matches one, [...] matches a character class and [^...] excludes one. Normally case-sensitive. NULL fields do not match.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text', 'field'] },
  },
]
