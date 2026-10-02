import type { ConditionValue } from '../types/query'

type Scalar = string | number | boolean

// Represent scalars as readable text, using blank text for zero and invalid numbers.
function toText(value: Scalar): string {
  if (typeof value === 'number' && (value === 0 || !Number.isFinite(value))) return ''
  return String(value)
}

// Convert complete decimal strings and booleans to finite numbers, defaulting failures to zero.
function toNumber(value: Scalar): number {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  const trimmed = value.trim()
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) return 0

  const number = Number(trimmed)
  return Number.isFinite(number) ? number : 0
}

// Recognise only booleans and true/false or 1/0 representations, defaulting failures to false.
function toBoolean(value: Scalar): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  const trimmed = value.trim().toLowerCase()
  return trimmed === 'true' || trimmed === '1'
}

// Convert items in order and fill missing values with defaults without mutating the source.
function convertShape<T extends Scalar>(
  source: ConditionValue,
  shape: 'single' | 'range' | 'list',
  defaultValue: T,
  convert: (value: Scalar) => T,
):
  | { dataShape: 'single'; value: T }
  | { dataShape: 'range'; value: [T, T] }
  | { dataShape: 'list'; value: T[] } {
  if (
    source.hasValue &&
    source.dataType !== 'text' &&
    source.dataType !== 'number' &&
    source.dataType !== 'boolean'
  ) {
    throw new Error('Only text, number, and boolean values can be converted.')
  }

  const items: Scalar[] = source.hasValue
    ? source.dataShape === 'single'
      ? [source.value]
      : source.value
    : []
  const converted = Array.from(items, (value) =>
    value == null ? defaultValue : convert(value),
  )
  const first = converted[0] ?? defaultValue

  if (shape === 'single') return { dataShape: 'single', value: first }

  if (shape === 'list') {
    return { dataShape: 'list', value: converted.length ? converted : [defaultValue] }
  }

  const second = converted[1] ?? defaultValue
  return { dataShape: 'range', value: [first, second] }
}

// Convert single, range, or list values using the target's type and shape, ignoring its payload.
export function convertConditionValue(
  source: ConditionValue,
  target: ConditionValue,
): ConditionValue {
  if (!target.hasValue) return { hasValue: false }

  switch (target.dataType) {
    case 'text':
      return {
        hasValue: true,
        dataType: 'text',
        ...convertShape(source, target.dataShape, '', toText),
      }
    case 'number':
      return {
        hasValue: true,
        dataType: 'number',
        ...convertShape(source, target.dataShape, 0, toNumber),
      }
    case 'boolean':
      return {
        hasValue: true,
        dataType: 'boolean',
        ...convertShape(source, target.dataShape, false, toBoolean),
      }
    default:
      throw new Error('Date and time value conversion is not implemented.')
  }
}
