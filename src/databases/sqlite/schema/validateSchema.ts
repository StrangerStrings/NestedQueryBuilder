import type {
  ColumnDefinition,
  CreateTableStmt,
  DeferSubclause,
  Expr,
  ForeignKeyClause,
  IndexedColumn,
  NamedColumnConstraint,
  NamedTableConstraint,
  ResolveType,
  SortOrder,
  SortedColumn,
  Type as DeclaredType,
} from 'sqlite3-parser/sqlite-3.53.0'
import {
  asciiLower,
  validateSqliteIdentifier,
  validateSqliteSchemaExpression,
} from '../parsing/validateExpression'
import {
  atWord,
  rejectSchema,
  requireStart,
  takeCollationName,
  takeExpressionSpan,
  takeName,
  takeSymbol,
  takeWord,
} from './cursor'
import type { SchemaCursor } from './cursor'

export type SqliteSchemaTable = {
  readonly segments: readonly string[]
  readonly columns: readonly string[]
}
type TableOptions = { readonly strict: boolean; readonly withoutRowid: boolean }

// Validate schema operands directly against their original prepared source without reparsing slices.
function takeExpression(
  cursor: SchemaCursor,
  expr: Expr,
  context: 'default' | 'check',
  bareDefault = false,
): void {
  const error = validateSqliteSchemaExpression(cursor.prepared, expr, context, bareDefault)
  if (error) throw new Error(error.error.message)
  takeExpressionSpan(cursor, expr.span)
}

// Declared type sizes contain one decimal literal, optionally preceded by a unary sign.
function takeTypeSize(cursor: SchemaCursor, expr: Expr): void {
  if (
    expr.type !== 'NumericLiteral' &&
    !(
      expr.type === 'UnaryExpr' &&
      (expr.op === 'Positive' || expr.op === 'Negative') &&
      expr.expr.type === 'NumericLiteral'
    )
  ) {
    rejectSchema(
      cursor,
      'Declared type parameters require signed decimal numeric literals.',
      expr.span,
    )
  }
  takeExpression(cursor, expr, 'default', true)
}

// Inspect type words and numeric parameters instead of trusting the collapsed native type name.
function takeDeclaredType(cursor: SchemaCursor, type: DeclaredType): void {
  requireStart(cursor, type.span)
  const end = type.span.offset + type.span.length
  let words = 0
  while (
    cursor.tokens[cursor.index] &&
    cursor.tokens[cursor.index]!.native.span.offset < end &&
    cursor.tokens[cursor.index]!.name !== 'LP'
  ) {
    const token = cursor.tokens[cursor.index]!
    if (!/^(?:["`[]|[A-Za-z_\u0080-\uffff])/.test(token.fragment)) {
      rejectSchema(cursor, 'Declared type names require identifier words.', token.native.span)
    }
    const error = validateSqliteIdentifier(
      cursor.prepared,
      token.native.span,
      type.name,
      'unsupported-value',
      true,
    )
    if (error) throw new Error(error.error.message)
    cursor.index += 1
    words += 1
  }
  if (!words) rejectSchema(cursor, 'A declared type requires an identifier name.', type.span)
  if (type.size !== undefined) {
    takeSymbol(cursor, 'LP')
    if (type.size.type === 'MaxSizeTypeSize') {
      takeTypeSize(cursor, type.size.size)
    } else {
      takeTypeSize(cursor, type.size.size1)
      takeSymbol(cursor, 'COMMA')
      takeTypeSize(cursor, type.size.size2)
    }
    takeSymbol(cursor, 'RP')
  }
  const last = cursor.tokens[cursor.index - 1]
  if (!last || last.native.span.offset + last.native.span.length !== end) {
    rejectSchema(cursor, 'Unaccounted syntax in a SQLite declared type.', type.span)
  }
}

// Account for an attached naming prefix so staged or discarded CONSTRAINT names cannot leak.
function takeConstraintPrefix(
  cursor: SchemaCursor,
  named: NamedColumnConstraint | NamedTableConstraint,
): void {
  if (named.name !== undefined) {
    takeWord(cursor, 'CONSTRAINT')
    takeName(cursor, named.name)
  } else if (cursor.tokens[cursor.index]?.name === 'CONSTRAINT') {
    rejectSchema(cursor, 'Repeated, dangling, or incorrectly attached CONSTRAINT name.')
  }
  requireStart(cursor, named.constraint.span)
}

// Accept only native ASC/DESC ordering and require the corresponding intact source word.
function takeOrder(cursor: SchemaCursor, order: SortOrder | undefined): void {
  if (order !== undefined) {
    if (order !== 'Asc' && order !== 'Desc')
      rejectSchema(cursor, 'Unsupported SQLite column ordering.')
    takeWord(cursor, order)
  }
}

// Validate every permitted conflict action in the contexts where the native grammar allows it.
function takeConflict(cursor: SchemaCursor, conflict: ResolveType | undefined): void {
  if (conflict === undefined) return
  if (!['Rollback', 'Abort', 'Fail', 'Ignore', 'Replace'].includes(conflict)) {
    rejectSchema(cursor, 'Unsupported SQLite ON CONFLICT action.')
  }
  takeWord(cursor, 'ON')
  takeWord(cursor, 'CONFLICT')
  takeWord(cursor, conflict)
}

// FOREIGN KEY lists contain plain local or referenced names with no collation or ordering.
function takePlainColumns(cursor: SchemaCursor, columns: readonly IndexedColumn[]): void {
  if (!columns.length) rejectSchema(cursor, 'Foreign-key column lists must be nonempty.')
  takeSymbol(cursor, 'LP')
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index]!
    if (index) takeSymbol(cursor, 'COMMA')
    if (column.collationName !== undefined || column.order !== undefined) {
      rejectSchema(
        cursor,
        'Foreign-key column lists cannot use COLLATE or ordering.',
        column.colName.span,
      )
    }
    takeName(cursor, column.colName)
  }
  takeSymbol(cursor, 'RP')
}

