import { MySQL } from 'dt-sql-parser/dist/parser/mysql'
import { MySqlLexer } from 'dt-sql-parser/dist/lib/mysql/MySqlLexer'
import { ColumnCreateTableContext } from 'dt-sql-parser/dist/lib/mysql/MySqlParser'
import type { SchemaImportResult } from '../../../types/databaseAdapter'
import { quoteMysqlField } from '../identifiers'

type ImportedTable = { name: string[]; columns: string[] }
const parser = new MySQL()

// Decode parser-provided names once, rejecting segments the shared field model would alter.
function identifierName(spelling: string): string {
  let name: string
  if (spelling.startsWith('`') && spelling.endsWith('`')) {
    name = spelling.slice(1, -1).replaceAll('``', '`')
  } else {
    if (!/^[\p{L}\p{N}_$\u0080-\uffff]+$/u.test(spelling)) {
      throw new Error('Unsupported MySQL identifier quoting. Use plain identifiers or backticks.')
    }
    name = spelling
  }
  if (!name || name !== name.trim() || name.includes('.') || name === '*') {
    throw new Error(`Identifier ${spelling} cannot be represented faithfully as a field suggestion. Literal dots, surrounding whitespace, and wildcard names are unsupported.`)
  }
  // Share the serializer's length and Unicode validation without storing its quoted SQL output.
  quoteMysqlField(name)
  return name
}

// Extract only explicit column definitions, keeping constraint and index references out of suggestions.
function extractTable(table: ColumnCreateTableContext): ImportedTable {
  const fullName = table.tableNameCreate().fullId()
  const name = [identifierName(fullName.uid().getText())]
  const qualified = fullName.dottedId()
  if (qualified) {
    const segment = qualified.uid()?.getText() ?? qualified.ID()?.getText()
    if (!segment) throw new Error('Unsupported qualified MySQL table name.')
    name.push(identifierName(segment))
  }
  const columns: string[] = []
  for (const definition of table.createDefinitions().createDefinition()) {
    const column = definition.columnNameCreate()
    if (!column) continue
    const columnName = column.uid()
    if (!definition.columnDefinition() || !columnName || column.dottedId().length) {
      throw new Error('Unsupported column definition. Define each column using a single identifier.')
    }
    columns.push(identifierName(columnName.getText()))
  }
  if (!columns.length) throw new Error('No column definitions found. Include at least one table column.')
  return { name, columns }
}

// Validate the entire MySQL schema before returning unique, serializer-compatible field suggestions.
export function importMysqlSchema(sql: string): SchemaImportResult {
  try {
    const errors = parser.validate(sql)
    if (errors.length) {
      return { success: false, error: 'Invalid or unsupported MySQL SQL. Check your CREATE TABLE syntax and use explicit column definitions.' }
    }
    const tokens = parser.getAllTokens(sql)
    if (tokens.some((token) => token.type === MySqlLexer.SPEC_MYSQL_COMMENT || /^\/\*[!+]/.test(token.text ?? ''))) {
      return { success: false, error: 'Executable comments and optimizer hints cannot be safely imported. Use explicit CREATE TABLE statements.' }
    }
    const tables: ImportedTable[] = []
    const statements = parser.parse(sql).singleStatement()
    for (const [index, statement] of statements.entries()) {
      if (statement.emptyStatement_()) continue
      if (index < statements.length - 1 && !statement.SEMI() && !statements[index + 1]?.emptyStatement_()) {
        return { success: false, error: 'Separate CREATE TABLE statements with semicolons.' }
      }
      const table = statement.sqlStatement()?.ddlStatement()?.createTable()
      if (!table) return { success: false, error: 'Only CREATE TABLE statements are supported.' }
      if (!(table instanceof ColumnCreateTableContext)) {
        return { success: false, error: 'CREATE TABLE LIKE and CREATE TABLE AS SELECT are unsupported. Use explicit column definitions without a SELECT.' }
      }
      tables.push(extractTable(table))
    }
    const tableCount = new Set(tables.map((table) => JSON.stringify(table.name))).size
    const fields = new Set<string>()
    for (const table of tables) {
      const qualifier = tableCount > 1 ? table.name.join('.') + '.' : ''
      for (const column of table.columns) fields.add(qualifier + column)
    }
    if (!fields.size) {
      return { success: false, error: 'No column definitions found. Include at least one table column.' }
    }
    return { success: true, fields: [...fields] }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Invalid or unsupported MySQL CREATE TABLE schema.' }
  }
}
