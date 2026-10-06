import type { DatabaseAdapter } from '../../types/databaseAdapter'
import { mysqlOperators } from './operators'
import { mysqlFieldModifiers } from './modifiers'
import { generateMysqlConditionSql } from './serialisation/generateConditionSql'
import { generateMysqlWhereSql } from './serialisation/generateWhereSql'
import { importMysqlWhere, parseMysqlRawCondition } from './parsing/importWhere'
import { importMysqlSchema } from './schema/importSchema'

export const mysqlAdapter: DatabaseAdapter = {
  id: 'mysql',
  label: 'MySQL 8.4',
  sql: {
    formatterDialect: 'mysql',
    highlightLanguage: 'sql',
    importHelpText: 'Import assumes MySQL 8.4 with ANSI_QUOTES, NO_BACKSLASH_ESCAPES, HIGH_NOT_PRECEDENCE and PIPES_AS_CONCAT disabled. Use backticks for identifiers. Unsupported expressions remain opaque in Raw mode when they can be preserved safely.',
    helpText: 'Build or import MySQL filters and export WHERE SQL. Import CREATE TABLE statements for field suggestions.',
    schemaExample: 'CREATE TABLE `users` (\n  `id` BIGINT PRIMARY KEY,\n  `status` VARCHAR(32) NOT NULL,\n  `deleted_at` DATETIME\n) ENGINE=InnoDB;',
    schemaHelpText: 'Use backticks for quoted identifiers. One distinct table gives plain column suggestions; multiple tables give qualified suggestions. Literal dots and surrounding whitespace in identifier names cannot be represented. Parsing assumes ANSI_QUOTES and NO_BACKSLASH_ESCAPES are disabled.',
  },
  operators: mysqlOperators,
  fieldModifiers: mysqlFieldModifiers,
  generateConditionSql: generateMysqlConditionSql,
  generateWhereSql: generateMysqlWhereSql,
  importSqlFilter: importMysqlWhere,
  importSchemaSql: importMysqlSchema,
  parseRawCondition: parseMysqlRawCondition,
}
