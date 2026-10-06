import type { ConditionField, ConditionValue, QueryCondition } from '../../../types/query'
import type { FilterImportResult } from '../../../types/databaseAdapter'
import { createId } from '../../../utils/createId'
import { isValidTemporal } from '../../../utils/temporalValue'
import { mysqlOperators } from '../operators'
import { mysqlFieldModifiers } from '../modifiers'
import type { MysqlExpression, MysqlToken } from './parseWhere'

type ImportError = Extract<FilterImportResult, { success: false }>['error']
type Scalar = Extract<ConditionValue, { hasValue: true; dataShape: 'single' }>
export type MysqlConditionResult =
  | { success: true; condition: QueryCondition }
  | { success: false; error: ImportError }

// Distinguish conversion failures from SQL grammar errors, retaining the original expression.
class UnsupportedCondition extends Error {
  // Attach the existing import error category to a conversion failure.
  constructor(public kind: ImportError['kind'], message: string) { super(message) }
}

// Decode MySQL strings under the standard 8.4 mode (ANSI_QUOTES and NO_BACKSLASH_ESCAPES disabled).
function stringValue(source: string): string {
  const quote = source[0]
  if ((quote !== "'" && quote !== '"') || source[source.length - 1] !== quote) {
    throw new UnsupportedCondition('unsupported-value', 'Expected a quoted MySQL string.')
  }
  const escapes: Record<string, string> = { '0': '\0', b: '\b', n: '\n', r: '\r', t: '\t', Z: '\x1a' }
  let value = ''
  for (let index = 1; index < source.length - 1; index += 1) {
    const character = source[index] ?? ''
    if (character === quote && source[index + 1] === quote) { value += quote; index += 1 }
    else if (character === '\\') {
      const next = source[++index]
      if (next === undefined) throw new UnsupportedCondition('unsupported-value', 'Incomplete string escape.')
      value += next === '%' || next === '_' ? `\\${next}` : escapes[next] ?? next
    } else value += character
  }
  return value
}

// Compare decimal spelling exactly so import cannot silently round a number beyond the JS model.
function numericKey(source: string): string {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(source)
  if (!match || !(match[2] || match[3])) throw new UnsupportedCondition('unsupported-value', 'Invalid numeric literal.')
  let digits = `${match[2] ?? ''}${match[3] ?? ''}`.replace(/^0+/, '')
  if (!digits) return '0'
  let exponent = Number(match[4] ?? 0) - (match[3]?.length ?? 0)
  while (digits.endsWith('0')) { digits = digits.slice(0, -1); exponent += 1 }
  return `${match[1] === '-' ? '-' : ''}${digits}e${exponent}`
}

// Read only the editor's exact literal/field/modifier grammar after the full MySQL parser succeeds.
class ConditionReader {
  private index = 0
  // Keep the grammar-validated token stream local to one condition conversion.
  constructor(private tokens: MysqlToken[]) {}

  // Inspect the next source token without changing its SQL spelling.
  peek(): string { return this.tokens[this.index]?.text ?? '' }

  // Consume a required token, treating unexpected syntax as a conversion failure.
  take(expected?: string): string {
    const text = this.peek()
    if (!text || (expected && text.toUpperCase() !== expected)) {
      throw new UnsupportedCondition('unsupported-expression', `Expected ${expected ?? 'an expression'}.`)
    }
    this.index += 1
    return text
  }

  // Consume optional syntax using case-insensitive SQL keywords.
  consume(expected: string): boolean {
    if (this.peek().toUpperCase() !== expected) return false
    this.index += 1
    return true
  }

