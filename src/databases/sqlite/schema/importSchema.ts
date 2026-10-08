import type { SchemaImportResult } from '../../../types/databaseAdapter'
import { quoteSqliteField, quoteSqliteIdentifierSegments } from '../identifiers'
import { parseSqliteProgram } from '../parsing/library'
import { asciiLower } from '../parsing/validateExpression'
import { rejectSchema, schemaCursor } from './cursor'
import type { SchemaCursor } from './cursor'
import { takeSqliteTable } from './validateSchema'

type MergedTable = { readonly segments: readonly string[]; readonly columns: Set<string> }

// Tolerate empty native statement separators only within an otherwise supported table program.
function takeSeparators(cursor: SchemaCursor): number {
  let count = 0
  while (cursor.tokens[cursor.index]?.name === 'SEMI') {
    cursor.index += 1
    count += 1
  }
  return count
}

// Keep absent and explicit database qualifiers distinct using collision-safe ASCII-folded arrays.
function tableKey(segments: readonly string[]): string {
  const folded: string[] = []
  for (const segment of segments) folded.push(asciiLower(segment))
  return JSON.stringify(folded)
}

// Import all declarations atomically; native preflight precedes even empty-input recognition.
export function importSqliteSchema(sql: string): SchemaImportResult {
  try {
    const parsed = parseSqliteProgram(sql)
    if (!parsed.success) return { success: false, error: parsed.error.message }
    const { prepared, root } = parsed.value
    const cursor = schemaCursor(prepared)
    if (!root.cmds.length) rejectSchema(cursor, 'A SQLite schema import requires at least one CREATE TABLE with declared columns.')
    const tables = new Map<string, MergedTable>()
    const declarations: { readonly table: MergedTable; readonly column: string }[] = []
    for (let index = 0; index < root.cmds.length; index += 1) {
      const separators = takeSeparators(cursor)
      if (index && !separators) rejectSchema(cursor, 'SQLite CREATE TABLE statements must be separated by a semicolon.')
      const statement = root.cmds[index]!
      if (statement.type !== 'CreateTableStmt') {
        rejectSchema(cursor, `${statement.type} is outside the supported schema subset; only explicit-column CREATE TABLE statements are accepted.`, statement.span)
      }
      const table = takeSqliteTable(cursor, statement)
      const key = tableKey(table.segments)
      let merged = tables.get(key)
      if (!merged) {
        merged = { segments: table.segments, columns: new Set<string>() }
        tables.set(key, merged)
      }
      for (const column of table.columns) {
        const key = asciiLower(column)
        if (!merged.columns.has(key)) {
          merged.columns.add(key)
          declarations.push({ table: merged, column })
        }
      }
    }
    takeSeparators(cursor)
    if (cursor.index !== cursor.tokens.length) rejectSchema(cursor, 'Additional SQLite schema syntax was not fully consumed.')
    const fields: string[] = []
    const seen = new Set<string>()
    for (const { table, column } of declarations) {
      const prefix = table.segments.length === 2 || tables.size > 1 ? table.segments : []
      const segments = [...prefix, column]
      const field = segments.join('.')
      if (quoteSqliteField(field) !== quoteSqliteIdentifierSegments(segments)) {
        rejectSchema(cursor, 'A declared field cannot round-trip through the SQLite field model.')
      }
      const key = asciiLower(field)
      if (!seen.has(key)) {
        seen.add(key)
        fields.push(field)
      }
    }
    if (!fields.length) rejectSchema(cursor, 'The SQLite schema contains no declared fields.')
    return { success: true, fields }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'SQLite schema import failed.' }
  }
}
