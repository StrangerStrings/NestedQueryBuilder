import { parse, toSql, type CreateTableStatement, type Statement } from 'pgsql-ast-parser'

export type ImportSchemaResult =
  | { success: true; fields: string[] }
  | { success: false; error: string }

// Quote unusual identifiers explicitly, using the parser's keyword quoting for simple names.
function quoteIdentifier(name: string): string {
  return /^[a-z][a-z0-9_]*$/.test(name)
    ? toSql.ref({ type: 'ref', name })
    : `"${name.replaceAll('"', '""')}"`
}

// Extract unique column references only after every statement has been accepted.
export function importSchema(sql: string): ImportSchemaResult {
  let statements: Statement[]
  try {
    statements = parse(sql)
  } catch {
    return { success: false, error: 'Invalid PostgreSQL SQL. Check your CREATE TABLE syntax.' }
  }

  const tables: CreateTableStatement[] = []
  for (const statement of statements) {
    if (statement.type !== 'create table') {
      return { success: false, error: 'Only CREATE TABLE statements are supported.' }
    }
    if (statement.columns.some((column) => column.kind !== 'column')) {
      return {
        success: false,
        error: 'CREATE TABLE LIKE is unsupported. Use explicit column definitions.',
      }
    }
    tables.push(statement)
  }

  const tableCount = new Set(
    tables.map((table) => JSON.stringify([table.name.schema ?? null, table.name.name])),
  ).size
  const fields = new Set<string>()
  for (const table of tables) {
    const qualifier =
      tableCount > 1
        ? [table.name.schema, table.name.name]
            .filter((name): name is string => name !== undefined)
            .map(quoteIdentifier)
            .join('.') + '.'
        : ''
    for (const column of table.columns) {
      if (column.kind === 'column') fields.add(qualifier + quoteIdentifier(column.name.name))
    }
  }

  if (!fields.size) {
    return { success: false, error: 'No column definitions found. Include at least one table column.' }
  }
  return { success: true, fields: [...fields] }
}