  // Import raw identifier names only when qualification and whitespace survive the shared model.
  field(): ConditionField {
    if (this.consume('(')) { const field = this.field(); this.take(')'); return field }
    const first = this.take()
    if (/^(?:[\d.]+(?:e[+-]?\d+)?|0[xb][\da-f]+)$/i.test(first) || ['TRUE', 'FALSE', 'NULL'].includes(first.toUpperCase())) {
      throw new UnsupportedCondition('unsupported-expression', 'A literal cannot become a column reference.')
    }
    if (this.consume('(')) {
      const modifier = mysqlFieldModifiers.find((candidate) => candidate === first.toLowerCase())
      if (!modifier) throw new UnsupportedCondition('unsupported-expression', `Unsupported field modifier: ${first}.`)
      const field = this.field()
      this.take(')')
      if (field.modifier) throw new UnsupportedCondition('unsupported-expression', 'Nested field modifiers require Raw mode.')
      return { ...field, modifier }
    }
    const parts = [first]
    while (this.consume('.')) parts.push(this.take())
    const names = parts.map((part) => {
      if (part.startsWith('`') && part.endsWith('`')) return part.slice(1, -1).replaceAll('``', '`')
      if (!/^[\p{L}\p{N}_$]+$/u.test(part)) throw new UnsupportedCondition('unsupported-expression', 'Expected a column reference.')
      return part
    })
    if (names.length > 3 || names.some((name) => !name || name !== name.trim() || name.includes('.') || name === '*')) {
      throw new UnsupportedCondition('unsupported-expression', 'This identifier cannot be represented without changing its name.')
    }
    return { name: names.join('.'), modifier: null }
  }

  // Import finite, exactly representable literals; preserve meaningful casts/charsets through Raw mode.
  scalar(): Scalar {
    const token = this.peek()
    const keyword = token.toUpperCase()
    if (this.consume('(')) { const value = this.scalar(); this.take(')'); return value }
    if (['DATE', 'TIME', 'TIMESTAMP'].includes(keyword) && /^["']/.test(this.tokens[this.index + 1]?.text ?? '')) {
      this.take()
      const dataType = keyword === 'DATE' ? 'date' : keyword === 'TIME' ? 'time' : 'datetime'
      const literal = stringValue(this.take())
      const value = dataType === 'datetime' ? literal.replace(' ', 'T') : literal
      if (!isValidTemporal(value, dataType) || (dataType !== 'time' && Number(value.slice(0, 4)) < 1000)) {
        throw new UnsupportedCondition('unsupported-value', 'Only exact local temporal literals are editable.')
      }
      return { hasValue: true, dataShape: 'single', dataType, value }
    }
    if (keyword === 'CAST') {
      this.take(); this.take('(')
      const literal = this.scalar()
      this.take('AS')
      const target = this.take().toUpperCase()
      this.take(')')
      const dataType = target === 'DATE' ? 'date' : target === 'TIME' ? 'time' : target === 'DATETIME' ? 'datetime' : null
      if (!dataType || literal.dataType !== 'text') throw new UnsupportedCondition('unsupported-value', 'Only exact local temporal string casts are editable.')
      const value = dataType === 'datetime' ? literal.value.replace(' ', 'T') : literal.value
      if (!isValidTemporal(value, dataType) || (dataType !== 'time' && Number(value.slice(0, 4)) < 1000)) {
        throw new UnsupportedCondition('unsupported-value', 'Temporal casts must contain an exact local value with supported years and seconds precision.')
      }
      return { hasValue: true, dataShape: 'single', dataType, value }
    }
    if (keyword === '_UTF8MB4') {
      this.take()
      const hex = this.take()
      if (!/^X'(?:[\da-f]{2})*'$/i.test(hex)) throw new UnsupportedCondition('unsupported-value', 'Only UTF-8 hex introducers are editable.')
      const bytes = hex.slice(2, -1).match(/../g) ?? []
      const value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Uint8Array.from(bytes, (pair) => parseInt(pair, 16)))
      if (!/[\\\u0000-\u001f\u007f-\uffff]/.test(value)) {
        throw new UnsupportedCondition('unsupported-value', 'This explicit character set would be lost by visual serialization; keep it in Raw mode.')
      }
      return { hasValue: true, dataShape: 'single', dataType: 'text', value }
    }
    if (token.startsWith("'") || token.startsWith('"')) {
      this.take()
      return { hasValue: true, dataShape: 'single', dataType: 'text', value: stringValue(token) }
    }
    if (keyword === 'TRUE' || keyword === 'FALSE') {
      this.take()
      return { hasValue: true, dataShape: 'single', dataType: 'boolean', value: keyword === 'TRUE' }
    }
    if (keyword === 'NULL') throw new UnsupportedCondition('unsupported-value', 'Literal NULL requires Raw mode; use IS NULL for a visual null check.')
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token) || token === '+' || token === '-') {
      let spelling = this.take()
      if (spelling === '+' || spelling === '-') spelling += this.take()
      const value = Number(spelling)
      if (!Number.isFinite(value) || numericKey(spelling) !== numericKey(String(value)) || /[eE]/.test(spelling) !== /[eE]/.test(String(value))) {
        throw new UnsupportedCondition('unsupported-value', 'Numeric precision or exact/approximate literal typing cannot be preserved by the visual editor; Raw mode is required.')
      }
      return { hasValue: true, dataShape: 'single', dataType: 'number', value }
    }
    const field = this.field()
    if (field.modifier) throw new UnsupportedCondition('unsupported-value', 'Modified value references require Raw mode.')
    return { hasValue: true, dataShape: 'single', dataType: 'field', value: field.name }
  }

  // Require end-of-expression so collations, precision clauses, or suffixes are never discarded.
  finish(): void {
    if (this.peek()) throw new UnsupportedCondition('unsupported-expression', 'Additional casts, collations, or expressions require Raw mode.')
  }
}

