import type { Expr } from 'sqlite3-parser/sqlite-3.53.0'
import { mapSqliteRange } from './source'
import type { SqliteExpressionRecord, SqlitePreparedSource, SqliteRange, SqliteSourceToken } from './types'

// Remove only known syntax delimiters/boundaries, retaining every other original source unit.
export function excludeSqliteRanges(ranges: readonly SqliteRange[], excluded: readonly SqliteRange[]): SqliteRange[] {
  let remaining = [...ranges]
  for (const boundary of excluded) {
    const next: SqliteRange[] = []
    const boundaryEnd = boundary.offset + boundary.length
    for (const range of remaining) {
      const end = range.offset + range.length
      if (boundary.offset >= end || boundaryEnd <= range.offset) { next.push(range); continue }
      if (boundary.offset > range.offset) next.push({ offset: range.offset, length: boundary.offset - range.offset })
      if (boundaryEnd < end) next.push({ offset: boundaryEnd, length: end - boundaryEnd })
    }
    remaining = next
  }
  return remaining
}

// Split envelopes at a validated native logical operator without moving adjacent trivia.
function intersectRanges(ranges: readonly SqliteRange[], start: number, end: number): SqliteRange[] {
  const result: SqliteRange[] = []
  for (const range of ranges) {
    const from = Math.max(start, range.offset)
    const to = Math.min(end, range.offset + range.length)
    if (to > from) result.push({ offset: from, length: to - from })
  }
  return result
}

// Read preserved envelope slices without AST serialization or numeric conversion.
function envelopeSource(source: string, ranges: readonly SqliteRange[]): string {
  let result = ''
  for (const range of ranges) result += source.slice(range.offset, range.offset + range.length)
  return result
}

// Collect intact original tokens belonging to an envelope, including ordinary comments.
function envelopeTokens(tokens: readonly SqliteSourceToken[], ranges: readonly SqliteRange[]): SqliteSourceToken[] {
  const result: SqliteSourceToken[] = []
  for (const token of tokens) {
    for (const range of ranges) {
      if (token.originalSpan.offset >= range.offset &&
          token.originalSpan.offset + token.originalSpan.length <= range.offset + range.length) {
        result.push(token)
        break
      }
    }
  }
  return result
}

// Find only the native logical operator between native operand spans.
function logicalToken(prepared: SqlitePreparedSource, name: string, start: number, end: number): SqliteSourceToken {
  let operator: SqliteSourceToken | undefined
  for (const token of prepared.originalTokens) {
    if (token.originalSpan.offset < start || token.originalSpan.offset + token.originalSpan.length > end ||
        token.name === 'SPACE' || token.name === 'COMMENT') continue
    if (token.name !== name || operator) throw new Error('SQLite logical operator spans do not match their source tokens.')
    operator = token
  }
  if (!operator) throw new Error('SQLite logical operator has no preserved source token.')
  return operator
}

// Derive logical structure exclusively from native AST nodes and preserve comment envelopes.
export function sqliteExpressionRecord(
  prepared: SqlitePreparedSource, native: Expr, ranges: readonly SqliteRange[],
): SqliteExpressionRecord {
  const mapped = mapSqliteRange(prepared.buffer, native.span)
  if (mapped.synthetic) throw new Error('SQLite expression extends into synthetic parser syntax.')
  const base = {
    native, semanticSpan: mapped.span, ranges, source: envelopeSource(prepared.buffer.original, ranges),
    tokens: envelopeTokens(prepared.originalTokens, ranges),
  }
  if (native.type === 'ParenthesizedExpr' && native.exprs.length === 1 && native.exprs[0]) {
    const innerRanges = excludeSqliteRanges(ranges, [
      { offset: mapped.span.offset, length: 1 },
      { offset: mapped.span.offset + mapped.span.length - 1, length: 1 },
    ])
    const inner = sqliteExpressionRecord(prepared, native.exprs[0], innerRanges)
    if (inner.kind === 'logical') return { ...base, kind: 'logical', mode: inner.mode, children: inner.children }
    if (inner.kind === 'not') return { ...base, kind: 'not', child: inner.child }
    return { ...base, kind: 'leaf' }
  }
  if (native.type === 'BinaryExpr' && (native.op === 'And' || native.op === 'Or')) {
    const left = mapSqliteRange(prepared.buffer, native.left.span).span
    const right = mapSqliteRange(prepared.buffer, native.right.span).span
    const operator = logicalToken(prepared, native.op === 'And' ? 'AND' : 'OR', left.offset + left.length, right.offset)
    return { ...base, kind: 'logical', mode: native.op === 'And' ? 'all' : 'any', children: [
      sqliteExpressionRecord(prepared, native.left, intersectRanges(ranges, 0, operator.originalSpan.offset)),
      sqliteExpressionRecord(prepared, native.right, intersectRanges(ranges, operator.originalSpan.offset + operator.originalSpan.length, prepared.buffer.original.length)),
    ] }
  }
  if (native.type === 'UnaryExpr' && native.op === 'Not') {
    const operand = mapSqliteRange(prepared.buffer, native.expr.span).span
    const operator = logicalToken(prepared, 'NOT', mapped.span.offset, operand.offset)
    return { ...base, kind: 'not', child: sqliteExpressionRecord(prepared, native.expr, excludeSqliteRanges(ranges, [operator.originalSpan])) }
  }
  return { ...base, kind: 'leaf' }
}
