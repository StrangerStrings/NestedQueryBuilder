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
    schemaHelp: 'Paste MySQL CREATE TABLE statements with explicit columns to populate field autocomplete. Use backticks for identifiers. One table produces column names; multiple tables produce qualified names. Types and constraints do not configure the query builder. CREATE TABLE LIKE and AS SELECT are unsupported. Parsing assumes ANSI_QUOTES and NO_BACKSLASH_ESCAPES are disabled.',
    schemaPlaceholder: 'CREATE TABLE `users` (\n  `status` VARCHAR(32),\n  `deleted_at` DATETIME\n);',
    queryHelp: 'Paste a MySQL filter expression, with or without WHERE. For example: WHERE `status` = \'online\' AND `deleted_at` IS NULL. Combine conditions with AND, OR, NOT and parentheses. Use backticks for identifiers and single quotes for text. Import assumes ANSI_QUOTES, NO_BACKSLASH_ESCAPES, HIGH_NOT_PRECEDENCE and PIPES_AS_CONCAT are disabled. NULL-safe equality (<=>) treats two NULLs as equal; literal NULL comparisons stay Raw. REGEXP/NOT REGEXP use native patterns from text or field references without added wildcards or LIKE escapes. LENGTH counts bytes; CHAR_LENGTH counts characters. IS TRUE/IS FALSE and IS NOT TRUE/IS NOT FALSE are native truth tests with no value input: true means nonzero, false means zero, and the NOT forms also match NULL. YEAR, MONTH and DAYOFMONTH extract numeric date parts; DATE extracts the date without the time. Each modifier takes one field, with MySQL handling types and no timezone conversion added. Supported conditions become editable fields; other expressions remain in Raw mode when safe. Complete SELECT statements and additional clauses or statements are unsupported. A successful import replaces the current query; a failed import leaves it unchanged.',
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
