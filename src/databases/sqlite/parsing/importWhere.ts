import type { FilterImportResult, DatabaseAdapter } from '../../../types/databaseAdapter'
import type { QueryNode, QueryGroup } from '../../../types/query'
import { createId } from '../../../utils/createId'
import { importSqliteVisualCondition } from './importCondition'
import { parseSqliteWhere } from './parseWhere'
import { sqliteFailure, sqliteSource } from './source'
import type { SqliteExpressionRecord, SqliteParseResult, SqliteSourceBuffer, SqliteSourceRegion } from './types'
import { validateSqliteExpression, type SqliteValidatedExpression } from './validateExpression'
import { validateSqliteRaw } from './validateRaw'

type RawConditionResult = ReturnType<NonNullable<DatabaseAdapter['parseRawCondition']>>

// Reassemble the preserved envelope with explicit mappings for every retained original slice.
function rawSourceBuffer(validated: SqliteValidatedExpression, expression: SqliteExpressionRecord): SqliteSourceBuffer {
  const original = validated.prepared.buffer.original
  const regions: SqliteSourceRegion[] = []
  let source = ''
  for (const range of expression.ranges) {
    if (!range.length) continue
    regions.push({ offset: source.length, length: range.length, originalOffset: range.offset, synthetic: false })
    source += original.slice(range.offset, range.offset + range.length)
  }
  if (!regions.length || source !== expression.source) throw new Error('SQLite Raw envelope does not match its preserved original slices.')
  return { source, original, regions }
}

// Preserve native logical nesting and validate extracted Raw leaves before constructing a local node.
function importNode(validated: SqliteValidatedExpression, expression: SqliteExpressionRecord): SqliteParseResult<QueryNode> {
  if (expression.kind === 'logical') {
    const children: QueryNode[] = []
    for (const child of expression.children) {
      const converted = importNode(validated, child)
      if (!converted.success) return converted
      children.push(converted.value)
    }
    return { success: true, value: { kind: 'group', id: createId(), mode: expression.mode, children } }
  }
  if (expression.kind === 'not') {
    const converted = importNode(validated, expression.child)
    if (!converted.success) return converted
    return { success: true, value: { kind: 'group', id: createId(), mode: 'none', children: [converted.value] } }
  }
  const visual = importSqliteVisualCondition(validated, expression)
  if (visual.success) return { success: true, value: visual.condition }
  if (!visual.requiresRaw) return { success: false, error: visual.error }
  const raw = validateSqliteRaw(rawSourceBuffer(validated, expression))
  if (!raw.success) return raw
  // Retain this exact envelope; reparsing checks eligibility without replacing the original source.
  return { success: true, value: {
    kind: 'condition', id: createId(), rawSql: expression.source,
    field: { name: '', modifier: null }, operatorId: '', value: { hasValue: false },
  } }
}

// Validate the complete submission before conversion and return a fresh tree only after every node succeeds.
export function importSqliteWhere(sql: string): FilterImportResult {
  const original = sqliteSource(typeof sql === 'string' ? sql : '')
  try {
    if (typeof sql !== 'string') return sqliteFailure(original, 'syntax', 'A SQLite filter must be a string.', { offset: 0, length: 0 })
    const parsed = parseSqliteWhere(sql)
    if (!parsed.success) return parsed
    if (!parsed.value.expression) {
      return { success: true, tree: { kind: 'group', id: createId(), mode: 'all', children: [] } }
    }
    const validated = validateSqliteExpression(parsed.value)
    if (!validated.success) return validated
    const converted = importNode(validated.value, validated.value.expression)
    if (!converted.success) return converted
    const tree: QueryGroup = converted.value.kind === 'group'
      ? converted.value : { kind: 'group', id: createId(), mode: 'all', children: [converted.value] }
    return { success: true, tree }
  } catch (error) {
    return sqliteFailure(original, 'unsupported-expression', error instanceof Error ? `SQLite filter conversion failed: ${error.message}` : 'SQLite filter conversion failed.', { offset: 0, length: original.source.length })
  }
}

// Convert exactly one fully representable condition; callers retain all existing Raw state on failure.
export function parseSqliteRawCondition(sql: string): RawConditionResult {
  try {
    if (typeof sql !== 'string') return { success: false, error: 'A SQLite Raw condition must be a string.' }
    const parsed = parseSqliteWhere(sql)
    if (!parsed.success) return { success: false, error: parsed.error.message }
    const validated = validateSqliteExpression(parsed.value)
    if (!validated.success) return { success: false, error: validated.error.message }
    const expression = validated.value.expression
    if (expression.kind !== 'leaf') {
      return { success: false, error: 'This expression requires Raw mode. Logical expressions cannot become a single visual condition.' }
    }
    const converted = importSqliteVisualCondition(validated.value, expression)
    return converted.success
      ? converted : {
        success: false,
        error: converted.requiresRaw ? `This expression requires Raw mode. ${converted.error.message}` : converted.error.message,
      }
  } catch (error) {
    return { success: false, error: error instanceof Error ? `SQLite Raw conversion failed: ${error.message}` : 'SQLite Raw conversion failed.' }
  }
}
