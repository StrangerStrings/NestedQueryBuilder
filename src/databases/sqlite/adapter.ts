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
    queryHelp: 'Paste a SQLite filter expression, with or without WHERE. For example: WHERE status = \'online\' AND deleted_at IS NULL. Combine conditions with AND, OR, NOT and parentheses. Use double quotes for identifiers and single quotes for text. IS TRUE and IS FALSE test nonzero and zero after numeric conversion, not equality to 1/0; NULL matches neither, but matches IS NOT TRUE and IS NOT FALSE. The typeof field modifier returns the text null, integer, real, text or blob; typeof(NULL) returns the text \'null\'. The other built-in modifiers propagate NULL. Supported conditions become editable fields; other accepted expressions remain in Raw mode. Raw filter conditions also support coalesce (at least 2 arguments), ifnull, nullif and instr (exactly 2), substr (2 or 3), and replace (exactly 3). Every argument is validated, including nested calls. Raw also supports date, time, datetime and julianday (zero or more arguments), and strftime (at least a format argument). Omitting the time value uses SQLite’s current time, so results depend on execution time; import/export preserves the omission. Literal formats allow only %d, %f, %H, %j, %J, %m, %M, %s, %S, %w, %W, %Y and %%. Literal modifiers allow legacy numeric second/minute/hour/day/month/year shifts, HH:MM[:SS[.fraction]] shifts with an optional sign, start of day/month/year, weekday 0–6, unixepoch, localtime and utc. These checks also apply inside scalar parentheses; newer literals such as auto, julianday, subsec/subsecond, floor/ceiling and extended date shifts are rejected. Dynamic time values, formats and modifiers are recursively validated expressions; dynamic formats/modifiers cannot be guaranteed compatible with SQLite 3.37 at runtime. These scalar and date/time additions remain Raw on import and export, with no visual argument controls, and are unavailable in schema DEFAULT/CHECK expressions. Raw supports a limited subset; arbitrary functions, CAST, bindings and subqueries are unsupported. Complete SELECT statements and additional clauses or statements are rejected. A successful import replaces the current query; a failed import leaves it unchanged.',
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
