import { MySQL } from 'dt-sql-parser/dist/parser/mysql'
import { MySqlLexer } from 'dt-sql-parser/dist/lib/mysql/MySqlLexer'
import { ExpressionContext } from 'dt-sql-parser/dist/lib/mysql/MySqlParser'
import type { CharStream, Token, ParseTree } from 'antlr4ng'

export type SqlFilterExpression = {
  source: string
  tokens: SqlFilterToken[]
} & (
  | { kind: 'leaf' }
  | { kind: 'logical'; mode: 'all' | 'any'; children: SqlFilterExpression[] }
  | { kind: 'not'; child: SqlFilterExpression }
)
export type SqlFilterToken = { text: string; type: number; start: number; stop: number }
export type SqlFilterParseResult =
  | { success: true; expression: SqlFilterExpression | null }
  | { success: false; error: string; kind?: 'syntax' | 'unsupported-expression' }

// Recognize temporal literals and constant ESCAPE strings without changing SQL source text.
class FilterLexer extends MySqlLexer {
  private escapeLiteral = false
  private pending: Token[] = []

  // Extend grammar literal categories while retaining every consumed token's original source range.
  override nextToken(): Token {
    const token = this.pending.shift() ?? super.nextToken()
    // Treat SQL-standard typed temporal literals as one grammar literal, keeping original ranges.
    if ([MySqlLexer.KW_DATE, MySqlLexer.KW_TIME, MySqlLexer.KW_TIMESTAMP].includes(token.type)) {
      const lookahead: Token[] = []
      let next = super.nextToken()
      while (next.channel !== 0 && next.type !== -1) { lookahead.push(next); next = super.nextToken() }
      if (next.type === MySqlLexer.STRING_LITERAL) {
        token.type = MySqlLexer.STRING_LITERAL
        token.stop = next.stop
      } else this.pending.push(...lookahead, next)
    }
    if (token.channel !== 0) return token
    if (this.escapeLiteral && token.type === MySqlLexer.STRING_CHARSET_NAME) {
      token.channel = 1
      return token
    }
    if (this.escapeLiteral && token.type === MySqlLexer.HEXADECIMAL_LITERAL) {
      token.type = MySqlLexer.STRING_LITERAL
    }
    this.escapeLiteral = token.type === MySqlLexer.KW_ESCAPE
    return token
  }
}

// Keep the common grammar and lexical extensions inside the database parsing implementation.
class FilterParser extends MySQL {
  // Create a fresh lexer so parser caching cannot retain escape state across imports.
  protected override createLexerFromCharStream(stream: CharStream): MySqlLexer {
    return new FilterLexer(stream)
  }
}

const parser = new FilterParser()

// Find expression contexts without exposing parser-specific trees to the shared store or adapter UI.
function findExpressions(tree: ParseTree): ExpressionContext[] {
  if (tree instanceof ExpressionContext) return [tree]
  const expressions: ExpressionContext[] = []
  for (let index = 0; index < tree.getChildCount(); index += 1) {
    const child = tree.getChild(index)
    if (child) expressions.push(...findExpressions(child))
  }
  return expressions
}

