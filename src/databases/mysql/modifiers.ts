import type { FieldModifier } from '../../types/query'

export const mysqlFieldModifiers: readonly FieldModifier[] = [
  'lower',
  'upper',
  'trim',
  'ltrim',
  'rtrim',
  'reverse',
  'length',
  'char_length',
  'year',
  'month',
  'dayofmonth',
  'date',
  'abs',
  'round',
  'floor',
  'ceil',
  'sqrt',
]
