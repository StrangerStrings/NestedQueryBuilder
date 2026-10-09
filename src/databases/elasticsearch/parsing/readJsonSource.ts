import { JsonSourceError, type JsonSourceNumber, type JsonSourceResult } from '../../shared/parsing/readJsonSource'

export { JsonSourceError, readJsonSource } from '../../shared/parsing/readJsonSource'
export type { JsonSourceLocation, JsonSourceNumber, JsonSourceDocument, JsonSourceResult } from '../../shared/parsing/readJsonSource'

// Opt in only for consumed query literals; ignored mapping metadata needs grammar checks alone.
// Ordinary floating-point rounding remains a limitation; this does not promise decimal fidelity.
export function validateQueryNumber(token: JsonSourceNumber): JsonSourceResult<number> {
  const value = token.value
  const significand = token.fragment.split(/[eE]/)[0] ?? ''
  let message: string | undefined
  if (!Number.isFinite(value)) message = 'Elasticsearch query numbers must be finite; this token overflows.'
  else if (value === 0 && /[1-9]/.test(significand)) message = 'A nonzero Elasticsearch query number must not underflow to zero.'
  else if (Number.isInteger(value) && !Number.isSafeInteger(value)) message = 'Elasticsearch query integer values must be safe integers.'
  if (message) return { success: false, error: new JsonSourceError('unsupported-value', message, token) }
  return { success: true, value }
}
