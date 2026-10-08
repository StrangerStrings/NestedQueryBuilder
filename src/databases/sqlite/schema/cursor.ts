import type { Id, Name } from 'sqlite3-parser/sqlite-3.53.0'
import { quoteSqliteIdentifierSegments } from '../identifiers'
import { sqliteFailure } from '../parsing/source'
import { asciiLower, validateSqliteIdentifier } from '../parsing/validateExpression'
import type { SqlitePreparedSource, SqliteRange, SqliteSourceToken } from '../parsing/types'

export type SchemaCursor = {
  readonly prepared: SqlitePreparedSource
  readonly tokens: readonly SqliteSourceToken[]
  index: number
}

const punctuation: Readonly<Record<string, string>> = { LP: '(', RP: ')', DOT: '.', COMMA: ',', PLUS: '+', MINUS: '-' }

// Read significant native tokens only after the complete submission has passed guarded parsing.
export function schemaCursor(prepared: SqlitePreparedSource): SchemaCursor {
  const tokens: SqliteSourceToken[] = []
  for (const token of prepared.tokens) {
    if (token.name !== 'SPACE' && token.name !== 'COMMENT') tokens.push(token)
  }
  return { prepared, tokens, index: 0 }
}

// Keep every schema policy rejection on an original source fragment and UTF-16 location.
export function rejectSchema(cursor: SchemaCursor, message: string, range?: SqliteRange): never {
  const location = range ?? cursor.tokens[cursor.index]?.native.span ?? {
    offset: cursor.prepared.buffer.source.length, length: 0,
  }
  throw new Error(sqliteFailure(cursor.prepared.buffer, 'unsupported-expression', message, location).error.message)
}

// Compare an intact unquoted word without accepting quoted keyword lookalikes.
export function atWord(cursor: SchemaCursor, word: string): boolean {
  const token = cursor.tokens[cursor.index]
  return !!token && asciiLower(token.fragment) === asciiLower(word)
}

// Require punctuation by its native token identity rather than source splitting.
export function takeSymbol(cursor: SchemaCursor, name: string): void {
  if (cursor.tokens[cursor.index]?.name !== name) {
    rejectSchema(cursor, `Expected ${JSON.stringify(punctuation[name] ?? name)} in the supported SQLite CREATE TABLE grammar.`)
  }
  cursor.index += 1
}

// Account for each clause word in source order alongside its native AST.
export function takeWord(cursor: SchemaCursor, word: string): void {
  if (!atWord(cursor, word)) rejectSchema(cursor, `Expected unquoted ${word} in the supported SQLite schema subset.`)
  cursor.index += 1
}

// Require the AST's local start rather than compound spans that can include prior declarations.
export function requireStart(cursor: SchemaCursor, range: SqliteRange): void {
  if (cursor.tokens[cursor.index]?.native.span.offset !== range.offset) {
    rejectSchema(cursor, 'Unaccounted, repeated, or displaced SQLite schema syntax.', cursor.tokens[cursor.index]?.native.span ?? range)
  }
}

// Validate native decoded names, applying visual representability only to suggested segments.
export function takeName(cursor: SchemaCursor, name: Name | Id, suggested = false): string {
  requireStart(cursor, name.span)
  const decoded = name.type === 'Name' ? name.text : name.name
  const error = validateSqliteIdentifier(cursor.prepared, name.span, decoded, 'unsupported-value', true)
  if (error) throw new Error(error.error.message)
  if (suggested) {
    try {
      quoteSqliteIdentifierSegments([decoded])
    } catch (error) {
      rejectSchema(cursor, error instanceof Error ? error.message : 'Unrepresentable SQLite suggestion identifier.', name.span)
    }
  }
  cursor.index += 1
  return decoded
}

// Consume only the exact range of an already recursively validated native expression.
export function takeExpressionSpan(cursor: SchemaCursor, range: SqliteRange): void {
  requireStart(cursor, range)
  const end = range.offset + range.length
  let last: SqliteSourceToken | undefined
  while (cursor.tokens[cursor.index] && cursor.tokens[cursor.index]!.native.span.offset < end) {
    last = cursor.tokens[cursor.index]
    if (!last || last.native.span.offset + last.native.span.length > end) {
      rejectSchema(cursor, 'SQLite expression does not end at an intact token boundary.', range)
    }
    cursor.index += 1
  }
  if (!last || last.native.span.offset + last.native.span.length !== end) {
    rejectSchema(cursor, 'SQLite expression has no complete native source range.', range)
  }
}

// Restrict schema collations while retaining the parser's dequoted source spelling.
export function takeCollationName(cursor: SchemaCursor, name: Name): void {
  const decoded = takeName(cursor, name)
  if (!['binary', 'nocase', 'rtrim'].includes(asciiLower(decoded))) {
    rejectSchema(cursor, 'Only BINARY, NOCASE, and RTRIM collations are supported.', name.span)
  }
}
