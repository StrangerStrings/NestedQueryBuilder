import type { Expr, Id, Name, Operator, UnaryOperator } from 'sqlite3-parser/sqlite-3.53.0'
import { assertSqliteUnicode } from '../unicode'
import { mapSqliteRange, sqliteFailure } from './source'
import type {
  SqliteExpressionRecord, SqliteFilterSyntax, SqliteParseError, SqliteParseFailure,
  SqliteParseResult, SqlitePreparedSource, SqliteRange, SqliteSourceToken,
} from './types'

/** Policy success retains the guarded syntax and the buffer used by native AST offsets. */
export type SqliteValidatedExpression = {
  readonly syntax: SqliteFilterSyntax
  readonly prepared: SqlitePreparedSource
  readonly expression: SqliteExpressionRecord
  readonly source: string
}

type ExpressionContext = 'filter' | 'default' | 'check'

const binaryOperators = new Set<Operator>([
  'Equals', 'NotEquals', 'Less', 'LessEquals', 'Greater', 'GreaterEquals', 'Is', 'IsNot',
  'And', 'Or', 'Add', 'Subtract', 'Multiply', 'Divide', 'Modulus', 'Concat',
  'BitwiseAnd', 'BitwiseOr', 'LeftShift', 'RightShift',
])
const unaryOperators = new Set<UnaryOperator>(['Positive', 'Negative', 'BitwiseNot', 'Not'])
const functionMaxArgs = new Map<string, number>([
  ['lower', 1], ['upper', 1], ['length', 1], ['abs', 1],
  ['trim', 2], ['ltrim', 2], ['rtrim', 2], ['round', 2],
])
const collations = new Set(['binary', 'nocase', 'rtrim'])

// Compare built-in names using SQLite's ASCII case rules without changing preserved source.
export function asciiLower(value: string): string {
  let result = ''
  for (const character of value) {
    const code = character.charCodeAt(0)
    result += code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : character
  }
  return result
}

// Select intact significant tokens in submitted coordinates, retaining native spans for errors.
function sourceTokens(prepared: SqlitePreparedSource, range: SqliteRange): SqliteSourceToken[] {
  const mapped = mapSqliteRange(prepared.buffer, range)
  if (mapped.synthetic) throw new Error('SQLite policy spans cannot include synthetic parser syntax.')
  const tokens: SqliteSourceToken[] = []
  for (const token of prepared.tokens) {
    if (token.synthetic || token.name === 'SPACE' || token.name === 'COMMENT') continue
    if (token.originalSpan.offset >= mapped.span.offset &&
        token.originalSpan.offset + token.originalSpan.length <= mapped.span.offset + mapped.span.length) {
      tokens.push(token)
    }
  }
  return tokens
}

// Keep diagnostics on the complete native operator or clause rather than surrounding operands.
function tokenRange(tokens: readonly SqliteSourceToken[], fallback: SqliteRange): SqliteRange {
  const first = tokens[0]
  const last = tokens[tokens.length - 1]
  return first && last
    ? { offset: first.native.span.offset, length: last.native.span.offset + last.native.span.length - first.native.span.offset }
    : fallback
}

// Locate only the operator gap between native operands, including any intervening comments.
function operandGap(left: Expr, right: Expr): SqliteRange {
  const offset = left.span.offset + left.span.length
  return { offset, length: right.span.offset - offset }
}

// Map policy errors through the prepared parser buffer rather than assuming a wrapper offset.
function policyFailure(
  prepared: SqlitePreparedSource, kind: SqliteParseError['kind'], message: string, range: SqliteRange,
): SqliteParseFailure {
  return sqliteFailure(prepared.buffer, kind, message, range)
}

// Admit strict quoting and Unicode, retaining the existing filter-name restrictions by default.
export function validateSqliteIdentifier(
  prepared: SqlitePreparedSource, range: SqliteRange, decoded: string,
  kind: SqliteParseError['kind'] = 'unsupported-value', schemaName = false,
): SqliteParseFailure | null {
  const tokens = sourceTokens(prepared, range)
  const token = tokens[0]
  if (tokens.length !== 1 || !token || token.native.span.offset !== range.offset || token.native.span.length !== range.length) {
    return policyFailure(prepared, 'syntax', 'SQLite identifier has no intact source token.', range)
  }
  if (token.fragment.startsWith("'")) {
    return policyFailure(prepared, kind, 'Single-quoted identifier fallback is outside the supported SQLite subset.', range)
  }
  if (!schemaName && (!decoded || decoded === '*')) {
    return policyFailure(prepared, kind, 'SQLite identifier segments must be nonempty and cannot be wildcards.', range)
  }
  try {
    assertSqliteUnicode(decoded, 'SQLite identifiers')
  } catch (error) {
    return policyFailure(prepared, kind, error instanceof Error ? error.message : 'Unsupported Unicode in a SQLite identifier.', range)
  }
  return null
}

