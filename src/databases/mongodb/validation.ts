import type { DatabaseOperator, ValueDataType } from '../../types/databaseOperator'
import {
  JsonSourceError,
  type JsonSourceNumber,
  type JsonSourceResult,
} from '../shared/parsing/readJsonSource'
import { mongodbOperators, type MongoDBOperator } from './operators'

// Read structural members without trusting inherited properties or special object keys.
function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

// Require an object with its own structural members before reading editor metadata.
function requireMembers(
  value: unknown,
  members: string[],
  message: string,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message)
  for (const member of members) {
    if (!hasOwn(value, member)) throw new Error(message)
  }
  return value as Record<string, unknown>
}

// Resolve only explicit catalogue IDs, without object-key lookup or alias coercion.
export function resolveMongoDBOperator(operatorId: unknown): MongoDBOperator {
  for (const operator of mongodbOperators) {
    if (operator.id === operatorId) return operator
  }
  throw new Error('Unsupported MongoDB operator; use a canonical catalogue ID.')
}

// Preserve literal path spelling while rejecting empty or dollar-prefixed path segments.
export function validateMongoDBFieldName(name: unknown): asserts name is string {
  if (
    typeof name !== 'string' ||
    name.length === 0 ||
    name.trim() !== name ||
    // oxlint-disable-next-line no-control-regex -- Control characters are intentionally validated.
    /[\u0000\r\n\u2028\u2029]/.test(name)
  ) {
    throw new Error(
      'A MongoDB field name must be nonempty, without surrounding whitespace, NUL or line breaks.',
    )
  }
  for (const segment of name.split('.')) {
    if (segment.length === 0 || segment.startsWith('$')) {
      throw new Error('MongoDB field paths cannot contain empty or dollar-prefixed segments.')
    }
  }
}

// Require an unmodified field with its own name and modifier members.
export function validateMongoDBField(value: unknown): void {
  const field = requireMembers(
    value,
    ['name', 'modifier'],
    'A MongoDB condition requires a field object with a name and modifier.',
  )
  validateMongoDBFieldName(field.name)
  if (field.modifier !== null) throw new Error('MongoDB field modifiers are unsupported; use null.')
}

// Validate primitives literally, without BSON inference, temporal coercion or regex compilation.
function validatePrimitive(dataType: ValueDataType, value: unknown): void {
  if (dataType === 'text' && typeof value === 'string') return
  if (dataType === 'boolean' && typeof value === 'boolean') return
  if (dataType === 'number' && typeof value === 'number' && Number.isFinite(value)) {
    if (!Number.isInteger(value) || Number.isSafeInteger(value)) return
  }
  throw new Error(
    `Invalid MongoDB ${dataType} value; use a matching primitive with finite numbers and safe integers.`,
  )
}

// Accept exact native BSON aliases and numeric codes without converting strings to numbers.
function validateBsonType(value: unknown): void {
  if (typeof value === 'string' && [
    'double', 'string', 'object', 'array', 'binData', 'undefined', 'objectId', 'bool',
    'date', 'null', 'regex', 'dbPointer', 'javascript', 'symbol', 'javascriptWithScope',
    'int', 'timestamp', 'long', 'decimal', 'minKey', 'maxKey', 'number',
  ].includes(value)) return
  if (typeof value === 'number' && Number.isInteger(value) &&
    (value === -1 || (value >= 1 && value <= 19) || value === 127)) return
  throw new Error('MongoDB $type requires an exact BSON type alias or numeric code (-1, 1–19, or 127); numeric strings are not codes.')
}

