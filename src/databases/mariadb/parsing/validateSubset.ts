import type { SqlFilterExpression, SqlFilterToken } from '../../shared/mysqlMariaDb/parsing/parseWhere'
import { decodeSqlString, decodeUtf8Hex } from '../../shared/mysqlMariaDb/parsing/importCondition'
import { renderScalarLiteral } from '../../shared/mysqlMariaDb/serialisation/conditionLiteral'
import { mariadbOperators } from '../operators'
import { mariadbFieldModifiers } from '../modifiers'

// Validate only documented MariaDB 11.4 syntax, independently of MySQL grammar acceptance.
class MariadbSubsetReader {
  private index = 0

  // Keep original tokens and optional schema collations local to one compatibility assessment.
  constructor(
    private tokens: SqlFilterToken[],
    private schemaArithmetic = false,
    private schemaCollations?: ReadonlySet<string>,
  ) {}

  // Inspect spelling without changing the source or decoding identifier keywords.
  private peek(): string { return this.tokens[this.index]?.text ?? '' }

  // Consume an optional keyword or punctuation token.
  private consume(expected: string): boolean {
    if (this.peek().toUpperCase() !== expected) return false
    this.index += 1
    return true
  }

  // Require a token so unsupported suffixes cannot silently disappear.
  private take(expected?: string): string {
    const text = this.peek()
    if (!text || (expected && text.toUpperCase() !== expected)) {
      throw new Error(`MariaDB 11.4 compatibility is not established here: expected ${expected ?? 'a supported operand'}.`)
    }
    this.index += 1
    return text
  }

  // Validate raw identifier segments without imposing the visual model's literal-dot restriction.
  private identifier(): void {
    const spelling = this.take()
    const quoted = spelling.startsWith('`') && spelling.endsWith('`')
    const name = quoted ? spelling.slice(1, -1).replaceAll('``', '`') : spelling
    if ((!quoted && (!/^[\p{L}\p{N}_$]+$/u.test(name) || /^0[xb]/i.test(name))) || !name || name.length > 64 || /\s$/.test(name)) {
      throw new Error('Unsupported MariaDB identifier in this filter.')
    }
    for (const character of name) {
      const point = character.codePointAt(0) ?? 0
      if (point === 0 || point > 0xffff || (point >= 0xd800 && point <= 0xdfff)) {
        throw new Error('MariaDB identifiers require valid BMP characters and cannot contain NUL.')
      }
    }
  }

  // Decode only ordinary strings or explicitly introduced UTF-8 hex text.
  private string(): string {
    const token = this.take()
    if (/^["']/.test(token)) {
      const value = decodeSqlString(token, 'MariaDB')
      renderScalarLiteral('text', value)
      return value
    }
    if (/^X'(?:[\da-f]{2})*'$/i.test(token)) {
      return decodeUtf8Hex(token)
    }
    throw new Error('Only quoted strings and UTF-8 hex text are supported in MariaDB filters.')
  }

  // Read nested scalar operands using schema collations only when explicitly supplied.
  private scalar(): string | null {
    const token = this.peek()
    const keyword = token.toUpperCase()
    let text: string | null = null
    if (this.consume('(')) {
      text = this.operand()
      this.take(')')
    } else if (keyword === 'CAST') {
      this.take(); this.take('('); this.operand(); this.take('AS')
      const target = this.take().toUpperCase()
      if (!['DATE', 'TIME', 'DATETIME'].includes(target)) {
        throw new Error(`MariaDB filter import does not establish compatibility for CAST AS ${target}.`)
      }
      this.take(')')
    } else if (['DATE', 'TIME', 'TIMESTAMP'].includes(keyword) && /^["']/.test(this.tokens[this.index + 1]?.text ?? '')) {
      this.take()
      const literal = this.string()
      const type = keyword === 'DATE' ? 'date' : keyword === 'TIME' ? 'time' : 'datetime'
      const value = type === 'datetime' ? literal.replace(' ', 'T') : literal
      if (renderScalarLiteral(type, value) === undefined) {
        throw new Error('MariaDB filter import supports only exact local temporal literals at seconds precision, with date years 1000–9999.')
      }
    } else if (this.consume('_UTF8MB4')) {
      text = this.string()
    } else if (/^["']/.test(token)) {
      text = this.string()
    } else if (['TRUE', 'FALSE', 'NULL'].includes(keyword)) {
      this.take()
    } else if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token) || token === '+' || token === '-') {
      let number = this.take()
      if (number === '+' || number === '-') number += this.take()
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(number)) {
        throw new Error('Unsupported MariaDB numeric literal.')
      }
    } else if (this.tokens[this.index + 1]?.text === '(') {
      const modifier = mariadbFieldModifiers.find((candidate) => candidate === keyword.toLowerCase())
      if (!modifier) throw new Error(`MariaDB compatibility is not established for function ${token}.`)
      if (this.tokens[this.index + 1]?.start !== (this.tokens[this.index]?.stop ?? -1) + 1) {
        throw new Error('Use no whitespace or comments between a MariaDB modifier name and its opening parenthesis; IGNORE_SPACE is not assumed.')
      }
      this.take(); this.take('('); this.operand(); this.take(')')
    } else {
      this.identifier()
      let count = 1
      while (this.consume('.')) { this.identifier(); count += 1 }
      if (count > 3) throw new Error('MariaDB field references allow at most three qualification segments.')
    }
    if (this.consume('COLLATE')) {
      const collation = this.take().toLowerCase()
      // Keep filter/Raw acceptance unchanged when no schema allowlist is supplied.
      if (!(this.schemaCollations ? this.schemaCollations.has(collation) : ['utf8mb4_bin', 'utf8mb4_general_ci'].includes(collation))) {
        throw new Error(`MariaDB 11.4 compatibility is not established for collation ${collation}.`)
      }
      text = null
    }
    return text
  }

