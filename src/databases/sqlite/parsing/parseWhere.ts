import type { Expr } from 'sqlite3-parser/sqlite-3.53.0'
import { excludeSqliteRanges, sqliteExpressionRecord } from './expression'
import { parseSqliteProgram, parseSqliteStatement, prepareSqliteSource } from './library'
import { mapSqliteRange, sqliteFailure, wrapSqliteSource } from './source'
import type {
  SqliteFilterSyntax, SqliteParseFailure, SqliteParseResult, SqlitePreparedSource,
  SqliteRange, SqliteSourceBuffer, SqliteSourceToken, SqliteStatement,
} from './types'

const PREFIX = 'SELECT 1 WHERE (\n'
const SUFFIX = '\n)'

// Ignore trivia only after the complete native stream has passed lexical validation.
function significantTokens(prepared: SqlitePreparedSource): SqliteSourceToken[] {
  const tokens: SqliteSourceToken[] = []
  for (const token of prepared.tokens) {
    if (token.name !== 'SPACE' && token.name !== 'COMMENT') tokens.push(token)
  }
  return tokens
}

// Mask only validated WHERE/terminator spans with equal-width private ASCII spaces.
function expressionBuffer(prepared: SqlitePreparedSource, boundaries: readonly SqliteSourceToken[]): SqliteSourceBuffer {
  let source = ''
  let start = 0
  for (const token of boundaries) {
    const span = token.native.span
    source += prepared.buffer.source.slice(start, span.offset) + ' '.repeat(span.length)
    start = span.offset + span.length
  }
  source += prepared.buffer.source.slice(start)
  return { ...prepared.buffer, source }
}

// Check the fixed wrapper's entire structure so successful reparsing cannot escape the filter.
function wrapperExpression(statement: SqliteStatement, length: number): Expr | null {
  const root = statement.root
  if (statement.tail !== statement.prepared.buffer.source.length || root.type !== 'SelectStmt' || root.body.type !== 'Select') return null
  const body = root.body
  if (body.with !== undefined || body.compounds !== undefined || body.orderBy !== undefined || body.limit !== undefined || body.select.type !== 'SelectFrom') return null
  const select = body.select
  if (select.distinctness !== undefined || select.from !== undefined || select.groupBy !== undefined ||
      select.having !== undefined || select.windowClause !== undefined || select.columns.length !== 1) return null
  const column = select.columns[0]
  if (column?.type !== 'ExprResultColumn' || column.alias !== undefined ||
      column.expr.type !== 'NumericLiteral' || column.expr.value !== '1' ||
      column.expr.span.offset !== 7 || column.expr.span.length !== 1) return null
  const where = select.whereClause
  const opening = PREFIX.length - 2
  const closing = PREFIX.length + length + SUFFIX.length - 1
  if (where?.type !== 'ParenthesizedExpr' || where.exprs.length !== 1 ||
      where.span.offset !== opening || where.span.offset + where.span.length !== closing + 1) return null
  const child = where.exprs[0]
  if (!child || child.span.length <= 0 || child.span.offset < PREFIX.length ||
      child.span.offset + child.span.length > PREFIX.length + length) return null
  // Verify the delimiting native tokens at the synthetic locations, rather than source spelling alone.
  let hasOpening = false
  let hasClosing = false
  for (const token of statement.prepared.tokens) {
    if (token.native.span.offset === opening && token.native.span.length === 1 && token.name === 'LP' && token.fragment === '(') hasOpening = true
    if (token.native.span.offset === closing && token.native.span.length === 1 && token.name === 'RP' && token.fragment === ')') hasClosing = true
  }
  return hasOpening && hasClosing ? child : null
}

