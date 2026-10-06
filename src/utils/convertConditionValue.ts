import type { ConditionValue } from '../types/query'
import { isValidTemporal, temporalDefaults, type TemporalType } from './temporalValue'

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

// Preserve valid temporal values and apply only explicit calendar/time conversions.
function toTemporal(
  value: Scalar,
  source: ConditionValue,
  target: TemporalType,
  defaults: Record<TemporalType, string>,
): string {
  if (typeof value !== 'string' || !source.hasValue) return defaults[target]
  const sourceType = source.dataType
  if (sourceType === 'text' || sourceType === target) {
    return isValidTemporal(value, target) ? value : defaults[target]
  }
  if (sourceType !== 'date' && sourceType !== 'time' && sourceType !== 'datetime') {
    return defaults[target]
  }
  if (!isValidTemporal(value, sourceType)) return defaults[target]
  if (sourceType === 'datetime') {
    return target === 'date' ? value.slice(0, 10) : value.slice(11)
  }
  if (target === 'datetime') {
    return sourceType === 'date' ? `${value}T00:00:00` : `${defaults.date}T${value}`
  }
  return defaults[target]
}

// Convert literal or field items in order and fill missing values without mutating the source.
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
    source.dataType !== 'boolean' &&
    source.dataType !== 'date' &&
    source.dataType !== 'time' &&
    source.dataType !== 'datetime' &&
    source.dataType !== 'field'
  ) {
    throw new Error('Duration value conversion is not implemented.')
  }

  const items: Scalar[] = source.hasValue
    ? source.dataShape === 'single'
      ? [source.value]
      : source.value
    : []
  const converted = Array.from(items, (value) => (value == null ? defaultValue : convert(value)))
  const first = converted[0] ?? defaultValue

  if (shape === 'single') return { dataShape: 'single', value: first }

  if (shape === 'list') {
    return { dataShape: 'list', value: converted.length ? converted : [defaultValue] }
  }

  const second = converted[1] ?? defaultValue
  return { dataShape: 'range', value: [first, second] }
}

// Convert type and shape, preserving text/field names and defaulting other field transitions.
export function convertConditionValue(
  source: ConditionValue,
  target: ConditionValue,
): ConditionValue {
  if (!target.hasValue) return { hasValue: false }

  const defaults = temporalDefaults(new Date())
  const isFieldSource = source.hasValue && source.dataType === 'field'
  const isTemporalSource =
    source.hasValue &&
    (source.dataType === 'date' || source.dataType === 'time' || source.dataType === 'datetime')

  switch (target.dataType) {
    case 'field':
      return {
        hasValue: true,
        dataType: 'field',
        ...convertShape(source, target.dataShape, '', (value) =>
          source.hasValue && (source.dataType === 'text' || source.dataType === 'field')
            ? String(value)
            : '',
        ),
      }
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
        ...convertShape(source, target.dataShape, 0, isTemporalSource || isFieldSource ? () => 0 : toNumber),
      }
    case 'boolean':
      return {
        hasValue: true,
        dataType: 'boolean',
        ...convertShape(source, target.dataShape, false, isTemporalSource || isFieldSource ? () => false : toBoolean),
      }
    case 'date':
    case 'time':
    case 'datetime': {
      const dataType = target.dataType
      return {
        hasValue: true,
        dataType,
        ...convertShape(source, target.dataShape, defaults[dataType], (value) =>
          toTemporal(value, source, dataType, defaults),
        ),
      }
    }
    default:
      throw new Error('Duration value conversion is not implemented.')
  }
}
