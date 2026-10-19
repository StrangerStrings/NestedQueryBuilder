import type { Expr, Operator } from 'sqlite3-parser/sqlite-3.53.0'
import type { ConditionField, ConditionValue, QueryCondition } from '../../../types/query'
import { createId } from '../../../utils/createId'
import { quoteSqliteIdentifierSegments } from '../identifiers'
import { sqliteFieldModifiers } from '../modifiers'
import { sqliteOperators } from '../operators'
import { renderSqliteVisualComparison } from '../serialisation/renderVisualComparison'
import { sqliteVisualNumber } from './numericValue'
import { sqliteFailure, sqliteSource } from './source'
import type { SqliteExpressionRecord, SqliteParseError, SqlitePreparedSource, SqliteRange, SqliteSourceToken } from './types'
import type { SqliteValidatedExpression } from './validateExpression'

type Scalar = Extract<ConditionValue, { hasValue: true; dataShape: 'single'; dataType: 'text' | 'number' | 'field' }>
type ValueShape = 'single' | 'list' | 'range'
export type SqliteVisualConditionResult =
  | { success: true; condition: QueryCondition }
  | { success: false; requiresRaw: boolean; error: SqliteParseError }

const comparisons = new Map<Operator, string>([
  ['Equals', '='], ['NotEquals', '<>'], ['Less', '<'], ['LessEquals', '<='],
  ['Greater', '>'], ['GreaterEquals', '>='], ['Is', 'IS'], ['IsNot', 'IS NOT'],
])

// Separate expected visual limitations from unexpected conversion exceptions.
class RequiresRawCondition extends Error {
  // Carry the useful error category without granting Raw eligibility before policy validation.
  constructor(message: string, public kind: SqliteParseError['kind'] = 'unsupported-expression') {
    super(message)
  }
}

// Fold only ASCII letters when matching SQLite built-in names and boolean spellings.
function asciiLower(value: string): string {
  let result = ''
  for (const character of value) {
    const code = character.charCodeAt(0)
    result += code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : character
  }
  return result
}

// Remove only harmless single-expression parentheses, retaining all meaningful scalar structure.
function scalarNode(expression: Expr): Expr {
  let node = expression
  while (node.type === 'ParenthesizedExpr' && node.exprs.length === 1 && node.exprs[0]) node = node.exprs[0]
  return node
}

// Recover one intact guarded token from native coordinates and verify its untouched original spelling.
function intactToken(prepared: SqlitePreparedSource, range: SqliteRange): SqliteSourceToken {
  for (const token of prepared.tokens) {
    if (token.synthetic || token.native.span.offset !== range.offset || token.native.span.length !== range.length) continue
    const original = prepared.buffer.original.slice(token.originalSpan.offset, token.originalSpan.offset + token.originalSpan.length)
    if (original !== token.fragment) throw new Error('SQLite operand spelling differs from its original token.')
    return token
  }
  throw new Error('SQLite operand has no intact original source token.')
}

// Recognize truth-test operands only from native unqualified IDs with intact unquoted spelling.
function truthTestOperand(prepared: SqlitePreparedSource, expression: Expr): 'TRUE' | 'FALSE' | null {
  const node = scalarNode(expression)
  if (node.type !== 'Id') return null
  const token = intactToken(prepared, node.span)
  const spelling = asciiLower(token.fragment)
  if (spelling === 'true') return 'TRUE'
  if (spelling === 'false') return 'FALSE'
  return null
}

// Preserve bare TRUE/FALSE resolution while admitting strictly quoted and qualified references.
function referenceName(prepared: SqlitePreparedSource, expression: Expr): string {
  const node = scalarNode(expression)
  const parts: string[] = []
  if (node.type === 'Id') {
    const token = intactToken(prepared, node.span)
    const spelling = asciiLower(token.fragment)
    if (spelling === 'true' || spelling === 'false') {
      throw new RequiresRawCondition('Bare TRUE/FALSE outside a truth-test operand require Raw mode to preserve name resolution.')
    }
    parts.push(node.name)
  } else if (node.type === 'QualifiedExpr') {
    if (node.schema) parts.push(node.schema.text)
    parts.push(node.table.text, node.column.text)
  } else {
    throw new RequiresRawCondition('The visual editor requires an unmodified field reference in this operand.')
  }
  try {
    quoteSqliteIdentifierSegments(parts)
  } catch (error) {
    for (const part of parts) {
      if (part.includes('.') || part !== part.trim()) {
        throw new RequiresRawCondition(error instanceof Error ? error.message : 'This identifier requires Raw mode.', 'unsupported-value')
      }
    }
    throw error
  }
  return parts.join('.')
}