// Apply MySQL's NOT > AND > OR precedence to grammar-validated tokens, preserving explicit parentheses.
function convertTokens(tokens: SqlFilterToken[], source: string[]): SqlFilterExpression {
  const first = tokens[0]
  const last = tokens[tokens.length - 1]
  if (!first || !last) throw new Error('A filter expression is required.')
  let depth = 0
  let between = false
  let caseDepth = 0
  let ambiguousBetween = false
  const logical: { index: number; operator: string }[] = []
  let outerEnd = -1
  for (const [index, token] of tokens.entries()) {
    const operator = token.text.toUpperCase()
    // Reserved words after a qualification dot are identifier segments, not logical operators.
    if (tokens[index - 1]?.text === '.' || tokens[index + 1]?.text === '.') continue
    if (operator === '(') depth += 1
    else if (operator === ')') { depth -= 1; if (depth === 0 && outerEnd === -1) outerEnd = index }
    else if (operator === 'CASE') caseDepth += 1
    else if (operator === 'END' && caseDepth > 0) caseDepth -= 1
    else if (depth === 0 && caseDepth === 0) {
      if (operator === 'BETWEEN') between = true
      else if (operator === 'AND' && between) between = false
      else if (['AND', 'OR', 'XOR', '&&', '||'].includes(operator)) {
        if (between) ambiguousBetween = true
        logical.push({ index, operator })
      }
    }
  }
  if (first.text === '(' && outerEnd === tokens.length - 1) return convertTokens(tokens.slice(1, -1), source)
  const base = { source: source.slice(first.start, last.stop + 1).join(''), tokens }
  if (ambiguousBetween || tokens.some((token) => token.text === ':=')) return { ...base, kind: 'leaf' }
  const split = logical.some((entry) => entry.operator === 'OR') ? 'OR'
    : logical.some((entry) => entry.operator === 'XOR' || entry.operator === '||') ? null : 'AND'
  const boundaries = logical.filter((entry) => entry.operator === split || (split === 'AND' && entry.operator === '&&'))
  if (boundaries.length) {
    const children: SqlFilterExpression[] = []
    let start = 0
    for (const boundary of boundaries) {
      children.push(convertTokens(tokens.slice(start, boundary.index), source))
      start = boundary.index + 1
    }
    children.push(convertTokens(tokens.slice(start), source))
    return { ...base, kind: 'logical', mode: split === 'OR' ? 'any' : 'all', children }
  }
  if (!logical.length && first.text.toUpperCase() === 'NOT') {
    return { ...base, kind: 'not', child: convertTokens(tokens.slice(1), source) }
  }
  return { ...base, kind: 'leaf' }
}

// Validate the common filter grammar; MariaDB callers must additionally validate their syntax subset.
export function parseMysqlMariaDbWhere(filter: string, database: 'MySQL' | 'MariaDB'): SqlFilterParseResult {
  const trimmed = filter.trim()
  if (!trimmed) return { success: true, expression: null }
  const condition = /^WHERE\b/i.test(trimmed) ? trimmed.slice(5).trim() : trimmed
  const source = `SELECT 1 WHERE ${condition}`
  try {
    const errors = parser.validate(source)
    if (errors.length) return { success: false, error: errors[0]?.message ?? `Invalid ${database} filter syntax.` }
    // Conversion uses original lexical categories, including introducers hidden by the grammar extension.
    const lexer = new MySQL().createLexer(source)
    lexer.removeErrorListeners()
    const allTokens = lexer.getAllTokens()
    if (allTokens.some((token) =>
      token.type === MySqlLexer.SPEC_MYSQL_COMMENT || /^\/\*[!+]/.test(token.text ?? '') ||
      (database === 'MariaDB' && /^\/\*M!/i.test(token.text ?? '')),
    )) {
      return { success: false, error: 'Executable comments and optimizer hints are not supported in filters.' }
    }
    const tokens = allTokens.filter((token) => token.channel === 0 && token.type !== -1)
      .map((token) => ({ text: token.text ?? '', type: token.type, start: token.start, stop: token.stop }))
    const expressions = findExpressions(parser.parse(source))
    // SELECT 1 contributes the first expression; WHERE must be the only remaining top-level expression.
    const expression = expressions[1]
    if (expressions.length !== 2 || !expression || expression.start?.start !== tokens[3]?.start) {
      return { success: false, error: `Expected a single ${database} WHERE filter expression.` }
    }
    const tail = tokens.filter((token) => token.start > (expression.stop?.stop ?? 0))
    if (tail.length > 1 || (tail.length === 1 && tail[0]?.text !== ';')) {
      return { success: false, error: 'Additional statements or SELECT clauses are not supported.' }
    }
    const conversionTokens = allTokens.filter((token) => (token.channel === 0 || token.type === MySqlLexer.STRING_CHARSET_NAME) && token.type !== -1)
      .map((token) => ({ text: token.text ?? '', type: token.type, start: token.start, stop: token.stop }))
    const filterTokens = conversionTokens.filter((token) =>
      token.start >= (expression.start?.start ?? 0) && token.stop <= (expression.stop?.stop ?? 0),
    )
    return { success: true, expression: convertTokens(filterTokens, Array.from(source)) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : `Invalid ${database} filter syntax.` }
  }
}
