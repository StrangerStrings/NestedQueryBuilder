import type { DatabaseAdapter } from '../../types/databaseAdapter'
import { mariadbOperators } from './operators'
import { mariadbFieldModifiers } from './modifiers'
import { generateMariadbConditionSql } from './serialisation/generateConditionSql'
import { generateMariadbWhereSql } from './serialisation/generateWhereSql'
import { importMariadbWhere, parseMariadbRawCondition } from './parsing/importWhere'
import { importMariadbSchema } from './schema/importSchema'

export const mariadbAdapter: DatabaseAdapter = {
  id: 'mariadb',
  label: 'MariaDB 11.4 LTS',
  sql: {
    formatterDialect: 'mariadb',
    highlightLanguage: 'sql',
    helpText: 'Build or import MariaDB 11.4 LTS filters and export WHERE SQL. Import CREATE TABLE statements for field suggestions. Use normal MariaDB mode with ORACLE and EMPTY_STRING_IS_NULL disabled. Text comparisons follow the applicable column collation. Output uses explicit backslash LIKE escaping in both NO_BACKSLASH_ESCAPES modes. Use a utf8mb4 client connection for non-ASCII identifiers.',
    schemaExample: 'CREATE TABLE `users` (\n  `id` BIGINT PRIMARY KEY,\n  `status` VARCHAR(32) NOT NULL,\n  `deleted_at` DATETIME\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
    schemaHelpText: 'Use explicit CREATE TABLE column definitions and backticks for quoted identifiers. One distinct table gives plain column suggestions; multiple tables give qualified suggestions. Literal dots and surrounding whitespace in names cannot be represented. Import uses the same SQL-mode assumptions as filter import. Unsupported schema clauses, expressions, charsets and collations are rejected.',
    importHelpText: 'Import assumes MariaDB 11.4 LTS with ANSI_QUOTES, NO_BACKSLASH_ESCAPES, HIGH_NOT_PRECEDENCE, PIPES_AS_CONCAT, ORACLE, and EMPTY_STRING_IS_NULL disabled. Use backticks for identifiers. Only the established compatible filter subset is accepted; other syntax is rejected. Supported expressions that cannot be edited visually stay in Raw mode when safe. Raw strings must use single quotes with doubled apostrophes or UTF-8 hex text; raw LIKE requires explicit ESCAPE. Executable comments and optimizer hints are rejected.',
  },
  operators: mariadbOperators,
  fieldModifiers: mariadbFieldModifiers,
  generateConditionSql: generateMariadbConditionSql,
  generateWhereSql: generateMariadbWhereSql,
  importSqlFilter: importMariadbWhere,
  importSchemaSql: importMariadbSchema,
  parseRawCondition: parseMariadbRawCondition,
}
