import type { DatabaseAdapter } from '../../types/databaseAdapter'
import sqliteIcon from '../../assets/databases/sqlite.svg'
import { sqliteOperators } from './operators'
import { sqliteFieldModifiers } from './modifiers'
import { generateSqliteWhereSql } from './serialisation/generateWhereSql'
import { generateSqliteConditionSql } from './serialisation/generateConditionSql'
import { importSqliteWhere, parseSqliteRawCondition } from './parsing/importWhere'
import { importSqliteSchema } from './schema/importSchema'

const compatibilityHelp = 'Library compatibility limits reject native SPACE tokens equal to the three-character sequence U+00EF U+00BB U+00BF (ï»¿) and unquoted native ID tokens beginning with the distinct actual U+FEFF character. These are library limitations, not invalid SQLite syntax or global character bans: otherwise-supported quoted, string, comment and embedded-identifier occurrences remain allowed. Quoted leading/trailing U+FEFF names still follow the field model’s surrounding-whitespace limits.'

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
    schemaHelp: [
      'Paste SQLite 3.37+ subset CREATE TABLE statements with explicit columns, including TEMP/TEMPORARY, IF NOT EXISTS and database qualifiers. Ordinary columns may be typeless or have parameterized types. Supported constraints include PRIMARY KEY, NOT NULL, UNIQUE, DEFAULT, CHECK, COLLATE and REFERENCES/FOREIGN KEY within the supported subset; generated columns, CREATE TABLE AS SELECT and other statements are excluded.',
      'STRICT and WITHOUT ROWID are supported, separately or comma-separated together. STRICT requires INT, INTEGER, REAL, TEXT, BLOB or ANY without parameters. Only declared fields are extracted: types and constraints do not infer editor types or rowid fields, and syntax acceptance does not guarantee execution validity.',
      'One distinct unqualified table yields unqualified columns; multiple tables yield table.column. An explicit database qualifier always yields database.table.column, even for one table. Use double quotes for identifiers and single quotes for text. Names with literal dots or significant surrounding whitespace cannot become schema suggestions.',
      'Imports are atomic: any unsupported statement, clause or name leaves previous suggestions and the submitted draft intact.',
      compatibilityHelp,
    ].join(' '),
    schemaPlaceholder: 'CREATE TABLE main.users (\n  id INTEGER PRIMARY KEY,\n  status TEXT,\n  active INTEGER,\n  created_at TEXT\n) STRICT, WITHOUT ROWID;',
    queryHelp: [
      'Paste a SQLite 3.37+ subset filter expression with optional WHERE and at most one trailing semicolon. Full SELECT statements, additional clauses and additional statements are excluded. Combine conditions with AND, OR, NOT and parentheses. Use separately double-quoted identifier segments and single-quoted text.',
      'Visual conditions support comparisons, IN/NOT IN, inclusive BETWEEN/NOT BETWEEN, null checks, null-safe IS/IS NOT, LIKE/NOT LIKE and GLOB/NOT GLOB. Negative predicates retain SQL NULL behavior. LIKE uses % and _ with ordinary ASCII-only case folding; GLOB uses *, ?, and bracket patterns and is ordinarily case-sensitive. Runtime overrides or configuration can change matching behavior. Visual LIKE adds neither ESCAPE nor wildcards; backslashes remain ordinary characters.',
      'Core field modifiers are lower, upper (ordinary ASCII-only case conversion), trim, ltrim, rtrim (U+0020 spaces), length (characters for text), abs and round (zero decimal places). Runtime storage types and function overrides affect results.',
      'Boolean editor values generate 1/0, for example "active" IS 1; TRUE/FALSE expressions and truth tests such as active IS TRUE retain Raw source and are not converted to numeric comparisons. Temporal values emit exact YYYY-MM-DD, HH:mm:ss and YYYY-MM-DDTHH:mm:ss text with seconds precision and no timezone conversion, assuming corresponding stored text. Ordinary imported strings stay text.',
      'Validated Raw preserves mixed/NULL/empty lists, precision-sensitive numbers, comments, nested allowlisted modifiers, two-argument trim/ltrim/rtrim/round, modified right-hand fields, constant single-character LIKE ESCAPE, BINARY/NOCASE/RTRIM collations and truth tests. Supported scalar Raw forms include unary, arithmetic, concatenation, bitwise and scalar predicates, CASE, blobs, hexadecimal integers and CURRENT_DATE/CURRENT_TIME/CURRENT_TIMESTAMP. Otherwise-supported quoted names with literal dots or significant surrounding whitespace remain Raw and cannot become visual fields or schema suggestions.',
      'Raw is a bounded subset: arbitrary functions, CAST, bindings, subqueries, JSON, MATCH and REGEXP remain excluded. Raw source is revalidated before generation and preserved in displayed and copied SQL. Raw-to-visual conversion requires one fully representable condition; failure preserves Raw state. A successful filter import replaces the query; failed filter/schema imports preserve prior state and the submitted draft.',
      compatibilityHelp,
    ].join(' '),
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
