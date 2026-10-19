import type { FieldModifier } from '../../types/query'

export const mariadbFieldModifiers: readonly FieldModifier[] = [
  'lower',
  'upper',
  'trim',
  'ltrim',
  'rtrim',
  'reverse',
  'length',
  'char_length',
  'abs',
  'round',
  'floor',
  'ceil',
  'sqrt',
]
