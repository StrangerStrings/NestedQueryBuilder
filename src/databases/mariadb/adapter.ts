import type { DatabaseAdapter } from '../../types/databaseAdapter'
import mariadbIcon from '../../assets/databases/mariadb.svg'
import { mariadbOperators } from './operators'
import { mariadbFieldModifiers } from './modifiers'
import { generateMariadbConditionSql } from './serialisation/generateConditionSql'
import { generateMariadbWhereSql } from './serialisation/generateWhereSql'
import { importMariadbWhere, parseMariadbRawCondition } from './parsing/importWhere'
import { importMariadbSchema } from './schema/importSchema'

export const mariadbAdapter: DatabaseAdapter = {
  id: 'mariadb',
  label: 'MariaDB',
  version: '11.4 LTS',
  icon: mariadbIcon,
  queryFormat: {
    formatterDialect: 'mariadb',
    highlightLanguage: 'sql',
  },
  helpText: {
    schemaHelp: 'Paste MariaDB 11.4 LTS CREATE TABLE statements with explicit column definitions to populate field autocomplete. Use backticks for quoted identifiers. One distinct table produces column names; multiple tables produce qualified names. Types and constraints do not configure the query builder. CREATE TABLE LIKE and CREATE TABLE AS SELECT are not supported. Identifier names containing literal dots or surrounding whitespace cannot be represented. Import uses the same SQL-mode assumptions as filter import and rejects unsupported schema clauses, expressions, character sets and collations.',
    schemaPlaceholder: 'CREATE TABLE `users` (\n  `status` VARCHAR(32),\n  `deleted_at` DATETIME\n);',
    queryHelp: 'Paste a MariaDB 11.4 LTS filter expression, with or without the WHERE keyword, rather than a complete SELECT statement. For example: WHERE `status` = \'online\' AND `deleted_at` IS NULL. Combine conditions with AND, OR, NOT and parentheses. Use backticks for identifiers and single quotes for text values. Import assumes ANSI_QUOTES, NO_BACKSLASH_ESCAPES, HIGH_NOT_PRECEDENCE, PIPES_AS_CONCAT, ORACLE and EMPTY_STRING_IS_NULL are disabled. Only the supported filter subset is accepted; conditions that cannot be edited visually remain in Raw mode when safe. Raw strings require doubled apostrophes or UTF-8 hex text, and raw LIKE requires explicit ESCAPE. Executable comments, optimizer hints, additional statements and SELECT clauses are rejected. A successful import replaces the current query; a failed import leaves it unchanged.',
    queryPlaceholder: 'WHERE `status` = \'online\' AND `deleted_at` IS NULL',
  },
  operators: mariadbOperators,
  fieldModifiers: mariadbFieldModifiers,
  generateConditionSql: generateMariadbConditionSql,
  generateWhereSql: generateMariadbWhereSql,
  importSqlFilter: importMariadbWhere,
  importSchemaSql: importMariadbSchema,
  parseRawCondition: parseMariadbRawCondition,
}
