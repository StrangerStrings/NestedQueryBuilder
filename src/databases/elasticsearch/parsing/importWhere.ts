import type { FilterImportResult } from '../../../types/databaseAdapter'
import type { QueryGroup, QueryNode } from '../../../types/query'
import { createId } from '../../../utils/createId'
import { generateElasticsearchWhereSql } from '../serialisation/generateWhereSql'
import { importLeafCondition } from './importLeafCondition'
import { JsonSourceError, readJsonSource, validateQueryNumber } from './readJsonSource'

type QueryContext = 'query' | 'filter'

// Append decoded member names using the source reader's path convention.
function memberPath(path: string, key: string): string {
  return `${path}[${JSON.stringify(key)}]`
}

// Validate imports atomically and remove the exporter's outer filter group without normalizing scores.
export function importElasticsearchWhere(source: string): FilterImportResult {
  const parsed = readJsonSource(source)
  if (!parsed.success) {
    return {
      success: false,
      error: {
        kind: parsed.error.kind,
        message: parsed.error.message,
        fragment: parsed.error.fragment,
      },
    }
  }
  const document = parsed.value

  // Attach failures to the original JSON value, preserving source paths and spellings.
  function sourceError(
    kind: JsonSourceError['kind'],
    message: string,
    path: string,
  ): JsonSourceError {
    const location = document.locations.get(path) ?? document.locations.get('$')
    return new JsonSourceError(
      kind,
      message,
      location ?? { path, offset: 0, length: 0, fragment: '' },
    )
  }

  // Stop conversion without exposing any partially constructed tree.
  function fail(kind: JsonSourceError['kind'], message: string, path: string): never {
    throw sourceError(kind, message, path)
  }

  // Require objects at envelope, clause and Boolean body positions.
  function object(value: unknown, path: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      fail('unsupported-expression', 'Expected an Elasticsearch query object.', path)
    }
    return value as Record<string, unknown>
  }

  // Give every imported group a fresh identity without copying application state.
  function group(mode: QueryGroup['mode'], children: QueryNode[]): QueryGroup {
    return { kind: 'group', id: createId(), mode, children }
  }

  // Parse one clause object or a nonempty clause array in its assigned scoring context.
  function clauses(value: unknown, path: string, context: QueryContext): QueryNode[] {
    if (!Array.isArray(value)) return [clause(value, path, context)]
    if (!value.length)
      fail('unsupported-expression', 'Boolean clause arrays must be nonempty.', path)
    const children: QueryNode[] = []
    for (let index = 0; index < value.length; index += 1) {
      children.push(clause(value[index], `${path}[${index}]`, context))
    }
    return children
  }

  // Preserve Boolean nesting and accept only alternatives that are required to match.
  function boolean(value: unknown, path: string, context: QueryContext): QueryGroup {
    const body = object(value, path)
    const keys = Object.keys(body)
    if (!keys.length)
      fail('unsupported-expression', 'Empty Boolean query bodies are unsupported.', path)
    for (const key of keys) {
      if (!['must', 'filter', 'should', 'must_not', 'minimum_should_match'].includes(key)) {
        fail(
          'unsupported-expression',
          `Unsupported Elasticsearch Boolean member: ${key}.`,
          memberPath(path, key),
        )
      }
    }

    const thresholdPath = memberPath(path, 'minimum_should_match')
    if (keys.includes('minimum_should_match')) {
      if (!keys.includes('should')) {
        fail(
          'unsupported-expression',
          'minimum_should_match requires should clauses.',
          thresholdPath,
        )
      }
      const threshold = body.minimum_should_match
      if (typeof threshold === 'number') {
        const token = document.numbers.get(thresholdPath)
        if (!token)
          fail('unsupported-value', 'Missing source token for minimum_should_match.', thresholdPath)
        const validated = validateQueryNumber(token)
        if (!validated.success) throw validated.error
      }
      if (threshold !== 1 && threshold !== '1') {
        fail(
          'unsupported-value',
          'Only minimum_should_match of numeric 1 or string "1" is supported.',
          thresholdPath,
        )
      }
    } else if (keys.includes('should') && (keys.includes('must') || keys.includes('filter'))) {
      fail(
        'unsupported-expression',
        'Optional should clauses are unsupported; minimum_should_match must explicitly require one alternative.',
        memberPath(path, 'should'),
      )
    }

    const requirements: QueryGroup[] = []
    for (const key of keys) {
      if (key === 'minimum_should_match') continue
      const childContext = key === 'filter' || key === 'must_not' ? 'filter' : context
      const mode = key === 'must_not' ? 'none' : key === 'should' ? 'any' : 'all'
      requirements.push(group(mode, clauses(body[key], memberPath(path, key), childContext)))
    }
    return requirements.length === 1 ? requirements[0]! : group('all', requirements)
  }

  // Reject scoring leaves and constants before delegating filter leaves, including analyzed prefixes.
  function clause(value: unknown, path: string, context: QueryContext): QueryNode {
    const input = object(value, path)
    const keys = Object.keys(input)
    if (keys.length !== 1) {
      fail(
        'unsupported-expression',
        'A query clause requires exactly one member.',
        keys.length > 1 ? memberPath(path, keys[1]!) : path,
      )
    }
    const name = keys[0]!
    const bodyPath = memberPath(path, name)
    if (name === 'bool') return boolean(input.bool, bodyPath, context)
    if (name === 'match_all' || name === 'match_none') {
      const message =
        name === 'match_all' && context === 'query'
          ? 'Importing match_all in query context would require score normalization; only the canonical empty filter query is supported.'
          : 'Constant clauses are unsupported outside the canonical empty root query.'
      fail('unsupported-expression', message, bodyPath)
    }
    if (
      !['term', 'terms', 'match', 'match_phrase', 'match_phrase_prefix', 'match_bool_prefix', 'prefix', 'wildcard', 'range', 'exists'].includes(
        name,
      )
    ) {
      fail('unsupported-operator', `Unsupported Elasticsearch leaf clause: ${name}.`, bodyPath)
    }
    if (context === 'query') {
      fail(
        'unsupported-expression',
        `Importing ${name} in query context would require score normalization; supported leaves must be reached through filter or must_not.`,
        bodyPath,
      )
    }
    const imported = importLeafCondition(document, path)
    if (!imported.success) throw imported.error
    return imported.condition
  }

  try {
    const root = object(document.value, '$')
    let input: unknown = root
    let path = '$'
    if (Object.prototype.hasOwnProperty.call(root, 'query')) {
      for (const key of Object.keys(root)) {
        if (key !== 'query') {
          fail(
            'unsupported-expression',
            'An Elasticsearch request envelope may contain only query.',
            memberPath('$', key),
          )
        }
      }
      input = root.query
      path = memberPath('$', 'query')
    }

    const node =
      JSON.stringify(input) === '{"bool":{"filter":[{"match_all":{}}]}}'
        ? group('all', [])
        : clause(input, path, 'query')
    let tree = node.kind === 'group' ? node : group('all', [node])
    const rootBool = object(input, path).bool as Record<string, unknown> | undefined
    const child = tree.children[0]
    // Unwrap exactly one validated root filter wrapper, preserving all nested user groups.
    if (
      rootBool &&
      Object.keys(rootBool).length === 1 &&
      Array.isArray(rootBool.filter) &&
      rootBool.filter.length === 1 &&
      tree.mode === 'all' &&
      tree.children.length === 1 &&
      child?.kind === 'group'
    ) {
      tree = child
    }
    const validated = generateElasticsearchWhereSql(tree)
    if (!validated.success) fail('unsupported-expression', validated.error, path)
    return { success: true, tree }
  } catch (error) {
    const failure =
      error instanceof JsonSourceError
        ? error
        : sourceError(
            'unsupported-expression',
            error instanceof Error ? error.message : 'Unsupported Elasticsearch query.',
            '$',
          )
    return {
      success: false,
      error: { kind: failure.kind, message: failure.message, fragment: failure.fragment },
    }
  }
}
