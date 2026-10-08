import type { DatabaseOperator, ValueDataType } from '../../types/databaseOperator'
import type { ConditionField, ConditionValue, QueryCondition } from '../../types/query'
import { isValidTemporal } from '../../utils/temporalValue'
import { elasticsearchOperators, type ElasticsearchOperator } from './operators'

// Resolve only explicit catalogue IDs for subsequent Elasticsearch query handling.
export function resolveElasticsearchOperator(operatorId: string): ElasticsearchOperator {
  const operator = elasticsearchOperators.find((candidate) => candidate.id === operatorId)
  if (!operator) throw new Error('Unsupported Elasticsearch operator; use a canonical catalogue ID.')
  return operator
}

// Preserve field names verbatim while rejecting names the text editor cannot represent reliably.
export function validateElasticsearchFieldName(name: string): void {
  if (typeof name !== 'string' || name.length === 0 || name.trim() !== name || /[\u0000\r\n]/.test(name)) {
    throw new Error('An Elasticsearch field name must be nonempty, without surrounding whitespace, NUL or line breaks.')
  }
}

// Validate a field without applying SQL quoting, splitting paths or allowing modifiers.
export function validateElasticsearchField(field: ConditionField): void {
  if (!field || typeof field !== 'object' || Array.isArray(field)) {
    throw new Error('An Elasticsearch condition requires a field object.')
  }
  validateElasticsearchFieldName(field.name)
  if (field.modifier !== null) throw new Error('Elasticsearch field modifiers are unsupported; use null.')
}

// Validate one primitive without coercing strings, numbers, Booleans or local temporal values.
function validatePrimitive(dataType: ValueDataType, value: unknown): void {
  if (dataType === 'text' && typeof value === 'string') return
  if (dataType === 'boolean' && typeof value === 'boolean') return
  if (dataType === 'number' && typeof value === 'number' && Number.isFinite(value)) {
    if (!Number.isInteger(value) || Number.isSafeInteger(value)) return
  }
  if ((dataType === 'date' || dataType === 'datetime') && typeof value === 'string' && isValidTemporal(value, dataType)) {
    return
  }
  throw new Error(`Invalid Elasticsearch ${dataType} value; use a supported primitive, finite safe number or valid local temporal string.`)
}

// Require the catalogue's value shape and type, including complete homogeneous lists and ranges.
export function validateElasticsearchValue(operatorId: string, value: ConditionValue): void {
  const operator: DatabaseOperator = resolveElasticsearchOperator(operatorId)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('An Elasticsearch condition requires a value object.')
  }
  const input = operator.valueInput
  if (!input.hasValue) {
    if (value.hasValue !== false || 'value' in value || 'dataType' in value || 'dataShape' in value) {
      throw new Error(`${operator.id} does not accept a value.`)
    }
    return
  }
  if (value.hasValue !== true || value.dataShape !== input.dataShape || !input.dataTypes.includes(value.dataType)) {
    throw new Error(`Unsupported Elasticsearch value shape or type for ${operator.id}.`)
  }
  if (value.dataShape === 'single') {
    validatePrimitive(value.dataType, value.value)
    return
  }
  const values = value.value
  if (!Array.isArray(values) || values.length === 0 || (value.dataShape === 'range' && values.length !== 2)) {
    throw new Error('Elasticsearch lists must be nonempty and ranges require exactly two endpoints.')
  }
  for (let index = 0; index < values.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(values, index)) {
      throw new Error('Elasticsearch lists and ranges cannot contain missing elements.')
    }
    validatePrimitive(value.dataType, values[index])
  }
}

// Reject Raw SQL and validate a structured condition before generating or importing Query DSL.
export function validateElasticsearchCondition(condition: QueryCondition): void {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition) || condition.kind !== 'condition') {
    throw new Error('Elasticsearch requires a structured condition.')
  }
  if ('rawSql' in condition) throw new Error('Raw SQL is unsupported in Elasticsearch conditions.')
  validateElasticsearchField(condition.field)
  validateElasticsearchValue(condition.operatorId, condition.value)
}
