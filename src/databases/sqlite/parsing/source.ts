import type { ParserModule, Span } from 'sqlite3-parser/sqlite-3.53.0'
import { assertSqliteUnicode } from '../unicode'
import type {
  SqliteCompatibility, SqliteMappedSpan, SqliteParseError, SqliteParseFailure,
  SqliteParseResult, SqlitePreparedSource, SqliteRange, SqliteSourceBuffer,
  SqliteSourceRegion, SqliteSourceToken,
} from './types'

// Bind an untouched submission to its original UTF-16 coordinates.
export function sqliteSource(source: string): SqliteSourceBuffer {
  return { source, original: source, regions: [{ offset: 0, length: source.length, originalOffset: 0, synthetic: false }] }
}

// Reject out-of-bounds ranges before slicing or mapping a buffer.
function assertRange(range: SqliteRange, length: number): void {
  if (!Number.isInteger(range.offset) || !Number.isInteger(range.length) ||
      range.offset < 0 || range.length < 0 || range.offset + range.length > length) {
    throw new Error('SQLite source range is outside its UTF-16 buffer.')
  }
}

// Require a contiguous, bounded source map with explicit synthetic regions.
function assertSourceMap(buffer: SqliteSourceBuffer): void {
  let end = 0
  for (const region of buffer.regions) {
    assertRange(region, buffer.source.length)
    assertRange({ offset: region.originalOffset, length: region.synthetic ? 0 : region.length }, buffer.original.length)
    if (region.offset !== end) throw new Error('SQLite source mapping must cover the complete buffer.')
    end += region.length
  }
  if (!buffer.regions.length || end !== buffer.source.length) {
    throw new Error('SQLite source mapping must cover the complete buffer.')
  }
}

// Recompute original line/column locations without code-point indexing.
function originalSpan(source: string, range: SqliteRange): Span {
  assertRange(range, source.length)
  let line = 1
  let col = 0
  for (let index = 0; index < range.offset; index += 1) {
    if (source.charCodeAt(index) === 10) { line += 1; col = 0 }
    else col += 1
  }
  return { ...range, line, col }
}

// Map real intervals and synthetic boundary anchors into the original submission.
export function mapSqliteRange(buffer: SqliteSourceBuffer, range: SqliteRange): SqliteMappedSpan {
  assertSourceMap(buffer)
  assertRange(range, buffer.source.length)
  const end = range.offset + range.length
  let first: number | undefined
  let last = 0
  let synthetic = false
  for (const region of buffer.regions) {
    const regionEnd = region.offset + region.length
    const start = Math.max(range.offset, region.offset)
    const stop = Math.min(end, regionEnd)
    const pointInside = range.length === 0 && range.offset >= region.offset &&
      (range.offset < regionEnd || (range.offset === regionEnd && regionEnd === buffer.source.length))
    if (stop <= start && !pointInside) continue
    const mappedStart = region.originalOffset + (region.synthetic ? 0 : start - region.offset)
    const mappedEnd = region.synthetic ? mappedStart : region.originalOffset + stop - region.offset
    first = first === undefined ? mappedStart : Math.min(first, mappedStart)
    last = Math.max(last, mappedEnd)
    synthetic ||= region.synthetic
  }
  if (first === undefined) throw new Error('SQLite source range has no original mapping.')
  return { span: originalSpan(buffer.original, { offset: first, length: last - first }), synthetic }
}

// Extract an exact slice while carrying its original offsets and boundary anchors.
export function sliceSqliteSource(buffer: SqliteSourceBuffer, range: SqliteRange): SqliteSourceBuffer {
  assertSourceMap(buffer)
  assertRange(range, buffer.source.length)
  const regions: SqliteSourceRegion[] = []
  const end = range.offset + range.length
  for (const region of buffer.regions) {
    const start = Math.max(range.offset, region.offset)
    const stop = Math.min(end, region.offset + region.length)
    if (stop <= start) continue
    regions.push({
      offset: start - range.offset, length: stop - start, synthetic: region.synthetic,
      originalOffset: region.originalOffset + (region.synthetic ? 0 : start - region.offset),
    })
  }
  if (!regions.length) {
    const mapped = mapSqliteRange(buffer, { offset: range.offset, length: 0 })
    regions.push({ offset: 0, length: 0, originalOffset: mapped.span.offset, synthetic: mapped.synthetic })
  }
  return { source: buffer.source.slice(range.offset, end), original: buffer.original, regions }
}