// Preserve Raw-only scalar and date/time calls before admitting a single-field visual modifier.
function conditionField(prepared: SqlitePreparedSource, expression: Expr): ConditionField {
  const node = scalarNode(expression)
  if (node.type !== 'FunctionCallExpr') return { name: referenceName(prepared, node), modifier: null }
  const name = asciiLower(node.name.name)
  if (['coalesce', 'ifnull', 'nullif', 'instr', 'substr', 'replace', 'date', 'time', 'datetime', 'julianday', 'strftime'].includes(name)) {
    throw new RequiresRawCondition(`${name} is supported only in Raw filter conditions; keep Raw mode to preserve its arguments and source.`)
  }
  if (node.distinctness !== undefined || node.orderBy !== undefined || node.filterOver !== undefined ||
      node.args?.length !== 1 || !node.args[0]) {
    throw new RequiresRawCondition('Decorated or multiple-argument modifiers require Raw mode.')
  }
  for (const modifier of sqliteFieldModifiers) {
    if (modifier === name) return { name: referenceName(prepared, node.args[0]), modifier }
  }
  throw new Error('A policy-validated SQLite modifier is missing from the visual catalogue.')
}

// Import text and fields literally, and inspect original decimal tokens before numeric conversion.
function conditionScalar(prepared: SqlitePreparedSource, expression: Expr): Scalar {
  const node = scalarNode(expression)
  if (node.type === 'StringLiteral') {
    return { hasValue: true, dataShape: 'single', dataType: 'text', value: node.value }
  }
  if (node.type === 'Id' || node.type === 'QualifiedExpr') {
    return { hasValue: true, dataShape: 'single', dataType: 'field', value: referenceName(prepared, node) }
  }
  let numeric: Expr = node
  let sign = ''
  if (node.type === 'UnaryExpr' && (node.op === 'Positive' || node.op === 'Negative')) {
    numeric = scalarNode(node.expr)
    sign = node.op === 'Negative' ? '-' : '+'
  }
  if (numeric.type === 'NumericLiteral') {
    const token = intactToken(prepared, numeric.span)
    const converted = sqliteVisualNumber(sign + token.fragment, token.name)
    if (!converted.success) throw new RequiresRawCondition(converted.reason, 'unsupported-value')
    return { hasValue: true, dataShape: 'single', dataType: 'number', value: converted.value }
  }
  if (node.type === 'NullLiteral') {
    throw new RequiresRawCondition('Literal NULL operands require Raw mode outside a null-check condition.', 'unsupported-value')
  }
  if (node.type === 'FunctionCallExpr') {
    throw new RequiresRawCondition('Modified right-hand operands require Raw mode.')
  }
  throw new RequiresRawCondition('This scalar operand requires Raw mode; it cannot become a literal or unmodified field value.')
}

// Convert every list/range item and require one model type without dropping unsupported elements.
function conditionValue(prepared: SqlitePreparedSource, shape: ValueShape, operands: readonly Expr[]): ConditionValue {
  if (!operands.length) throw new RequiresRawCondition('Empty IN lists require Raw mode.', 'unsupported-value')
  const scalars: Scalar[] = []
  for (const operand of operands) scalars.push(conditionScalar(prepared, operand))
  const first = scalars[0]
  if (!first) throw new Error('A visual SQLite value is missing its first operand.')
  for (const scalar of scalars) {
    if (scalar.dataType !== first.dataType) {
      throw new RequiresRawCondition('Mixed value types require Raw mode; visual lists and ranges must be homogeneous.', 'unsupported-value')
    }
  }
  if (shape === 'single') {
    if (scalars.length !== 1) throw new Error('A single SQLite value must have exactly one operand.')
    return first
  }
  if (shape === 'range' && scalars.length !== 2) throw new Error('A SQLite range must have exactly two endpoints.')
  const values: (string | number)[] = []
  for (const scalar of scalars) values.push(scalar.value)
  // The complete scalar checks establish the discriminant, homogeneous array type, and range length.
  return { hasValue: true, dataShape: shape, dataType: first.dataType, value: values } as ConditionValue
}

