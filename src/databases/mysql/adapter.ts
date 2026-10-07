import type { DatabaseAdapter } from '../../types/databaseAdapter'
import mysqlIcon from '../../assets/databases/mysql.svg'
import { mysqlOperators } from './operators'
import { mysqlFieldModifiers } from './modifiers'
import { generateMysqlConditionSql } from './serialisation/generateConditionSql'
import { generateMysqlWhereSql } from './serialisation/generateWhereSql'
import { importMysqlWhere, parseMysqlRawCondition } from './parsing/importWhere'
import { importMysqlSchema } from './schema/importSchema'

export const mysqlAdapter: DatabaseAdapter = {
  id: 'mysql',
  label: 'MySQL',
  version: '8.4',
  icon: mysqlIcon,
  queryFormat: {
    formatterDialect: 'mysql',
    highlightLanguage: 'sql',
  },
  helpText: {
    schemaHelp: 'Paste MySQL CREATE TABLE statements with explicit column definitions to populate field autocomplete. Use backticks for quoted identifiers. One distinct table produces column names; multiple tables produce qualified names. Types and constraints do not configure the query builder. CREATE TABLE LIKE and CREATE TABLE AS SELECT are not supported. Identifier names containing literal dots or surrounding whitespace cannot be represented. Parsing assumes ANSI_QUOTES and NO_BACKSLASH_ESCAPES are disabled.',
    schemaPlaceholder: 'CREATE TABLE `users` (\n  `status` VARCHAR(32),\n  `deleted_at` DATETIME\n);',
    queryHelp: 'Paste a MySQL 8.4 filter expression, with or without the WHERE keyword, rather than a complete SELECT statement. For example: WHERE `status` = \'online\' AND `deleted_at` IS NULL. Combine conditions with AND, OR, NOT and parentheses. Use backticks for identifiers and single quotes for text values. Import assumes ANSI_QUOTES, NO_BACKSLASH_ESCAPES, HIGH_NOT_PRECEDENCE and PIPES_AS_CONCAT are disabled. Supported conditions become editable fields; other expressions remain in Raw mode when they can be preserved safely. Additional statements and SELECT clauses are not supported. A successful import replaces the current query; a failed import leaves it unchanged.',
    queryPlaceholder: 'WHERE `status` = \'online\' AND `deleted_at` IS NULL',
  },
  operators: mysqlOperators,
  fieldModifiers: mysqlFieldModifiers,
  generateConditionSql: generateMysqlConditionSql,
  generateWhereSql: generateMysqlWhereSql,
  importSqlFilter: importMysqlWhere,
  importSchemaSql: importMysqlSchema,
  parseRawCondition: parseMysqlRawCondition,
}