// Add fixed parser syntax with separate prefix/interior/suffix mappings.
export function wrapSqliteSource(buffer: SqliteSourceBuffer, prefix: string, suffix: string): SqliteSourceBuffer {
  assertSourceMap(buffer)
  const start = mapSqliteRange(buffer, { offset: 0, length: 0 }).span.offset
  const end = mapSqliteRange(buffer, { offset: buffer.source.length, length: 0 }).span.offset
  const regions: SqliteSourceRegion[] = [{ offset: 0, length: prefix.length, originalOffset: start, synthetic: true }]
  for (const region of buffer.regions) regions.push({ ...region, offset: region.offset + prefix.length })
  regions.push({ offset: prefix.length + buffer.source.length, length: suffix.length, originalOffset: end, synthetic: true })
  return { source: prefix + buffer.source + suffix, original: buffer.original, regions }
}

// Retain original fragments and locations in errors compatible with filter imports.
export function sqliteFailure(
  buffer: SqliteSourceBuffer, kind: SqliteParseError['kind'], message: string,
  range: SqliteRange, compatibility?: SqliteCompatibility,
): SqliteParseFailure {
  const mapped = mapSqliteRange(buffer, range)
  const fragment = buffer.original.slice(mapped.span.offset, mapped.span.offset + mapped.span.length)
  const location = `line ${mapped.span.line}, column ${mapped.span.col + 1} (UTF-16 offset ${mapped.span.offset})`
  return { success: false, error: {
    kind, message: `${message} At ${location}${fragment ? `: ${JSON.stringify(fragment)}` : ''}.`,
    fragment, ...mapped, ...(compatibility ? { compatibility } : {}),
  } }
}

// Locate the rejected Unicode unit after the shared Unicode guard fails.
function invalidUnicodeRange(source: string): SqliteRange {
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index)
    if (code === 0 || (code >= 0xdc00 && code <= 0xdfff)) return { offset: index, length: 1 }
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = source.charCodeAt(index + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return { offset: index, length: 1 }
      index += 1
    }
  }
  return { offset: 0, length: 0 }
}

// Recognize delimiter-led identifiers from intact source slices, never dequoted text.
function quotedIdentifier(fragment: string): boolean {
  return fragment.startsWith('"') || fragment.startsWith('`') || fragment.startsWith('[')
}