// Recognize failed statement/clause submissions diagnostically without granting filter acceptance.
function filterFailure(
  original: SqlitePreparedSource, expression: SqlitePreparedSource, failed: SqliteParseFailure,
): SqliteParseFailure {
  if (failed.error.compatibility) return failed
  // Diagnostic program parsing uses the same complete-original and derived-buffer guard.
  const diagnostic = parseSqliteProgram(expression.buffer)
  if (!diagnostic.success && diagnostic.error.compatibility) return diagnostic
  if (diagnostic.success && diagnostic.value.root.cmds.length > 0) {
    return sqliteFailure(original.buffer, 'unsupported-expression', 'Expected one SQLite filter expression; complete SQL statements are not supported.', { offset: 0, length: original.buffer.source.length })
  }
  const tokens = significantTokens(original)
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token || failed.error.synthetic || token.originalSpan.offset !== failed.error.span.offset) continue
    const pairedClause = (token.name === 'ORDER' || token.name === 'GROUP') && tokens[index + 1]?.name === 'BY'
    if (pairedClause || ['FROM', 'LIMIT', 'HAVING', 'WINDOW', 'UNION', 'INTERSECT', 'EXCEPT', 'RETURNING'].includes(token.name)) {
      return sqliteFailure(original.buffer, 'unsupported-expression', 'Additional SELECT clauses are outside a single SQLite filter expression.', token.native.span)
    }
  }
  return failed
}

// Validate one complete filter for later import, Raw validation/conversion, and Raw revalidation.
export function parseSqliteWhere(input: string | SqliteSourceBuffer): SqliteParseResult<SqliteFilterSyntax> {
  const original = prepareSqliteSource(input)
  if (!original.success) return original
  const prepared = original.value
  try {
    const tokens = significantTokens(prepared)
    if (!tokens.length) {
      return { success: true, value: { original: prepared, expressionBuffer: prepared, wrapper: null, boundaries: {}, expression: null } }
    }
    let semicolon: SqliteSourceToken | undefined
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index]
      if (token?.name !== 'SEMI') continue
      if (semicolon || index !== tokens.length - 1) {
        return sqliteFailure(prepared.buffer, 'unsupported-expression', 'Only one final semicolon is permitted; additional statements are not supported.', token.native.span)
      }
      semicolon = token
    }
    const first = tokens[0]
    const where = first?.name === 'WHERE' ? first : undefined
    if (tokens.length - (where ? 1 : 0) - (semicolon ? 1 : 0) === 0) {
      return sqliteFailure(prepared.buffer, 'syntax', 'A SQLite filter expression is required.', first?.native.span ?? { offset: 0, length: 0 })
    }
    const boundaryTokens: SqliteSourceToken[] = []
    if (where) boundaryTokens.push(where)
    if (semicolon) boundaryTokens.push(semicolon)
    const boundaries: { where?: SqliteRange; semicolon?: SqliteRange } = {}
    if (where) boundaries.where = { offset: where.originalSpan.offset, length: where.originalSpan.length }
    if (semicolon) boundaries.semicolon = { offset: semicolon.originalSpan.offset, length: semicolon.originalSpan.length }
    const expression = prepareSqliteSource(expressionBuffer(prepared, boundaryTokens))
    if (!expression.success) return expression
    const wrapper = parseSqliteStatement(wrapSqliteSource(expression.value.buffer, PREFIX, SUFFIX))
    if (!wrapper.success) return filterFailure(prepared, expression.value, wrapper)
    const native = wrapperExpression(wrapper.value, expression.value.buffer.source.length)
    if (!native) {
      return sqliteFailure(prepared.buffer, 'unsupported-expression', 'The SQLite filter must remain entirely inside one expression; appended clauses and wrapper escapes are not supported.', { offset: 0, length: prepared.buffer.source.length })
    }
    const envelope = mapSqliteRange(prepared.buffer, { offset: 0, length: prepared.buffer.source.length })
    if (envelope.synthetic) {
      return sqliteFailure(prepared.buffer, 'syntax', 'A filter must originate in submitted source rather than synthetic statement syntax.', { offset: 0, length: prepared.buffer.source.length })
    }
    const excluded: SqliteRange[] = []
    if (boundaries.where) excluded.push(boundaries.where)
    if (boundaries.semicolon) excluded.push(boundaries.semicolon)
    const ranges = excludeSqliteRanges([envelope.span], excluded)
    return { success: true, value: {
      original: prepared, expressionBuffer: expression.value, wrapper: wrapper.value, boundaries,
      expression: sqliteExpressionRecord(wrapper.value.prepared, native, ranges),
    } }
  } catch (error) {
    return sqliteFailure(prepared.buffer, 'syntax', error instanceof Error ? error.message : 'SQLite filter parsing failed.', { offset: 0, length: prepared.buffer.source.length })
  }
}