// Validate decoded references without imposing suggestion-model restrictions on CHECK names.
function validateReference(prepared: SqlitePreparedSource, names: readonly (Id | Name)[], schemaName = false): SqliteParseFailure | null {
  for (const name of names) {
    const error = validateSqliteIdentifier(prepared, name.span, name.type === 'Id' ? name.name : name.text, 'unsupported-value', schemaName)
    if (error) return error
  }
  return null
}

// Require the original single-quoted token, never SQLite's legacy double-quoted-string fallback.
function validateString(prepared: SqlitePreparedSource, node: Extract<Expr, { type: 'StringLiteral' }>): SqliteParseFailure | null {
  const tokens = sourceTokens(prepared, node.span)
  const token = tokens[0]
  if (tokens.length !== 1 || !token || token.name !== 'STRING' || !/^'(?:[^']|'')*'$/.test(token.fragment)) {
    return policyFailure(prepared, 'unsupported-value', 'SQLite text literals require single quotes.', node.span)
  }
  return null
}

// Check exact numeric lexemes without rounding, evaluating, or rejecting overflow/underflow spellings.
function validateNumber(prepared: SqlitePreparedSource, node: Extract<Expr, { type: 'NumericLiteral' }>): SqliteParseFailure | null {
  const tokens = sourceTokens(prepared, node.span)
  const token = tokens[0]
  if (tokens.length !== 1 || !token || (token.name !== 'INTEGER' && token.name !== 'FLOAT')) {
    return policyFailure(prepared, 'syntax', 'SQLite numeric literal has no intact numeric token.', node.span)
  }
  if (/^0[xX]/.test(token.fragment)) {
    return /^0[xX][0-9a-fA-F]{1,16}$/.test(token.fragment)
      ? null
      : policyFailure(prepared, 'unsupported-value', 'SQLite hexadecimal integers require one to sixteen hex digits.', node.span)
  }
  return /^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(token.fragment)
    ? null
    : policyFailure(prepared, 'unsupported-value', 'This numeric spelling is outside the SQLite 3.37+ subset.', node.span)
}

// Reject newer IS spellings only in their native operator gap, including nested comparisons.
function validateIsOperator(prepared: SqlitePreparedSource, node: Extract<Expr, { type: 'BinaryExpr' }>): SqliteParseFailure | null {
  const gap = operandGap(node.left, node.right)
  const tokens = sourceTokens(prepared, gap)
  const names: string[] = []
  for (const token of tokens) names.push(token.name)
  const spelling = names.join(' ')
  if (spelling === 'IS DISTINCT FROM' || spelling === 'IS NOT DISTINCT FROM') {
    return policyFailure(prepared, 'unsupported-operator', 'DISTINCT FROM comparisons are outside the SQLite 3.37+ subset.', tokenRange(tokens, gap))
  }
  if (spelling !== (node.op === 'Is' ? 'IS' : 'IS NOT')) {
    return policyFailure(prepared, 'unsupported-operator', 'This SQLite IS comparison spelling is unsupported.', tokenRange(tokens, gap))
  }
  return null
}

// Admit one constant Unicode scalar ESCAPE, optionally enclosed in scalar parentheses.
function validateEscape(prepared: SqlitePreparedSource, node: Expr): SqliteParseFailure | null {
  let constant = node
  while (constant.type === 'ParenthesizedExpr' && constant.exprs.length === 1 && constant.exprs[0]) {
    constant = constant.exprs[0]
  }
  if (constant.type !== 'StringLiteral' || [...constant.value].length !== 1) {
    return policyFailure(prepared, 'unsupported-expression', 'LIKE ESCAPE requires a single-quoted constant containing exactly one Unicode scalar character.', node.span)
  }
  return validateString(prepared, constant)
}

// Validate every operand even when SQLite could skip it at runtime.
function validateChildren(prepared: SqlitePreparedSource, children: readonly Expr[], context: ExpressionContext): SqliteParseFailure | null {
  for (const child of children) {
    const error = validateNode(prepared, child, context)
    if (error) return error
  }
  return null
}