// Materialize and validate the entire native stream before interpreting any token.
function preflightBuffer(
  buffer: SqliteSourceBuffer, native: Pick<ParserModule, 'tokenize' | 'tokenName'>,
): SqliteParseResult<Omit<SqlitePreparedSource, 'originalTokens'>> {
  try {
    assertSqliteUnicode(buffer.source, 'SQLite SQL')
  } catch (error) {
    return sqliteFailure(buffer, 'syntax', error instanceof Error ? error.message : 'Unsupported Unicode in SQLite SQL.', invalidUnicodeRange(buffer.source))
  }
  const stream = native.tokenize(buffer.source, { emitTrivia: true })
  const allTokens = [...stream]
  const cursor = { offset: stream.offset, line: stream.line, col: stream.col }
  const tokens: SqliteSourceToken[] = []
  let end = 0
  for (const token of allTokens) {
    assertRange(token.span, buffer.source.length)
    if (token.span.offset !== end || token.span.length === 0 || token.synthetic) {
      return sqliteFailure(buffer, 'syntax', 'SQLite tokenizer did not preserve complete source spans.', { offset: end, length: 0 })
    }
    const name = native.tokenName(token.type)
    if (!name) return sqliteFailure(buffer, 'syntax', 'SQLite tokenizer returned an unknown token.', token.span)
    const mapped = mapSqliteRange(buffer, token.span)
    tokens.push({ native: token, name, fragment: buffer.source.slice(token.span.offset, token.span.offset + token.span.length), originalSpan: mapped.span, synthetic: mapped.synthetic })
    end += token.span.length
  }
  if (cursor.offset !== buffer.source.length || end !== buffer.source.length) {
    return sqliteFailure(buffer, 'syntax', 'SQLite tokenizer did not consume the complete submission.', { offset: end, length: 0 })
  }
  for (const token of tokens) {
    if (token.name === 'SPACE' && token.fragment === '\u00ef\u00bb\u00bf') {
      return sqliteFailure(buffer, 'unsupported-value', 'SQLite parser compatibility limitation: U+00EF U+00BB U+00BF (ï»¿) is misclassified as SPACE.', token.native.span, 'U+00EF U+00BB U+00BF')
    }
    if (token.name === 'ID' && !quotedIdentifier(token.fragment) && token.fragment.startsWith('\ufeff')) {
      return sqliteFailure(buffer, 'unsupported-value', 'SQLite parser compatibility limitation: this unquoted ID begins with U+FEFF, which SQLite treats as boundary whitespace.', token.native.span, 'U+FEFF')
    }
  }
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token) continue
    const fragment = token.fragment
    if (token.name === 'ILLEGAL') {
      return sqliteFailure(buffer, 'syntax', 'Unrecognized or unterminated SQLite token.', token.native.span)
    }
    if (token.name === 'COMMENT' && fragment.startsWith('/*')) {
      if (fragment.length < 4 || !fragment.endsWith('*/')) {
        return sqliteFailure(buffer, 'syntax', 'Unterminated SQLite block comment.', token.native.span)
      }
      if (/^\/\*(?:[!+]|[mM]!)/.test(fragment)) {
        return sqliteFailure(buffer, 'unsupported-expression', 'Executable comments and optimizer hints are outside the supported SQLite subset.', token.native.span)
      }
    }
    const next = tokens[index + 1]
    if (token.name === 'SLASH' && next?.name === 'STAR' &&
        next.native.span.offset === token.native.span.offset + 1 &&
        next.native.span.offset + next.native.span.length === buffer.source.length) {
      return sqliteFailure(buffer, 'syntax', 'Unterminated SQLite block comment.', { offset: token.native.span.offset, length: 2 })
    }
    if ((token.name === 'ID' && quotedIdentifier(fragment)) || token.name === 'STRING') {
      const closing = fragment[0] === '[' ? ']' : fragment[0]
      if (fragment.length < 2 || !fragment.endsWith(closing ?? '')) {
        return sqliteFailure(buffer, 'syntax', 'Unterminated SQLite quote.', token.native.span)
      }
    }
  }
  return { success: true, value: { buffer, tokens, cursor } }
}

// Guard complete originals as well as every exact derived buffer before parsing.
export function prepareSource(
  buffer: SqliteSourceBuffer, native: Pick<ParserModule, 'tokenize' | 'tokenName'>,
): SqliteParseResult<SqlitePreparedSource> {
  try {
    assertSourceMap(buffer)
    const original = preflightBuffer(sqliteSource(buffer.original), native)
    if (!original.success) return original
    const region = buffer.regions[0]
    if (buffer.source === buffer.original && buffer.regions.length === 1 &&
        region?.originalOffset === 0 && !region.synthetic) {
      return { success: true, value: { ...original.value, buffer, originalTokens: original.value.tokens } }
    }
    const derived = preflightBuffer(buffer, native)
    return derived.success
      ? { success: true, value: { ...derived.value, originalTokens: original.value.tokens } }
      : derived
  } catch (error) {
    return sqliteFailure(sqliteSource(buffer.original), 'syntax', error instanceof Error ? error.message : 'SQLite lexical preparation failed.', { offset: 0, length: 0 })
  }
}