  // Admit common arithmetic only in schema expressions; filter and raw capabilities stay unchanged.
  private operand(): string | null {
    let text = this.scalar()
    if (this.schemaArithmetic) {
      while (['+', '-', '*', '/', '%', 'DIV', 'MOD'].includes(this.peek().toUpperCase())) {
        this.take(); this.scalar()
        text = null
      }
    }
    return text
  }

  // Validate catalogue predicates and MariaDB regex aliases without changing the original SQL.
  private comparison(): void {
    this.operand()
    let operator = this.take().toUpperCase()
    if (operator === '!=') operator = '<>'
    if (operator === 'IS') {
      if (this.consume('NOT')) operator += ' NOT'
      this.take('NULL')
      operator += ' NULL'
    } else if (operator === 'NOT') {
      operator += ` ${this.take().toUpperCase()}`
    }
    if (operator === 'RLIKE') operator = 'REGEXP'
    if (operator === 'NOT RLIKE') operator = 'NOT REGEXP'
    if (!mariadbOperators.some((candidate) => candidate.id === operator)) {
      throw new Error(`MariaDB filter import does not support operator ${operator}.`)
    }
    if (operator === 'IS NULL' || operator === 'IS NOT NULL') return
    if (operator === 'IN' || operator === 'NOT IN') {
      this.take('('); this.operand()
      while (this.consume(',')) this.operand()
      this.take(')')
    } else {
      this.operand()
      if (operator === 'BETWEEN' || operator === 'NOT BETWEEN') { this.take('AND'); this.operand() }
      if ((operator === 'LIKE' || operator === 'NOT LIKE') && this.consume('ESCAPE')) {
        // The common lexer extension permits bare X'…' only in the constant ESCAPE position.
        const bareHex = /^X'/i.test(this.peek())
        if (bareHex && !/^X'[\da-f]{2}'$/i.test(this.peek())) {
          throw new Error('A bare hexadecimal MariaDB ESCAPE constant must contain exactly one byte.')
        }
        const escape = bareHex ? this.string() : this.scalar()
        if (escape === null || Array.from(escape).length !== 1) {
          throw new Error('MariaDB LIKE ESCAPE requires a constant single-character string in this supported subset.')
        }
      }
    }
  }

  // Distinguish scalar parentheses from complete logical groups without rewriting source SQL.
  private predicate(): void {
    const start = this.index
    try { this.comparison(); return } catch (error) {
      this.index = start
      if (!this.consume('(')) throw error
    }
    this.expression(); this.take(')')
  }

  // Apply NOT to a complete predicate with the documented default precedence.
  private negation(): void {
    if (this.consume('NOT')) this.negation()
    else this.predicate()
  }

  // Consume AND before OR, preserving BETWEEN's own separator inside comparison parsing.
  private conjunction(): void {
    this.negation()
    while (this.consume('AND') || this.consume('&&')) this.negation()
  }

  // Validate a full logical expression using the editor's existing group operations.
  private expression(): void {
    this.conjunction()
    while (this.consume('OR')) this.conjunction()
  }

  // Require complete consumption so JSON arrows, unknown functions, clauses, and suffixes fail closed.
  validate(): void {
    this.expression()
    if (this.peek()) throw new Error(`MariaDB 11.4 compatibility is not established for syntax starting at ${this.peek()}.`)
  }

  // Validate an opaque schema value or generated expression without importing it into the query model.
  validateScalar(): void {
    this.operand()
    if (this.peek()) throw new Error(`MariaDB schema compatibility is not established for syntax starting at ${this.peek()}.`)
  }
}

// Return a compatibility error separately from the common grammar's syntax errors.
export function mariadbSubsetError(expression: SqlFilterExpression): string | null {
  try {
    new MariadbSubsetReader(expression.tokens).validate()
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'Unsupported MariaDB 11.4 filter syntax.'
  }
}

// Reuse the operand grammar with schema collations for defaults, generated values, and CHECK predicates.
export function mariadbSchemaExpressionError(tokens: SqlFilterToken[], predicate: boolean, collations: ReadonlySet<string>): string | null {
  try {
    const reader = new MariadbSubsetReader(tokens, true, collations)
    if (predicate) reader.validate()
    else reader.validateScalar()
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'Unsupported MariaDB schema expression.'
  }
}