// Require catalogue metadata and complete homogeneous operands, including native BSON types.
export function validateMongoDBValue(operatorId: unknown, operand: unknown): void {
  const operator: DatabaseOperator = resolveMongoDBOperator(operatorId)
  const value = requireMembers(
    operand,
    ['hasValue'],
    'A MongoDB condition requires a value object with hasValue.',
  )
  const input = operator.valueInput
  if (!input.hasValue) {
    if (
      value.hasValue !== false ||
      'value' in value ||
      'dataType' in value ||
      'dataShape' in value
    ) {
      throw new Error(`${operator.id} does not accept value metadata.`)
    }
    return
  }
  requireMembers(
    value,
    ['dataType', 'dataShape', 'value'],
    'A MongoDB operand requires its own type, shape and value.',
  )
  if (
    value.hasValue !== true ||
    value.dataShape !== input.dataShape ||
    !input.dataTypes.includes(value.dataType as ValueDataType)
  ) {
    throw new Error(`Unsupported MongoDB value shape or type for ${operator.id}.`)
  }
  const dataType = value.dataType as ValueDataType
  if (value.dataShape === 'single') {
    validatePrimitive(dataType, value.value)
    if (operator.id === 'type') validateBsonType(value.value)
    if (
      operator.id === 'size' &&
      (typeof value.value !== 'number' || !Number.isSafeInteger(value.value) || value.value < 0)
    ) {
      throw new Error('MongoDB size requires a nonnegative safe integer.')
    }
    return
  }
  const values = value.value
  if (!Array.isArray(values) || values.length === 0)
    throw new Error('MongoDB lists must be nonempty primitive arrays.')
  for (let index = 0; index < values.length; index += 1) {
    if (!hasOwn(values, index)) throw new Error('MongoDB lists cannot contain missing elements.')
    validatePrimitive(dataType, values[index])
    if (operator.id === 'type_list') validateBsonType(values[index])
  }
}

// Accept native regex option strings without compiling or rewriting pattern strings.
export function validateMongoDBRegexOptions(value: unknown): asserts value is string {
  if (typeof value !== 'string' || /[^imsxu]/.test(value)) {
    throw new Error('MongoDB $options requires a string containing only i, m, s, x or u flags.')
  }
}

// Require one native options row, restricted to visual regex conditions.
function validateMongoDBParameters(operatorId: unknown, parameters: unknown): void {
  if (parameters === undefined) return
  if (!Array.isArray(parameters)) throw new Error('MongoDB parameters must be a row array.')
  if (parameters.length === 0) return
  if (operatorId !== 'regex' || parameters.length !== 1) {
    throw new Error('Only MongoDB regex conditions accept one $options parameter.')
  }
  const parameter = requireMembers(
    parameters[0],
    ['name', 'value'],
    'A MongoDB regex parameter requires a name and value.',
  )
  if (parameter.name !== '$options' || Object.keys(parameter).length !== 2) {
    throw new Error('MongoDB regex conditions support only the native $options parameter.')
  }
  validateMongoDBRegexOptions(parameter.value)
}

// Reject Raw SQL and malformed editor conditions, including incompatible regex parameters.
export function validateMongoDBCondition(value: unknown): void {
  const condition = requireMembers(
    value,
    ['kind', 'id', 'field', 'operatorId', 'value'],
    'MongoDB requires a structured condition with its own members.',
  )
  if (condition.kind !== 'condition' || typeof condition.id !== 'string')
    throw new Error('MongoDB requires a structured condition.')
  if ('rawSql' in condition) throw new Error('Raw SQL is unsupported in MongoDB conditions.')
  validateMongoDBField(condition.field)
  validateMongoDBValue(condition.operatorId, condition.value)
  validateMongoDBParameters(condition.operatorId, condition.parameters)
}

// Reject consumed source numbers that overflow, underflow to zero or have unsafe integer values.
export function validateMongoDBQueryNumber(token: JsonSourceNumber): JsonSourceResult<number> {
  const value = token.value
  const significand = token.fragment.split(/[eE]/)[0] ?? ''
  let message: string | undefined
  if (!Number.isFinite(value))
    message = 'MongoDB query numbers must be finite; this token overflows.'
  else if (value === 0 && /[1-9]/.test(significand))
    message = 'A nonzero MongoDB query number must not underflow to zero.'
  else if (Number.isInteger(value) && !Number.isSafeInteger(value))
    message = 'MongoDB query integer values must be safe integers.'
  if (message)
    return { success: false, error: new JsonSourceError('unsupported-value', message, token) }
  return { success: true, value }
}