// Convert native truth tests from intact operands; preservation-only nodes retain their syntax.
function visualParts(prepared: SqlitePreparedSource, expression: Expr): Pick<QueryCondition, 'field' | 'operatorId' | 'value'> {
  const node = scalarNode(expression)
  let lhs: Expr
  let operatorId: string
  let shape: ValueShape | null = null
  let operands: readonly Expr[] = []
  switch (node.type) {
    case 'BinaryExpr': {
      const comparison = comparisons.get(node.op)
      if (!comparison) throw new RequiresRawCondition('Scalar operators and comparison chains require Raw mode.')
      lhs = node.left
      operatorId = comparison
      const isComparison = node.op === 'Is' || node.op === 'IsNot'
      const truthOperand = isComparison ? truthTestOperand(prepared, node.right) : null
      if (isComparison && scalarNode(node.right).type === 'NullLiteral') {
        operatorId = `${comparison} NULL`
      } else if (truthOperand) {
        operatorId = `${comparison} ${truthOperand}`
      } else {
        shape = 'single'
        operands = [node.right]
      }
      break
    }
    case 'BetweenExpr':
      lhs = node.lhs
      operatorId = node.not ? 'NOT BETWEEN' : 'BETWEEN'
      shape = 'range'
      operands = [node.start, node.end]
      break
    case 'InListExpr':
      lhs = node.lhs
      operatorId = node.not ? 'NOT IN' : 'IN'
      shape = 'list'
      operands = node.rhs ?? []
      break
    case 'LikeExpr':
      if (node.escape !== undefined) throw new RequiresRawCondition('Explicit ESCAPE clauses require Raw mode.')
      if (node.op !== 'Like' && node.op !== 'Glob') throw new Error('A disallowed pattern operator reached visual conversion.')
      lhs = node.lhs
      operatorId = `${node.not ? 'NOT ' : ''}${node.op === 'Like' ? 'LIKE' : 'GLOB'}`
      shape = 'single'
      operands = [node.rhs]
      break
    case 'IsNullExpr':
    case 'NotNullExpr':
      lhs = node.expr
      operatorId = node.type === 'IsNullExpr' ? 'IS NULL' : 'IS NOT NULL'
      break
    case 'CollateExpr':
      throw new RequiresRawCondition('COLLATE clauses require Raw mode.')
    default:
      throw new RequiresRawCondition('The visual editor requires one complete comparison, membership, range, pattern, or null-check condition.')
  }
  const field = conditionField(prepared, lhs)
  const value: ConditionValue = shape ? conditionValue(prepared, shape, operands) : { hasValue: false }
  for (const operator of sqliteOperators) {
    if (operator.id !== operatorId) continue
    const input = operator.valueInput
    if (input.hasValue && (!value.hasValue || value.dataShape !== input.dataShape || !input.dataTypes.includes(value.dataType))) {
      throw new RequiresRawCondition('This operator cannot represent the complete operand type and shape visually.', 'unsupported-value')
    }
    return { field, operatorId, value }
  }
  throw new Error('A policy-validated SQLite comparison is missing from the visual catalogue.')
}

// Convert a policy-validated leaf and gate success through the same strict visual renderer as generation.
export function importSqliteVisualCondition(
  validated: SqliteValidatedExpression, expression: SqliteExpressionRecord,
): SqliteVisualConditionResult {
  try {
    if (expression.kind !== 'leaf') throw new RequiresRawCondition('Logical expressions cannot become a single visual condition.')
    for (const token of expression.tokens) {
      if (token.name === 'COMMENT') throw new RequiresRawCondition('Comments require Raw mode because the visual model cannot retain them.')
    }
    const parts = visualParts(validated.prepared, expression.native)
    renderSqliteVisualComparison(parts.field, parts.operatorId, parts.value)
    return { success: true, condition: { kind: 'condition', id: createId(), ...parts } }
  } catch (error) {
    const requiresRaw = error instanceof RequiresRawCondition
    const failed = sqliteFailure(
      sqliteSource(validated.prepared.buffer.original), requiresRaw ? error.kind : 'unsupported-expression',
      requiresRaw ? error.message : error instanceof Error ? `SQLite visual conversion failed: ${error.message}` : 'SQLite visual conversion failed.',
      expression.semanticSpan,
    )
    return { ...failed, requiresRaw }
  }
}