// Restrict key/unique items structurally to unqualified names and optional built-in collation.
function takeSortedColumns(cursor: SchemaCursor, columns: readonly SortedColumn[]): void {
  if (!columns.length) rejectSchema(cursor, 'PRIMARY KEY and UNIQUE lists must be nonempty.')
  takeSymbol(cursor, 'LP')
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index]!
    if (index) takeSymbol(cursor, 'COMMA')
    if (column.nulls !== undefined)
      rejectSchema(
        cursor,
        'NULLS ordering is outside the supported schema subset.',
        column.expr.span,
      )
    const expr = column.expr
    const reference = expr.type === 'CollateExpr' ? expr.expr : expr
    if (reference.type !== 'Id') {
      rejectSchema(
        cursor,
        'PRIMARY KEY and UNIQUE require unqualified column names, not expressions.',
        expr.span,
      )
    }
    takeName(cursor, reference)
    if (expr.type === 'CollateExpr') {
      const error = validateSqliteSchemaExpression(cursor.prepared, expr, 'check')
      if (error) throw new Error(error.error.message)
      takeWord(cursor, 'COLLATE')
      const token = cursor.tokens[cursor.index]
      if (!token) rejectSchema(cursor, 'Missing key-column collation name.', expr.span)
      takeCollationName(cursor, { type: 'Name', text: expr.collation, span: token.native.span })
    }
    takeOrder(cursor, column.order)
  }
  takeSymbol(cursor, 'RP')
}

