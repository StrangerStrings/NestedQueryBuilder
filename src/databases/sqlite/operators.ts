import type { DatabaseOperator, ValueDataType } from '../../types/databaseOperator'

const comparisonTypes: ValueDataType[] = ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'field']
const comparisonRules = 'Comparisons follow SQLite affinity and applicable collation rules. NULL operands ordinarily produce unknown, which does not match a WHERE predicate.'
const likeRules = 'Matches the whole value: % means zero or more characters and _ means one character. Ordinary SQLite LIKE folds ASCII case, without general Unicode case folding; runtime configuration or function overrides can change this. No ESCAPE or wildcards are added; backslashes are ordinary pattern characters.'
const globRules = 'Matches the whole value using ordinarily case-sensitive glob syntax: * means zero or more characters, ? means one character, [...] contains character classes or ranges, and [^...] negates a class. Function overrides can change behavior. No SQL ESCAPE or wildcards are added.'
const isRules = 'NULL-safe comparison that never yields NULL, following SQLite affinity and applicable collation rules. Literal NULL is outside visual values; use the null-check operators. Boolean editor values emit numeric 1/0, not IS TRUE/IS FALSE truth tests.'

// SQLite capabilities use the existing scalar, list, range, and no-value controls.
export const sqliteOperators: DatabaseOperator[] = [
  {
    id: '=',
    label: 'equals',
    description: `Matches values equal to the supplied value. ${comparisonRules}`,
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: [...comparisonTypes] },
  },
  {
    id: '<>',
    label: 'not equals',
    description: `Matches values unequal to the supplied value; NULL does not automatically match. ${comparisonRules}`,
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: [...comparisonTypes] },
  },
  {
    id: '<',
    label: 'less than',
    description: `Matches values less than the supplied value. ${comparisonRules}`,
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: [...comparisonTypes] },
  },
  {
    id: '<=',
    label: 'less than/equal',
    description: `Matches values less than or equal to the supplied value. ${comparisonRules}`,
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: [...comparisonTypes] },
  },
  {
    id: '>',
    label: 'greater than',
    description: `Matches values greater than the supplied value. ${comparisonRules}`,
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: [...comparisonTypes] },
  },
  {
    id: '>=',
    label: 'greater than/equal',
    description: `Matches values greater than or equal to the supplied value. ${comparisonRules}`,
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: [...comparisonTypes] },
  },
  {
    id: 'IS',
    label: 'is (null-safe)',
    description: `Matches equal operands, including two NULL operands; exactly one NULL operand is unequal. ${isRules}`,
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: [...comparisonTypes] },
  },
  {
    id: 'IS NOT',
    label: 'is not (null-safe)',
    description: `Matches unequal operands, including exactly one NULL operand; two NULL operands are equal. ${isRules}`,
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: [...comparisonTypes] },
  },
  {
    id: 'IN',
    label: 'in list',
    description: `Matches any member of a nonempty visual list; literal NULL items are not accepted by the editor. ${comparisonRules}`,
    valueInput: { hasValue: true, dataShape: 'list', dataTypes: [...comparisonTypes] },
  },
  {
    id: 'NOT IN',
    label: 'not in list',
    description: `Matches values absent from a nonempty visual list. NULL left operands do not match. Literal NULL items are not accepted by the editor; NULL in an imported Raw list can make an otherwise unmatched result unknown. ${comparisonRules}`,
    valueInput: { hasValue: true, dataShape: 'list', dataTypes: [...comparisonTypes] },
  },
  {
    id: 'BETWEEN',
    label: 'between',
    description: `Matches an inclusive range, including both required endpoints. NULL-dependent results can be unknown. ${comparisonRules}`,
    valueInput: { hasValue: true, dataShape: 'range', dataTypes: [...comparisonTypes] },
  },
  {
    id: 'NOT BETWEEN',
    label: 'not between',
    description: `Matches values outside an inclusive range, excluding both required endpoints. NULL-dependent results can be unknown and do not automatically match. ${comparisonRules}`,
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
    description: `${likeRules} NULL operands yield unknown and do not match.`,
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text', 'field'] },
  },
  {
    id: 'NOT LIKE',
    label: 'does not match SQL pattern',
    description: `Excludes pattern matches. ${likeRules} NULL operands yield unknown and do not match this negative predicate.`,
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text', 'field'] },
  },
  {
    id: 'GLOB',
    label: 'matches glob pattern',
    description: `${globRules} NULL operands yield unknown and do not match.`,
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text', 'field'] },
  },
  {
    id: 'NOT GLOB',
    label: 'does not match glob pattern',
    description: `Excludes pattern matches. ${globRules} NULL operands yield unknown and do not match this negative predicate.`,
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text', 'field'] },
  },
]
