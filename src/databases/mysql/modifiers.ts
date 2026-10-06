import type { FieldModifier } from '../../types/query'

export const mysqlFieldModifiers: readonly FieldModifier[] = [
  'lower',
  'upper',
  'trim',
  'ltrim',
  'rtrim',
  'reverse',
  'length',
  'abs',
  'round',
  'floor',
  'ceil',
  'sqrt',
]
