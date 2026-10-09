import type { FilterImportResult } from '../../../types/databaseAdapter'
import type { QueryGroup, QueryNode } from '../../../types/query'
import { createId } from '../../../utils/createId'
import { JsonSourceError, readJsonSource } from '../../shared/parsing/readJsonSource'
import { generateMongoDBWhereSql } from '../serialisation/generateWhereSql'
import { importLeafCondition } from './importLeafCondition'

// Append literal member names using the shared source reader's path convention.
function memberPath(path: string, key: string): string {
  return `${path}[${JSON.stringify(key)}]`
}

// Import a complete bare MongoDB filter into a fresh, validated tree atomically.
export function importMongoDBWhere(source: string): FilterImportResult {
  const parsed = readJsonSource(source)
  if (!parsed.success) {
    return { success: false, error: { kind: parsed.error.kind, message: parsed.error.message, fragment: parsed.error.fragment } }
  }
  const document = parsed.value

  // Attach categorized failures to original source values with a root fallback.
  function sourceError(kind: JsonSourceError['kind'], message: string, path: string): JsonSourceError {
    const location = document.locations.get(path) ?? document.locations.get('$')
    return new JsonSourceError(kind, message, location ?? { path, offset: 0, length: 0, fragment: '' })
  }

  // Abort conversion without exposing a partially constructed query tree.
  function fail(kind: JsonSourceError['kind'], message: string, path: string): never {
    throw sourceError(kind, message, path)
  }

  // Give each imported group a fresh identity without copying application state.
  function group(mode: QueryGroup['mode'], children: QueryNode[]): QueryGroup {
    return { kind: 'group', id: createId(), mode, children }
  }

  // Convert every member conjunctively, preserving each logical child's filter scope.
  function filter(value: unknown, path: string): QueryNode {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      fail('unsupported-expression', 'Expected a MongoDB filter object.', path)
    }
    const members = Object.entries(value as Record<string, unknown>)
    if (!members.length) {
      if (path === '$') return group('all', [])
      fail('unsupported-expression', 'Nested empty MongoDB filters are unsupported.', path)
    }

    const children: QueryNode[] = []
    for (const [key, operand] of members) {
      const operandPath = memberPath(path, key)
      if (!key.startsWith('$')) {
        const imported = importLeafCondition(document, key, operandPath)
        if (!imported.success) throw imported.error
        children.push(...imported.value)
        continue
      }
      if (key !== '$and' && key !== '$or' && key !== '$nor') {
        fail('unsupported-operator', `Unsupported MongoDB filter operator: ${key}.`, operandPath)
      }
      if (!Array.isArray(operand) || !operand.length) {
        fail('unsupported-expression', 'MongoDB logical operators require nonempty arrays of filter objects.', operandPath)
      }
      const clauses: QueryNode[] = []
      for (let index = 0; index < operand.length; index += 1) {
        clauses.push(filter(operand[index], `${operandPath}[${index}]`))
      }
      const mode = key === '$and' ? 'all' : key === '$or' ? 'any' : 'none'
      children.push(group(mode, clauses))
    }
    return children.length === 1 ? children[0]! : group('all', children)
  }

  try {
    const node = filter(document.value, '$')
    const tree = node.kind === 'group' ? node : group('all', [node])
    const validated = generateMongoDBWhereSql(tree)
    if (!validated.success) fail('unsupported-expression', validated.error, '$')
    return { success: true, tree }
  } catch (error) {
    const failure = error instanceof JsonSourceError
      ? error
      : sourceError('unsupported-expression', error instanceof Error ? error.message : 'Unsupported MongoDB filter.', '$')
    return { success: false, error: { kind: failure.kind, message: failure.message, fragment: failure.fragment } }
  }
}
