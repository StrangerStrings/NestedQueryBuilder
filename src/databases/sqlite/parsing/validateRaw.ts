import { parseSqliteWhere } from './parseWhere'
import { sqliteFailure, sqliteSource } from './source'
import type { SqliteParseResult, SqliteSourceBuffer } from './types'
import { validateSqliteExpression, type SqliteValidatedExpression } from './validateExpression'

export type SqliteRawResult = SqliteParseResult<SqliteValidatedExpression>

// Guard and validate exact Raw submissions independently of visual representability, preserving source.
export function validateSqliteRaw(input: string | SqliteSourceBuffer): SqliteRawResult {
  try {
    const parsed = parseSqliteWhere(input)
    return parsed.success ? validateSqliteExpression(parsed.value) : parsed
  } catch (error) {
    const original = sqliteSource(typeof input === 'string' ? input : input.original)
    return sqliteFailure(original, 'syntax', error instanceof Error ? `SQLite Raw validation failed: ${error.message}` : 'SQLite Raw validation failed.', { offset: 0, length: original.source.length })
  }
}
