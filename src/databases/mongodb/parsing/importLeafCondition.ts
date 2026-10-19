import type { ConditionValue, MongoDBConditionParameter, QueryCondition } from '../../../types/query'
import { createId } from '../../../utils/createId'
import { resolveMongoDBOperator, validateMongoDBCondition, validateMongoDBFieldName, validateMongoDBQueryNumber, validateMongoDBRegexOptions } from '../validation'
import { JsonSourceError, type JsonSourceDocument, type JsonSourceResult } from '../../shared/parsing/readJsonSource'

export type ImportLeafConditionResult = JsonSourceResult<QueryCondition[]>

type Scalar = string | number | boolean

// Append literal member names using the shared source reader's path convention.
function memberPath(path: string, key: string): string {
  return `${path}[${JSON.stringify(key)}]`
}

// Convert complete field predicates atomically, pairing regex options in either member order.
export function importLeafCondition(document: JsonSourceDocument, fieldName: string, fieldPath: string): ImportLeafConditionResult {
  // Preserve the offending original operand, with field and document fallbacks.
  function sourceError(kind: JsonSourceError['kind'], message: string, path: string): JsonSourceError {
    const location = document.locations.get(path) ?? document.locations.get(fieldPath) ?? document.locations.get('$')
    return new JsonSourceError(kind, message, location ?? { path, offset: 0, length: 0, fragment: '' })
  }

  // Stop the entire field conversion rather than returning partially imported operators.
  function fail(kind: JsonSourceError['kind'], message: string, path: string): never {
    throw sourceError(kind, message, path)
  }

  // Preserve primitive types and check every consumed number against its source token.
  function scalar(input: unknown, path: string): Scalar {
    if (typeof input === 'string' || typeof input === 'boolean') return input
    if (typeof input === 'number') {
      const token = document.numbers.get(path)
      if (!token) fail('unsupported-value', 'Missing source token for MongoDB query number.', path)
      const result = validateMongoDBQueryNumber(token)
      if (!result.success) throw result.error
      return result.value
    }
    fail('unsupported-value', 'MongoDB operands require string, number or Boolean primitives; BSON wrappers, documents, arrays and null are unsupported here.', path)
  }

  // Build typed scalar values without inferring BSON types or coercing primitives.
  function singleValue(input: Scalar): ConditionValue {
    if (typeof input === 'string') return { hasValue: true, dataType: 'text', dataShape: 'single', value: input }
    if (typeof input === 'number') return { hasValue: true, dataType: 'number', dataShape: 'single', value: input }
    return { hasValue: true, dataType: 'boolean', dataShape: 'single', value: input }
  }

  // Require nonempty homogeneous primitive lists while retaining their original order.
  function listValue(input: unknown, path: string): ConditionValue {
    if (!Array.isArray(input) || input.length === 0) {
      fail('unsupported-value', 'MongoDB list operators require a nonempty homogeneous primitive array.', path)
    }
    const values: Scalar[] = []
    for (let index = 0; index < input.length; index += 1) {
      const itemPath = `${path}[${index}]`
      const item = scalar(input[index], itemPath)
      if (values.length && typeof item !== typeof values[0]) {
        fail('unsupported-value', 'MongoDB lists require homogeneous primitive types.', itemPath)
      }
      values.push(item)
    }
    const first = values[0]!
    const dataType = typeof first === 'string' ? 'text' : typeof first === 'number' ? 'number' : 'boolean'
    return { hasValue: true, dataType, dataShape: 'list', value: values } as ConditionValue
  }

  // Validate completed conditions and optional regex flags using the generation contract.
  function condition(operatorId: string, value: ConditionValue, path: string, parameters?: MongoDBConditionParameter[]): QueryCondition {
    const result: QueryCondition = {
      kind: 'condition',
      id: createId(),
      field: { name: fieldName, modifier: null },
      operatorId,
      value,
      ...(parameters === undefined ? {} : { parameters }),
    }
    try {
      validateMongoDBCondition(result)
    } catch (error) {
      fail('unsupported-value', error instanceof Error ? error.message : 'Unsupported MongoDB operand.', path)
    }
    return result
  }

  // Translate supported predicates, selecting the BSON type catalogue entry by operand shape.
  function operatorCondition(operator: string, input: unknown, path: string): QueryCondition {
    if (operator === '$exists') {
      if (typeof input !== 'boolean') fail('unsupported-value', 'MongoDB $exists requires a Boolean.', path)
      return condition(input ? 'exists' : 'missing', { hasValue: false }, path)
    }
    if (operator === '$type') {
      return Array.isArray(input)
        ? condition('type_list', listValue(input, path), path)
        : condition('type', singleValue(scalar(input, path)), path)
    }
    if (!['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$all', '$regex', '$size'].includes(operator)) {
      fail('unsupported-operator', `Unsupported MongoDB field predicate operator: ${operator}.`, path)
    }
    if ((operator === '$eq' || operator === '$ne') && input === null) {
      return condition(operator === '$eq' ? 'equals_null' : 'not_equals_null', { hasValue: false }, path)
    }
    const operatorId = operator.slice(1)
    const catalogueOperator = resolveMongoDBOperator(operatorId)
    const value = catalogueOperator.valueInput.hasValue && catalogueOperator.valueInput.dataShape === 'list'
      ? listValue(input, path)
      : singleValue(scalar(input, path))
    return condition(operatorId, value, path)
  }

  try {
    const location = document.locations.get(fieldPath)
    if (!location) fail('unsupported-expression', 'The requested MongoDB field path is absent from the source document.', fieldPath)
    try {
      validateMongoDBFieldName(fieldName)
    } catch (error) {
      fail('unsupported-expression', error instanceof Error ? error.message : 'Unsupported MongoDB field name.', fieldPath)
    }
    const input: unknown = JSON.parse(location.fragment)
    if (input === null) return { success: true, value: [condition('equals_null', { hasValue: false }, fieldPath)] }
    if (typeof input !== 'object') {
      return { success: true, value: [condition('eq', singleValue(scalar(input, fieldPath)), fieldPath)] }
    }
    if (Array.isArray(input)) {
      fail('unsupported-value', 'MongoDB array equality is unsupported; use a supported primitive list operator.', fieldPath)
    }
    const members = Object.entries(input as Record<string, unknown>)
    if (members.length === 0) fail('unsupported-expression', 'An empty MongoDB field predicate object is unsupported.', fieldPath)
    if (members.some(([key]) => !key.startsWith('$'))) {
      fail('unsupported-value', 'MongoDB embedded-document equality is unsupported; field values must use the primitive-only subset.', fieldPath)
    }
    const bsonWrapperKeys = ['$oid', '$date', '$binary', '$uuid', '$numberInt', '$numberLong', '$numberDouble', '$numberDecimal', '$timestamp', '$regularExpression', '$minKey', '$maxKey', '$undefined', '$symbol', '$code', '$dbPointer', '$ref']
    if (members.some(([key]) => bsonWrapperKeys.includes(key))) {
      fail('unsupported-value', 'MongoDB BSON and Extended JSON value wrappers are unsupported; field values must use the primitive-only subset.', fieldPath)
    }
    const predicates = input as Record<string, unknown>
    let regexParameters: MongoDBConditionParameter[] | undefined
    if (Object.prototype.hasOwnProperty.call(predicates, '$options')) {
      const optionsPath = memberPath(fieldPath, '$options')
      if (!Object.prototype.hasOwnProperty.call(predicates, '$regex')) {
        fail('unsupported-operator', 'MongoDB $options requires $regex on the same field.', optionsPath)
      }
      const options = predicates.$options
      try {
        validateMongoDBRegexOptions(options)
      } catch (error) {
        fail('unsupported-value', error instanceof Error ? error.message : 'Invalid MongoDB regex options.', optionsPath)
      }
      regexParameters = [{ name: '$options', value: options }]
    }
    const conditions: QueryCondition[] = []
    for (const [operator, operand] of members) {
      if (operator === '$options') continue
      const path = memberPath(fieldPath, operator)
      conditions.push(operator === '$regex'
        ? condition('regex', singleValue(scalar(operand, path)), path, regexParameters)
        : operatorCondition(operator, operand, path))
    }
    return { success: true, value: conditions }
  } catch (error) {
    if (error instanceof JsonSourceError) return { success: false, error }
    return { success: false, error: sourceError('unsupported-expression', error instanceof Error ? error.message : 'Unsupported MongoDB field predicate.', fieldPath) }
  }
}
