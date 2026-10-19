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
    schemaHelp: 'Paste MariaDB CREATE TABLE statements with explicit columns to populate field autocomplete. Use backticks for identifiers. One table produces column names; multiple tables produce qualified names. Types and constraints do not configure the query builder. CREATE TABLE LIKE, AS SELECT and unsupported schema clauses are rejected. Import uses the same SQL-mode assumptions as query import.',
    schemaPlaceholder: 'CREATE TABLE `users` (\n  `status` VARCHAR(32),\n  `deleted_at` DATETIME\n);',
    queryHelp: 'Paste a MariaDB filter expression, with or without WHERE. For example: WHERE `status` = \'online\' AND `deleted_at` IS NULL. Combine conditions with AND, OR, NOT and parentheses. Use backticks for identifiers and single quotes for text. Import assumes ANSI_QUOTES, NO_BACKSLASH_ESCAPES, HIGH_NOT_PRECEDENCE, PIPES_AS_CONCAT, ORACLE and EMPTY_STRING_IS_NULL are disabled. Supported conditions become editable fields; other accepted expressions remain in Raw mode. Complete SELECT statements, additional clauses or statements, executable comments and optimizer hints are rejected. A successful import replaces the current query; a failed import leaves it unchanged.',
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
