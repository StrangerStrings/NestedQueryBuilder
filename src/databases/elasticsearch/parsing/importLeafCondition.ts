import type { ConditionValue, ElasticsearchConditionParameter, QueryCondition } from '../../../types/query'
import { createId } from '../../../utils/createId'
import { getElasticsearchParameterNames, type ElasticsearchParameterName } from '../parameters'
import { validateElasticsearchCondition, validateElasticsearchFieldName, validateElasticsearchParameters } from '../validation'
import { JsonSourceError, validateQueryNumber, type JsonSourceDocument } from './readJsonSource'

export type ImportLeafConditionResult =
  | { success: true; condition: QueryCondition }
  | { success: false; error: JsonSourceError }

type Scalar = string | number | boolean

// Append decoded member names using the source reader's path convention.
function memberPath(path: string, key: string): string {
  return `${path}[${JSON.stringify(key)}]`
}

// Import a leaf and its explicit parameters; callers must establish an allowed filter context.
export function importLeafCondition(document: JsonSourceDocument, clausePath: string): ImportLeafConditionResult {
  // Attach failures to the original value range, including escaped source spellings.
  function sourceError(kind: JsonSourceError['kind'], message: string, path: string): JsonSourceError {
    const location = document.locations.get(path) ?? document.locations.get(clausePath) ?? document.locations.get('$')
    return new JsonSourceError(kind, message, location ?? { path, offset: 0, length: 0, fragment: '' })
  }

  // Stop conversion immediately when a structure or literal cannot be represented.
  function fail(kind: JsonSourceError['kind'], message: string, path: string): never {
    throw sourceError(kind, message, path)
  }

  // Require JSON objects rather than arrays, nulls or scalar shorthand at structural positions.
  function object(value: unknown, path: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      fail('unsupported-expression', 'Expected an Elasticsearch clause object.', path)
    }
    return value as Record<string, unknown>
  }

  // Reject every unmodeled member at its own source path before checking required members.
  function onlyMembers(value: Record<string, unknown>, allowed: string[], path: string): void {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) {
        fail('unsupported-expression', `Unsupported Elasticsearch member: ${key}.`, memberPath(path, key))
      }
    }
  }

  // Preserve JSON scalar types and validate the original spelling of each consumed number.
  function scalar(value: unknown, path: string): Scalar {
    if (typeof value === 'string' || typeof value === 'boolean') return value
    if (typeof value === 'number') {
      const token = document.numbers.get(path)
      if (!token) fail('unsupported-value', 'Missing source token for Elasticsearch query number.', path)
      const result = validateQueryNumber(token)
      if (!result.success) throw result.error
      return result.value
    }
    fail('unsupported-value', 'Expected a string, number or Boolean query value.', path)
  }

  // Normalize supported spellings after source-number validation and report failures at the parameter.
  function parameter(name: ElasticsearchParameterName, input: unknown, path: string, operatorId: string): ElasticsearchConditionParameter {
    let value = typeof input === 'number' ? scalar(input, path) : input
    if (name === 'operator' && (value === 'OR' || value === 'AND')) value = value.toLowerCase()
    if (name === 'fuzziness' && typeof value === 'string') {
      if (value.toUpperCase() === 'AUTO') value = 'AUTO'
      else if (value === '0' || value === '1' || value === '2') value = Number(value)
    }
    const row = { name, value }
    try {
      validateElasticsearchParameters(operatorId, [row])
    } catch (error) {
      fail('unsupported-value', error instanceof Error ? error.message : 'Unsupported Elasticsearch parameter value.', path)
    }
    return row as ElasticsearchConditionParameter
  }

  // Create a Text, Number or Boolean value without inferring dates or coercing strings.
  function conditionValue(values: Scalar[], shape: 'single' | 'list' | 'range'): ConditionValue {
    const first = values[0]!
    const dataType = typeof first === 'string' ? 'text' : typeof first === 'number' ? 'number' : 'boolean'
    return { hasValue: true, dataType, dataShape: shape, value: shape === 'single' ? first : values } as ConditionValue
  }

  try {
    const location = document.locations.get(clausePath)
    if (!location) fail('unsupported-expression', 'The requested clause path is absent from the source document.', clausePath)
    const clause = object(JSON.parse(location.fragment), clausePath)
    const clauseKeys = Object.keys(clause)
    if (clauseKeys.length !== 1) {
      fail('unsupported-expression', 'A leaf requires exactly one clause key.', clauseKeys.length > 1 ? memberPath(clausePath, clauseKeys[1]!) : clausePath)
    }
    const clauseName = clauseKeys[0]!
    const bodyPath = memberPath(clausePath, clauseName)
    if (!['term', 'terms', 'match', 'match_phrase', 'prefix', 'wildcard', 'range', 'exists'].includes(clauseName)) {
      fail('unsupported-operator', `Unsupported Elasticsearch leaf clause: ${clauseName}.`, bodyPath)
    }
    const body = object(clause[clauseName], bodyPath)
    let fieldName: string
    let fieldPath: string
    let valuePath: string
    let operatorId = clauseName
    let value: ConditionValue
    let parameters: ElasticsearchConditionParameter[] | undefined

    if (clauseName === 'exists') {
      onlyMembers(body, ['field'], bodyPath)
      fieldPath = memberPath(bodyPath, 'field')
      if (typeof body.field !== 'string') fail('unsupported-value', 'Exists requires a string field property.', 'field' in body ? fieldPath : bodyPath)
      fieldName = body.field
      valuePath = fieldPath
      value = { hasValue: false }
    } else {
      const fields = Object.keys(body)
      if (fields.length !== 1) {
        fail('unsupported-expression', 'A leaf requires exactly one target field and no additional options.', fields.length > 1 ? memberPath(bodyPath, fields[1]!) : bodyPath)
      }
      fieldName = fields[0]!
      fieldPath = memberPath(bodyPath, fieldName)
      valuePath = fieldPath
      const input = body[fieldName]
      if (clauseName === 'terms') {
        if (!Array.isArray(input) || input.length === 0) {
          fail('unsupported-value', 'Terms requires a nonempty scalar array; lookup objects are unsupported.', fieldPath)
        }
        const values: Scalar[] = []
        for (let index = 0; index < input.length; index += 1) {
          const path = `${fieldPath}[${index}]`
          const item = scalar(input[index], path)
          if (values.length && typeof item !== typeof values[0]) fail('unsupported-value', 'Terms requires homogeneous scalar types.', path)
          values.push(item)
        }
        value = conditionValue(values, 'list')
      } else if (clauseName === 'range') {
        const bounds = object(input, fieldPath)
        onlyMembers(bounds, ['gt', 'gte', 'lt', 'lte'], fieldPath)
        const keys = Object.keys(bounds)
        if (keys.length === 2 && keys.includes('gte') && keys.includes('lte')) {
          operatorId = 'between'
          valuePath = memberPath(fieldPath, 'gte')
          const lower = scalar(bounds.gte, valuePath)
          const upperPath = memberPath(fieldPath, 'lte')
          const upper = scalar(bounds.lte, upperPath)
          if (typeof lower !== typeof upper) fail('unsupported-value', 'Range endpoints require compatible scalar types.', upperPath)
          value = conditionValue([lower, upper], 'range')
        } else if (keys.length === 1) {
          operatorId = keys[0]!
          valuePath = memberPath(fieldPath, operatorId)
          value = conditionValue([scalar(bounds[operatorId], valuePath)], 'single')
        } else {
          fail('unsupported-expression', 'Range requires one bound or exactly the inclusive gte and lte pair.', fieldPath)
        }
      } else {
        let literal = input
        if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
          const options = object(input, fieldPath)
          const member = clauseName === 'match' || clauseName === 'match_phrase' ? 'query' : 'value'
          const supported = getElasticsearchParameterNames(clauseName)
          onlyMembers(options, [member, ...supported], fieldPath)
          if (!Object.prototype.hasOwnProperty.call(options, member)) {
            fail('unsupported-expression', `The object form requires its ${member} member.`, fieldPath)
          }
          valuePath = memberPath(fieldPath, member)
          literal = options[member]
          for (const key of Object.keys(options)) {
            if (key === member) continue
            const row = parameter(key as ElasticsearchParameterName, options[key], memberPath(fieldPath, key), clauseName)
            parameters ??= []
            parameters.push(row)
          }
        }
        value = conditionValue([scalar(literal, valuePath)], 'single')
      }
    }

    try {
      validateElasticsearchFieldName(fieldName)
    } catch (error) {
      fail('unsupported-expression', error instanceof Error ? error.message : 'Unsupported Elasticsearch field.', fieldPath)
    }
    const condition: QueryCondition = {
      kind: 'condition',
      id: createId(),
      field: { name: fieldName, modifier: null },
      operatorId,
      value,
      ...(parameters ? { parameters } : {}),
    }
    try {
      validateElasticsearchCondition(condition)
    } catch (error) {
      fail('unsupported-value', error instanceof Error ? error.message : 'Unsupported Elasticsearch condition value.', valuePath)
    }
    return { success: true, condition }
  } catch (error) {
    if (error instanceof JsonSourceError) return { success: false, error }
    return { success: false, error: sourceError('unsupported-expression', error instanceof Error ? error.message : 'Unsupported Elasticsearch leaf.', clausePath) }
  }
}
