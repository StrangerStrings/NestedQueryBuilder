import type { DataTypeDef, Expr } from 'pgsql-ast-parser'
import type { ValueDataType } from '../../types/databaseOperator'
import type { ConditionValue } from '../../types/query'
import { isValidTemporal, type TemporalType } from '../../utils/temporalValue'

type SingleValue = Extract<ConditionValue, { hasValue: true; dataShape: 'single' }>
type ImportLiteralResult =
  { success: true; value: SingleValue } | { success: false; error: string }
type ExportLiteralResult =
  { success: true; expression: Expr } | { success: false; error: string }

// Accept only unqualified local temporal types without precision modifiers or array casts.
function temporalType(dataType: DataTypeDef): TemporalType | undefined {
  if (dataType.kind === 'array' || dataType.schema || dataType.doubleQuoted || dataType.config) {
    return undefined
  }
  switch (dataType.name.toLowerCase()) {
    case 'date':
      return 'date'
    case 'time':
    case 'time without time zone':
      return 'time'
    case 'timestamp':
    case 'timestamp without time zone':
      return 'datetime'
    default:
      return undefined
  }
}

// Reuse exact local validation, excluding year zero because PostgreSQL cannot represent it.
function isValidPostgresqlTemporal(value: string, type: TemporalType): boolean {
  return isValidTemporal(value, type) && (type === 'time' || !value.startsWith('0000-'))
}

// Import scalar literals and explicit local temporal casts without inference or coercion.
export function importConditionLiteral(expression: Expr): ImportLiteralResult {
  switch (expression.type) {
    case 'string':
      return {
        success: true,
        value: { hasValue: true, dataType: 'text', dataShape: 'single', value: expression.value },
      }
    case 'integer':
    case 'numeric':
      if (!Number.isFinite(expression.value)) {
        return { success: false, error: 'Unsupported numeric literal: a finite number is required.' }
      }
      return {
        success: true,
        value: { hasValue: true, dataType: 'number', dataShape: 'single', value: expression.value },
      }
    case 'boolean':
      return {
        success: true,
        value: { hasValue: true, dataType: 'boolean', dataShape: 'single', value: expression.value },
      }
    case 'cast': {
      const dataType = temporalType(expression.to)
      if (!dataType || expression.operand.type !== 'string') {
        return {
          success: false,
          error:
            'Unsupported cast: only string literals cast to unqualified date, time, or timestamp without timezone or precision modifiers are supported.',
        }
      }
      const input = expression.operand.value
      // SQL's date/time space separator maps to the model's local datetime separator.
      const value =
        dataType === 'datetime' && input[10] === ' '
          ? `${input.slice(0, 10)}T${input.slice(11)}`
          : input
      if (!isValidPostgresqlTemporal(value, dataType)) {
        return {
          success: false,
          error: `Unsupported ${dataType} literal: an exact local calendar/clock value is required (seconds precision, no timezone, year 0001–9999).`,
        }
      }
      return { success: true, value: { hasValue: true, dataType, dataShape: 'single', value } }
    }
    default:
      return {
        success: false,
        error: `Unsupported value expression: ${expression.type}. Expected a scalar literal or an explicit local temporal literal.`,
      }
  }
}

// Export one value with its exact declared type, including falsy values and local temporal casts.
export function exportConditionLiteral(dataType: ValueDataType, value: unknown): ExportLiteralResult {
  switch (dataType) {
    case 'text':
      if (typeof value !== 'string') {
        return { success: false, error: 'Text values must be strings.' }
      }
      return { success: true, expression: { type: 'string', value } }
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { success: false, error: 'Number values must be finite numbers.' }
      }
      return {
        success: true,
        expression: { type: Number.isInteger(value) ? 'integer' : 'numeric', value },
      }
    case 'boolean':
      if (typeof value !== 'boolean') {
        return { success: false, error: 'Boolean values must be booleans.' }
      }
      return { success: true, expression: { type: 'boolean', value } }
    case 'date':
    case 'time':
    case 'datetime':
      if (typeof value !== 'string' || !isValidPostgresqlTemporal(value, dataType)) {
        return {
          success: false,
          error: `Invalid ${dataType} value: an exact local calendar/clock value is required (seconds precision, no timezone, year 0001–9999).`,
        }
      }
      return {
        success: true,
        expression: {
          type: 'cast',
          operand: { type: 'string', value },
          to: {
            name:
              dataType === 'datetime'
                ? 'timestamp without time zone'
                : dataType === 'time'
                  ? 'time without time zone'
                  : 'date',
          },
        },
      }
    default:
      return {
        success: false,
        error: `Unsupported value type: ${dataType}. Duration is not supported.`,
      }
  }
}