// Match foreign-key options one by one, including duplicates that native reducers retain.
function takeReferences(cursor: SchemaCursor, clause: ForeignKeyClause): void {
  takeWord(cursor, 'REFERENCES')
  takeName(cursor, clause.tblName)
  if (clause.columns !== undefined) takePlainColumns(cursor, clause.columns)
  const seen = new Set<string>()
  for (const arg of clause.args) {
    requireStart(cursor, arg.span)
    if (seen.has(arg.type)) rejectSchema(cursor, 'Repeated SQLite foreign-key option.', arg.span)
    seen.add(arg.type)
    if (arg.type === 'MatchRefArg') {
      takeWord(cursor, 'MATCH')
      const match = takeName(cursor, arg.name)
      if (!['simple', 'full', 'partial'].includes(asciiLower(match))) {
        rejectSchema(
          cursor,
          'Only SIMPLE, FULL, and PARTIAL foreign-key MATCH names are supported.',
          arg.name.span,
        )
      }
      continue
    }
    if (arg.type === 'OnInsertRefArg')
      rejectSchema(
        cursor,
        'ON INSERT foreign-key actions are outside the supported subset.',
        arg.span,
      )
    takeWord(cursor, 'ON')
    takeWord(cursor, arg.type === 'OnDeleteRefArg' ? 'DELETE' : 'UPDATE')
    switch (arg.action) {
      case 'SetNull':
        takeWord(cursor, 'SET')
        takeWord(cursor, 'NULL')
        break
      case 'SetDefault':
        takeWord(cursor, 'SET')
        takeWord(cursor, 'DEFAULT')
        break
      case 'Cascade':
      case 'Restrict':
        takeWord(cursor, arg.action)
        break
      case 'NoAction':
        takeWord(cursor, 'NO')
        takeWord(cursor, 'ACTION')
        break
      default:
        rejectSchema(cursor, 'Unsupported SQLite foreign-key action.', arg.span)
    }
  }
}

// Deferrability must be complete and immediately attached to its foreign-key declaration.
function takeDefer(cursor: SchemaCursor, clause: DeferSubclause): void {
  requireStart(cursor, clause.span)
  if (!clause.deferrable) takeWord(cursor, 'NOT')
  takeWord(cursor, 'DEFERRABLE')
  if (clause.initDeferred !== undefined) {
    takeWord(cursor, 'INITIALLY')
    if (clause.initDeferred === 'InitiallyDeferred') takeWord(cursor, 'DEFERRED')
    else if (clause.initDeferred === 'InitiallyImmediate') takeWord(cursor, 'IMMEDIATE')
    else rejectSchema(cursor, 'Unsupported SQLite initial deferrability.', clause.span)
  }
}

// DEFAULT wrappers include DEFAULT in native spans, so consume their actual children and delimiters.
function takeDefault(cursor: SchemaCursor, expr: Expr): void {
  takeWord(cursor, 'DEFAULT')
  if (cursor.tokens[cursor.index]?.name === 'LP') {
    if (expr.type !== 'ParenthesizedExpr' || expr.exprs.length !== 1 || !expr.exprs[0]) {
      rejectSchema(cursor, 'Parenthesized DEFAULT requires one scalar expression.', expr.span)
    }
    takeSymbol(cursor, 'LP')
    takeExpression(cursor, expr.exprs[0], 'default')
    takeSymbol(cursor, 'RP')
    return
  }
  const error = validateSqliteSchemaExpression(cursor.prepared, expr, 'default', true)
  if (error) throw new Error(error.error.message)
  if (expr.type === 'UnaryExpr') {
    takeSymbol(cursor, expr.op === 'Positive' ? 'PLUS' : 'MINUS')
    takeExpressionSpan(cursor, expr.expr.span)
  } else {
    takeExpressionSpan(cursor, expr.span)
  }
}

// CHECK clauses preserve their complete native scalar expression and require outer parentheses.
function takeCheck(cursor: SchemaCursor, expr: Expr): void {
  takeWord(cursor, 'CHECK')
  takeSymbol(cursor, 'LP')
  takeExpression(cursor, expr, 'check')
  takeSymbol(cursor, 'RP')
}