// Permit only the eight unqualified core calls, their approved arities, and undecorated arguments.
function validateFunction(prepared: SqlitePreparedSource, node: Extract<Expr, { type: 'FunctionCallExpr' }>, context: ExpressionContext): SqliteParseFailure | null {
  const nameError = validateSqliteIdentifier(prepared, node.name.span, node.name.name, 'unsupported-expression')
  if (nameError) return nameError
  const name = asciiLower(node.name.name)
  const maxArgs = functionMaxArgs.get(name)
  if (maxArgs === undefined) {
    return policyFailure(prepared, 'unsupported-expression', 'Only lower, upper, length, abs, trim, ltrim, rtrim, and round calls are supported.', node.name.span)
  }
  if (node.distinctness !== undefined || node.orderBy !== undefined || node.filterOver !== undefined) {
    return policyFailure(prepared, 'unsupported-expression', 'DISTINCT, ALL, argument ordering, WITHIN GROUP, FILTER, and OVER decorations are outside the supported SQLite function subset.', node.span)
  }
  const args = node.args ?? []
  if (args.length < 1 || args.length > maxArgs) {
    return policyFailure(prepared, 'unsupported-expression', `${name} requires ${maxArgs === 1 ? 'exactly one argument' : 'one or two arguments'}.`, node.span)
  }
  return validateChildren(prepared, args, context)
}

// Preserve built-in collation clauses and inspect their intact name token after the operand.
function validateCollation(prepared: SqlitePreparedSource, node: Extract<Expr, { type: 'CollateExpr' }>, context: ExpressionContext): SqliteParseFailure | null {
  const offset = node.expr.span.offset + node.expr.span.length
  const clause = { offset, length: node.span.offset + node.span.length - offset }
  const tokens = sourceTokens(prepared, clause)
  const name = tokens[1]
  if (tokens.length !== 2 || tokens[0]?.name !== 'COLLATE' || !name) {
    return policyFailure(prepared, 'syntax', 'SQLite collation clause has no intact name token.', clause)
  }
  const nameError = validateSqliteIdentifier(prepared, name.native.span, node.collation, 'unsupported-expression')
  if (nameError) return nameError
  if (!collations.has(asciiLower(node.collation))) {
    return policyFailure(prepared, 'unsupported-expression', 'Only BINARY, NOCASE, and RTRIM collations are supported.', name.native.span)
  }
  return validateNode(prepared, node.expr, context)
}

// DEFAULT permits only intact unquoted TRUE/FALSE where the grammar produces a name node.
function validateDefaultConstant(prepared: SqlitePreparedSource, node: Expr): SqliteParseFailure | null {
  const tokens = sourceTokens(prepared, node.span)
  const token = tokens[0]
  return tokens.length === 1 && token && ['true', 'false'].includes(asciiLower(token.fragment))
    ? null
    : policyFailure(prepared, 'unsupported-expression', 'DEFAULT expressions cannot reference identifiers; only unquoted TRUE/FALSE constants are supported.', node.span)
}

