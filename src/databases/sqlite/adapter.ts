import type { DatabaseAdapter } from '../../types/databaseAdapter'
import sqliteIcon from '../../assets/databases/sqlite.svg'
import { sqliteOperators } from './operators'
import { sqliteFieldModifiers } from './modifiers'
import { generateSqliteWhereSql } from './serialisation/generateWhereSql'
import { generateSqliteConditionSql } from './serialisation/generateConditionSql'
import { importSqliteWhere, parseSqliteRawCondition } from './parsing/importWhere'
import { importSqliteSchema } from './schema/importSchema'

export const sqliteAdapter: DatabaseAdapter = {
  id: 'sqlite',
  label: 'SQLite',
  version: '3.37+ subset',
  icon: sqliteIcon,
  queryFormat: {
    formatterDialect: 'sqlite',
    highlightLanguage: 'sql',
  },
  helpText: {
    schemaHelp: 'Paste SQLite CREATE TABLE statements with explicit columns to populate field autocomplete. Use double quotes for identifiers. One unqualified table produces column names; multiple tables or explicit database qualifiers produce qualified names. STRICT and WITHOUT ROWID are supported. Types and constraints do not configure the query builder. Generated columns, CREATE TABLE AS SELECT and other statements are unsupported. A failed import retains previous suggestions.',
    schemaPlaceholder: 'CREATE TABLE main.users (\n  id INTEGER PRIMARY KEY,\n  status TEXT,\n  active INTEGER,\n  created_at TEXT\n) STRICT, WITHOUT ROWID;',
    queryHelp: 'Paste a SQLite filter expression, with or without WHERE. For example: WHERE status = \'online\' AND deleted_at IS NULL. Combine conditions with AND, OR, NOT and parentheses. Use double quotes for identifiers and single quotes for text. Supported conditions become editable fields; other accepted expressions remain in Raw mode. Raw supports a limited subset; arbitrary functions, CAST, bindings and subqueries are unsupported. Complete SELECT statements and additional clauses or statements are rejected. A successful import replaces the current query; a failed import leaves it unchanged.',
    queryPlaceholder: 'WHERE "main"."users"."status" = \'online\' AND "main"."users"."active" IS TRUE',
  },
  operators: sqliteOperators,
  fieldModifiers: sqliteFieldModifiers,
  generateWhereSql: generateSqliteWhereSql,
  generateConditionSql: generateSqliteConditionSql,
  importSqlFilter: importSqliteWhere,
  parseRawCondition: parseSqliteRawCondition,
  importSchemaSql: importSqliteSchema,
}