// Consume every approved inline constraint, preserving the special REFERENCES/defer association.
function takeColumnConstraints(cursor: SchemaCursor, column: ColumnDefinition): void {
  for (let index = 0; index < column.constraints.length; index += 1) {
    const named = column.constraints[index]!
    const constraint = named.constraint
    if (constraint.type === 'GeneratedColumnConstraint') {
      rejectSchema(
        cursor,
        'Generated columns, including abbreviated AS forms, are outside the supported schema subset.',
      )
    }
    takeConstraintPrefix(cursor, named)
    switch (constraint.type) {
      case 'PrimaryKeyColumnConstraint':
        takeWord(cursor, 'PRIMARY')
        takeWord(cursor, 'KEY')
        takeOrder(cursor, constraint.order)
        takeConflict(cursor, constraint.conflictClause)
        if (constraint.autoIncrement) takeWord(cursor, 'AUTOINCREMENT')
        break
      case 'NotNullColumnConstraint':
        if (!constraint.nullable) takeWord(cursor, 'NOT')
        takeWord(cursor, 'NULL')
        takeConflict(cursor, constraint.conflictClause)
        break
      case 'UniqueColumnConstraint':
        takeWord(cursor, 'UNIQUE')
        takeConflict(cursor, constraint.conflictClause)
        break
      case 'DefaultColumnConstraint':
        takeDefault(cursor, constraint.expr)
        break
      case 'CheckColumnConstraint':
        takeCheck(cursor, constraint.expr)
        break
      case 'CollateColumnConstraint':
        takeWord(cursor, 'COLLATE')
        takeCollationName(cursor, constraint.collationName)
        break
      case 'ForeignKeyColumnConstraint':
        takeReferences(cursor, constraint.clause)
        if (constraint.deferClause !== undefined) takeDefer(cursor, constraint.deferClause)
        break
      case 'DeferColumnConstraint': {
        const previous = column.constraints[index - 1]?.constraint
        if (
          named.name !== undefined ||
          previous?.type !== 'ForeignKeyColumnConstraint' ||
          previous.deferClause !== undefined
        ) {
          rejectSchema(
            cursor,
            'DEFERRABLE must immediately follow one REFERENCES clause without a naming prefix.',
            constraint.span,
          )
        }
        takeDefer(cursor, constraint.clause)
        break
      }
      default:
        rejectSchema(
          cursor,
          'This inline constraint is outside the supported SQLite schema subset.',
        )
    }
  }
}

// Table constraints expose no fields and must account for every operand, name, and option.
function takeTableConstraint(cursor: SchemaCursor, named: NamedTableConstraint): void {
  takeConstraintPrefix(cursor, named)
  const constraint = named.constraint
  switch (constraint.type) {
    case 'PrimaryKeyTableConstraint':
      if (constraint.autoIncrement)
        rejectSchema(
          cursor,
          'Table-level AUTOINCREMENT is outside the supported schema subset.',
          constraint.span,
        )
      takeWord(cursor, 'PRIMARY')
      takeWord(cursor, 'KEY')
      takeSortedColumns(cursor, constraint.columns)
      takeConflict(cursor, constraint.conflictClause)
      break
    case 'UniqueTableConstraint':
      takeWord(cursor, 'UNIQUE')
      takeSortedColumns(cursor, constraint.columns)
      takeConflict(cursor, constraint.conflictClause)
      break
    case 'CheckTableConstraint':
      takeCheck(cursor, constraint.expr)
      takeConflict(cursor, constraint.conflictClause)
      break
    case 'ForeignKeyTableConstraint':
      takeWord(cursor, 'FOREIGN')
      takeWord(cursor, 'KEY')
      takePlainColumns(cursor, constraint.columns)
      takeReferences(cursor, constraint.clause)
      if (constraint.deferClause !== undefined) takeDefer(cursor, constraint.deferClause)
      break
    default:
      rejectSchema(cursor, 'This table constraint is outside the supported SQLite schema subset.')
  }
}

// Require complete, unquoted, comma-separated table options without trusting collapsed flags.
function takeTableOptions(cursor: SchemaCursor, flags: number): TableOptions {
  let strict = false
  let withoutRowid = false
  let count = 0
  while (cursor.tokens[cursor.index] && cursor.tokens[cursor.index]?.name !== 'SEMI') {
    if (count) takeSymbol(cursor, 'COMMA')
    if (atWord(cursor, 'STRICT') && !strict) {
      takeWord(cursor, 'STRICT')
      strict = true
    } else if (atWord(cursor, 'WITHOUT') && !withoutRowid) {
      takeWord(cursor, 'WITHOUT')
      takeWord(cursor, 'ROWID')
      withoutRowid = true
    } else {
      rejectSchema(
        cursor,
        'Unsupported, quoted, or repeated SQLite table option; expected STRICT or WITHOUT ROWID.',
      )
    }
    count += 1
  }
  if (strict !== ((flags & 65536) !== 0) || withoutRowid !== ((flags & 128) !== 0)) {
    rejectSchema(cursor, 'SQLite table option tokens disagree with their native syntax flags.')
  }
  return { strict, withoutRowid }
}