// Apply the approved scalar grammar recursively with context-specific schema restrictions.
function validateNode(prepared: SqlitePreparedSource, node: Expr, context: ExpressionContext = 'filter'): SqliteParseFailure | null {
  const mapped = mapSqliteRange(prepared.buffer, node.span)
  if (mapped.synthetic) {
    return policyFailure(prepared, 'syntax', 'SQLite expressions cannot include synthetic parser syntax.', node.span)
  }
  switch (node.type) {
    case 'Id':
      return context === 'default' ? validateDefaultConstant(prepared, node) : validateReference(prepared, [node], context === 'check')
    case 'QualifiedExpr':
      return context === 'filter'
        ? validateReference(prepared, node.schema ? [node.schema, node.table, node.column] : [node.table, node.column])
        : policyFailure(prepared, 'unsupported-expression', `${context === 'check' ? 'CHECK' : 'DEFAULT'} expressions cannot use qualified references.`, node.span)
    case 'NumericLiteral': {
      const error = validateNumber(prepared, node)
      if (error) return error
      return context === 'default' && /^0[xX]/.test(sourceTokens(prepared, node.span)[0]?.fragment ?? '')
        ? policyFailure(prepared, 'unsupported-value', 'Hexadecimal DEFAULT values are outside the supported SQLite schema subset.', node.span)
        : null
    }
    case 'StringLiteral':
      return validateString(prepared, node)
    case 'NullLiteral':
    case 'BlobLiteral':
      return null
    case 'CurrentDateLiteral':
    case 'CurrentTimeLiteral':
    case 'CurrentTimestampLiteral':
      return context === 'check'
        ? policyFailure(prepared, 'unsupported-expression', 'Current-time constants are outside the supported CHECK subset.', node.span)
        : null
    case 'NameExpr':
    case 'KeywordLiteral':
      return context === 'default'
        ? validateDefaultConstant(prepared, node)
        : policyFailure(prepared, 'unsupported-expression', `${node.type} is outside the supported SQLite ${context} subset. CAST, bindings, subqueries, IN-table forms, arbitrary functions, aggregates, and windows are excluded.`, node.span)
    case 'ParenthesizedExpr':
      return node.exprs.length === 1
        ? validateChildren(prepared, node.exprs, context)
        : policyFailure(prepared, 'unsupported-expression', 'Parentheses must contain one scalar expression; row values are unsupported.', node.span)
    case 'UnaryExpr':
      return unaryOperators.has(node.op)
        ? validateNode(prepared, node.expr, context)
        : policyFailure(prepared, 'unsupported-operator', 'This SQLite unary operator is unsupported.', node.span)
    case 'BinaryExpr': {
      if (!binaryOperators.has(node.op)) {
        const gap = operandGap(node.left, node.right)
        return policyFailure(prepared, 'unsupported-operator', 'JSON arrows and other unlisted operators are outside the SQLite 3.37+ subset.', tokenRange(sourceTokens(prepared, gap), gap))
      }
      if (node.op === 'Is' || node.op === 'IsNot') {
        const error = validateIsOperator(prepared, node)
        if (error) return error
      }
      return validateChildren(prepared, [node.left, node.right], context)
    }
    case 'BetweenExpr':
      return validateChildren(prepared, [node.lhs, node.start, node.end], context)
    case 'InListExpr':
      return validateChildren(prepared, [node.lhs, ...(node.rhs ?? [])], context)
    case 'LikeExpr': {
      if (node.op !== 'Like' && node.op !== 'Glob') {
        const gap = operandGap(node.lhs, node.rhs)
        return policyFailure(prepared, 'unsupported-operator', 'MATCH and REGEXP require excluded extensions or capabilities.', tokenRange(sourceTokens(prepared, gap), gap))
      }
      const error = validateChildren(prepared, [node.lhs, node.rhs], context)
      if (error || node.escape === undefined) return error
      if (node.op !== 'Like') {
        return policyFailure(prepared, 'unsupported-expression', 'ESCAPE is supported only with LIKE, not GLOB.', node.escape.span)
      }
      const escapeError = validateNode(prepared, node.escape, context)
      return escapeError ?? validateEscape(prepared, node.escape)
    }
    case 'IsNullExpr':
    case 'NotNullExpr':
      return validateNode(prepared, node.expr, context)
    case 'CollateExpr':
      return validateCollation(prepared, node, context)
    case 'FunctionCallExpr':
      return validateFunction(prepared, node, context)
    case 'CaseExpr': {
      const children: Expr[] = []
      if (node.base !== undefined) children.push(node.base)
      for (const pair of node.whenThenPairs) children.push(pair.when, pair.then)
      if (node.elseExpr !== undefined) children.push(node.elseExpr)
      return validateChildren(prepared, children, context)
    }
    default:
      return policyFailure(prepared, 'unsupported-expression', `${node.type} is outside the supported SQLite ${context} subset. CAST, bindings, subqueries, IN-table forms, arbitrary functions, aggregates, and windows are excluded.`, node.span)
  }
}

// Validate existing schema ASTs recursively, with a narrower literal-only bare DEFAULT policy.
export function validateSqliteSchemaExpression(
  prepared: SqlitePreparedSource, node: Expr, context: 'default' | 'check', bareDefault = false,
): SqliteParseFailure | null {
  if (bareDefault) {
    if (node.type === 'UnaryExpr') {
      if ((node.op !== 'Positive' && node.op !== 'Negative') || node.expr.type !== 'NumericLiteral') {
        return policyFailure(prepared, 'unsupported-expression', 'Bare DEFAULT signs require a decimal numeric literal.', node.span)
      }
    } else if (!['NumericLiteral', 'StringLiteral', 'BlobLiteral', 'NullLiteral', 'Id', 'NameExpr', 'KeywordLiteral',
      'CurrentDateLiteral', 'CurrentTimeLiteral', 'CurrentTimestampLiteral'].includes(node.type)) {
      return policyFailure(prepared, 'unsupported-expression', 'Bare DEFAULT requires a supported literal or constant.', node.span)
    }
  }
  return validateNode(prepared, node, context)
}

// Validate a complete guarded filter before Raw acceptance or any later visual/tree conversion.
export function validateSqliteExpression(syntax: SqliteFilterSyntax): SqliteParseResult<SqliteValidatedExpression> {
  try {
    const expression = syntax.expression
    if (!expression || !syntax.wrapper) {
      return sqliteFailure(syntax.original.buffer, 'syntax', 'A nonempty SQLite Raw expression is required.', { offset: 0, length: syntax.original.buffer.source.length })
    }
    const prepared = syntax.wrapper.prepared
    const error = validateNode(prepared, expression.native)
    return error ?? { success: true, value: { syntax, prepared, expression, source: expression.source } }
  } catch (error) {
    return sqliteFailure(syntax.original.buffer, 'unsupported-expression', error instanceof Error ? `SQLite expression policy validation failed: ${error.message}` : 'SQLite expression policy validation failed.', { offset: 0, length: syntax.original.buffer.source.length })
  }
}
