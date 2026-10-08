import { withOptions } from 'sqlite3-parser/sqlite-3.53.0'
import type { ParseDiagnostic } from 'sqlite3-parser/sqlite-3.53.0'
import { mapSqliteRange, prepareSource, sqliteFailure, sqliteSource } from './source'
import type {
  SqliteParseFailure, SqliteParseResult, SqlitePreparedSource, SqliteProgram,
  SqliteSourceBuffer, SqliteStatement,
} from './types'

// Keep the configured parser private; all public parse paths perform lexical preparation.
const parser = withOptions({ digitSeparator: '' })

// Preflight exact submissions and mapped slices/wrappers without exposing native entry points.
export function prepareSqliteSource(input: string | SqliteSourceBuffer): SqliteParseResult<SqlitePreparedSource> {
  return prepareSource(typeof input === 'string' ? sqliteSource(input) : input, parser)
}

// Report native errors in submitted coordinates, replacing synthetic-wrapper diagnostics.
function parserFailure(prepared: SqlitePreparedSource, diagnostic?: ParseDiagnostic): SqliteParseFailure {
  const buffer = prepared.buffer
  const range = diagnostic?.span ?? { offset: buffer.source.length, length: 0 }
  const mapped = mapSqliteRange(buffer, range)
  const message = mapped.synthetic
    ? 'Missing or incomplete SQLite expression near this boundary.'
    : diagnostic?.message ?? 'SQLite parsing failed.'
  return sqliteFailure(buffer, 'syntax', message, range)
}

// Parse a complete schema/program submission after guarding its entire original and derived text.
export function parseSqliteProgram(input: string | SqliteSourceBuffer): SqliteParseResult<SqliteProgram> {
  const prepared = prepareSqliteSource(input)
  if (!prepared.success) return prepared
  try {
    const parsed = parser.parse(prepared.value.buffer.source)
    if (parsed.status === 'error') return parserFailure(prepared.value, parsed.errors[0])
    return { success: true, value: { prepared: prepared.value, root: parsed.root } }
  } catch {
    return parserFailure(prepared.value)
  }
}

// Parse exactly one statement with strict trailing-input rejection and contained exceptions.
export function parseSqliteStatement(input: string | SqliteSourceBuffer): SqliteParseResult<SqliteStatement> {
  const prepared = prepareSqliteSource(input)
  if (!prepared.success) return prepared
  try {
    const parsed = parser.parseStmt(prepared.value.buffer.source, { allowTrailing: false })
    if (parsed.status === 'error') return parserFailure(prepared.value, parsed.errors[0])
    if (parsed.tail !== prepared.value.buffer.source.length) {
      return sqliteFailure(prepared.value.buffer, 'unsupported-expression', 'Additional SQL content is not supported.', { offset: parsed.tail, length: prepared.value.buffer.source.length - parsed.tail })
    }
    return { success: true, value: { prepared: prepared.value, root: parsed.root, tail: parsed.tail } }
  } catch {
    return parserFailure(prepared.value)
  }
}