// Enforce STRICT syntax and bounded AUTOINCREMENT without emulating unrelated execution checks.
function validateColumnOptions(
  cursor: SchemaCursor,
  column: ColumnDefinition,
  options: TableOptions,
): void {
  const type = column.colType
  if (options.strict) {
    if (
      !type ||
      type.size !== undefined ||
      !['int', 'integer', 'real', 'text', 'blob', 'any'].includes(asciiLower(type.name))
    ) {
      rejectSchema(
        cursor,
        'STRICT columns require INT, INTEGER, REAL, TEXT, BLOB, or ANY without type parameters.',
        type?.span ?? column.colName.span,
      )
    }
    let words = 0
    for (const token of cursor.tokens) {
      if (
        token.native.span.offset >= type.span.offset &&
        token.native.span.offset < type.span.offset + type.span.length
      )
        words += 1
    }
    if (words !== 1)
      rejectSchema(cursor, 'STRICT declared types require one intact type-name token.', type.span)
  }
  for (const named of column.constraints) {
    const constraint = named.constraint
    if (
      constraint.type === 'PrimaryKeyColumnConstraint' &&
      constraint.autoIncrement &&
      (!type ||
        type.size !== undefined ||
        asciiLower(type.name) !== 'integer' ||
        constraint.order === 'Desc' ||
        options.withoutRowid)
    ) {
      rejectSchema(
        cursor,
        'AUTOINCREMENT requires an unparameterized inline INTEGER PRIMARY KEY without DESC or WITHOUT ROWID.',
        constraint.span,
      )
    }
  }
}

// Validate one native explicit-column table by consuming all significant source tokens in order.
export function takeSqliteTable(
  cursor: SchemaCursor,
  statement: CreateTableStmt,
): SqliteSchemaTable {
  if (statement.body.type !== 'ColumnsAndConstraintsCreateTableBody') {
    rejectSchema(
      cursor,
      'CREATE TABLE AS SELECT is outside the supported SQLite schema subset.',
      statement.body.span,
    )
  }
  if (!statement.body.columns.length)
    rejectSchema(cursor, 'CREATE TABLE must declare at least one column.', statement.body.span)
  takeWord(cursor, 'CREATE')
  if (statement.temporary) {
    if (atWord(cursor, 'TEMPORARY')) takeWord(cursor, 'TEMPORARY')
    else takeWord(cursor, 'TEMP')
  }
  takeWord(cursor, 'TABLE')
  if (statement.ifNotExists) {
    takeWord(cursor, 'IF')
    takeWord(cursor, 'NOT')
    takeWord(cursor, 'EXISTS')
  }
  const segments: string[] = []
  if (statement.tblName.alias !== undefined)
    rejectSchema(cursor, 'CREATE TABLE aliases are unsupported.', statement.tblName.alias.span)
  if (statement.tblName.dbName !== undefined) {
    segments.push(takeName(cursor, statement.tblName.dbName, true))
    takeSymbol(cursor, 'DOT')
  }
  segments.push(takeName(cursor, statement.tblName.objName, true))
  takeSymbol(cursor, 'LP')
  const columns: string[] = []
  for (let index = 0; index < statement.body.columns.length; index += 1) {
    const column = statement.body.columns[index]!
    if (index) takeSymbol(cursor, 'COMMA')
    columns.push(takeName(cursor, column.colName, true))
    if (column.colType !== undefined) takeDeclaredType(cursor, column.colType)
    takeColumnConstraints(cursor, column)
  }
  for (const constraint of statement.body.constraints ?? []) {
    takeSymbol(cursor, 'COMMA')
    takeTableConstraint(cursor, constraint)
  }
  takeSymbol(cursor, 'RP')
  const options = takeTableOptions(cursor, statement.body.flags)
  for (const column of statement.body.columns) validateColumnOptions(cursor, column, options)
  return { segments, columns }
}
