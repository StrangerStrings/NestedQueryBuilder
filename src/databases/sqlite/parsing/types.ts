import type { CmdList, Expr, Span, Stmt, Token, TokenizeCursor } from 'sqlite3-parser/sqlite-3.53.0'
import type { FilterImportResult } from '../../../types/databaseAdapter'

/** Half-open source ranges use UTF-16 units, just like String.slice. */
export type SqliteRange = { readonly offset: number; readonly length: number }
export type SqliteSourceRegion = SqliteRange & {
  readonly originalOffset: number
  readonly synthetic: boolean
}
export type SqliteSourceBuffer = {
  readonly source: string
  readonly original: string
  readonly regions: readonly SqliteSourceRegion[]
}
export type SqliteMappedSpan = { readonly span: Span; readonly synthetic: boolean }
export type SqliteSourceToken = {
  readonly native: Token
  readonly name: string
  readonly fragment: string
  readonly originalSpan: Span
  readonly synthetic: boolean
}
export type SqlitePreparedSource = {
  readonly buffer: SqliteSourceBuffer
  readonly tokens: readonly SqliteSourceToken[]
  readonly originalTokens: readonly SqliteSourceToken[]
  readonly cursor: TokenizeCursor
}
export type SqliteCompatibility = 'U+FEFF' | 'U+00EF U+00BB U+00BF'
export type SqliteParseError = Extract<FilterImportResult, { success: false }>['error'] & {
  readonly span: Span
  readonly synthetic: boolean
  readonly compatibility?: SqliteCompatibility
}
export type SqliteParseFailure = { success: false; error: SqliteParseError }
export type SqliteParseResult<T> = { success: true; value: T } | SqliteParseFailure
export type SqliteProgram = { readonly prepared: SqlitePreparedSource; readonly root: CmdList }
export type SqliteStatement = {
  readonly prepared: SqlitePreparedSource
  readonly root: Stmt
  readonly tail: number
}

/** Native grammar and preserved envelopes remain separate from later Raw eligibility. */
export type SqliteExpressionRecord = {
  readonly native: Expr
  readonly semanticSpan: Span
  readonly ranges: readonly SqliteRange[]
  readonly source: string
  readonly tokens: readonly SqliteSourceToken[]
} & (
  | { readonly kind: 'leaf' }
  | { readonly kind: 'logical'; readonly mode: 'all' | 'any'; readonly children: readonly SqliteExpressionRecord[] }
  | { readonly kind: 'not'; readonly child: SqliteExpressionRecord }
)
/** Syntax success never authorizes Raw fallback or skips the later recursive subset policy. */
export type SqliteFilterSyntax = {
  readonly original: SqlitePreparedSource
  readonly expressionBuffer: SqlitePreparedSource
  readonly wrapper: SqliteStatement | null
  readonly boundaries: { readonly where?: SqliteRange; readonly semicolon?: SqliteRange }
  readonly expression: SqliteExpressionRecord | null
}