// Convert one condition atomically; unsupported syntax remains distinct from invalid SQL.
export function importMysqlCondition(expression: MysqlExpression): MysqlConditionResult {
  try {
    const reader = new ConditionReader(expression.tokens)
    const field = reader.field()
    let operatorId = reader.take().toUpperCase()
    if (operatorId === '!=') operatorId = '<>'
    if (operatorId === 'IS' || operatorId === 'NOT') {
      if (operatorId === 'IS' && reader.consume('NOT')) operatorId += ' NOT'
      operatorId += ` ${reader.take().toUpperCase()}`
    }
    const operator = mysqlOperators.find((candidate) => candidate.id === operatorId)
    if (!operator) throw new UnsupportedCondition('unsupported-operator', `Unsupported visual operator: ${operatorId}.`)
    const input = operator.valueInput
    let value: ConditionValue = { hasValue: false }
    if (input.hasValue) {
      const values: Scalar[] = []
      if (input.dataShape === 'list') {
        reader.take('(')
        values.push(reader.scalar())
        while (reader.consume(',')) values.push(reader.scalar())
        reader.take(')')
      } else {
        values.push(reader.scalar())
        if (input.dataShape === 'range') { reader.take('AND'); values.push(reader.scalar()) }
      }
      const first = values[0]
      if (!first || !input.dataTypes.includes(first.dataType) || values.some((item) => item.dataType !== first.dataType)) {
        throw new UnsupportedCondition('unsupported-value', 'The operator requires homogeneous supported values.')
      }
      value = input.dataShape === 'single' ? first : {
        hasValue: true, dataType: first.dataType, dataShape: input.dataShape, value: values.map((item) => item.value),
      } as ConditionValue
      if (operatorId === 'LIKE' || operatorId === 'NOT LIKE') {
        if (reader.consume('ESCAPE')) {
          const escape = /^X'5c'$/i.test(reader.peek())
            ? (reader.take(), { dataType: 'text' as const, value: '\\' })
            : reader.scalar()
          if (escape.dataType !== 'text' || escape.value !== '\\') throw new UnsupportedCondition('unsupported-expression', 'Custom pattern escapes require Raw mode.')
        }
      }
    }
    reader.finish()
    return { success: true, condition: { kind: 'condition', id: createId(), field, operatorId, value } }
  } catch (error) {
    return { success: false, error: {
      kind: error instanceof UnsupportedCondition ? error.kind : 'unsupported-value',
      message: error instanceof Error ? error.message : 'Unsupported MySQL value.', fragment: expression.source,
    } }
  }
}
