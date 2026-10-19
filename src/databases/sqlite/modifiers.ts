import type { FieldModifier } from '../../types/query'

export const sqliteFieldModifiers: readonly FieldModifier[] = [
  'lower',
  'upper',
  'trim',
  'ltrim',
  'rtrim',
  'length',
  'typeof',
  'abs',
  'round',
]

const modifierRules = 'Except for typeof, these ordinary built-ins propagate NULL; results depend on input storage types and runtime overrides.'

// Keep single-argument behavior descriptions available for later SQLite help.
export const sqliteModifierDescriptions = {
  lower: `One field argument: converts ASCII letters to lowercase, without general Unicode case folding. ${modifierRules}`,
  upper: `One field argument: converts ASCII letters to uppercase, without general Unicode case folding. ${modifierRules}`,
  trim: `One field argument: removes U+0020 spaces from both ends of text, rather than all whitespace. ${modifierRules}`,
  ltrim: `One field argument: removes U+0020 spaces from the left end of text, rather than all whitespace. ${modifierRules}`,
  rtrim: `One field argument: removes U+0020 spaces from the right end of text, rather than all whitespace. ${modifierRules}`,
  length: `One field argument: counts Unicode characters in text up to the first NUL, rather than encoded bytes; BLOB values count bytes, and numeric values use their text representation. ${modifierRules}`,
  typeof: "One field argument: returns the storage-type string null, integer, real, text, or blob. typeof(NULL) returns the text 'null', not SQL NULL. Runtime overrides can affect results.",
  abs: `One field argument: returns the absolute value with SQLite numeric coercion; nonnumeric text or BLOB values return 0.0. The minimum signed 64-bit integer causes integer overflow. ${modifierRules}`,
  round: `One field argument: rounds using SQLite numeric coercion to zero decimal places, returning a floating-point value. ${modifierRules}`,
} satisfies Partial<Record<FieldModifier, string>>
