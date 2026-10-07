import type { DatabaseAdapter } from '../../types/databaseAdapter'
import postgresqlIcon from '../../assets/databases/postgresql.svg'
import { postgresqlOperators } from './operators'
import { generateWhereSql as generatePostgresqlWhereSql } from './serialisation/generateWhereSql'
import { generatePostgresqlConditionSql } from './serialisation/generateConditionSql'
import { importSqlWhere as importPostgresqlWhere } from './parsing/importWhere'
import { importSchema as importPostgresqlSchema } from './schema/importSchema'
import { parsePostgresqlRawCondition } from './parsing/parseRawCondition'

export const postgresqlAdapter: DatabaseAdapter = {
  id: 'postgresql',
  label: 'PostgreSQL',
  version: '18',
  icon: postgresqlIcon,
  queryFormat: {
    formatterDialect: 'postgresql',
    highlightLanguage: 'sql',
  },
  helpText: {
    schemaHelp: 'Paste PostgreSQL CREATE TABLE statements with explicit column definitions to populate field autocomplete. Use double quotes for case-sensitive or unusual identifiers. One distinct table produces column names; multiple tables produce table-qualified names, including the schema when supplied. Types and constraints do not configure the query builder. CREATE TABLE LIKE and statements other than CREATE TABLE are not supported.',
    schemaPlaceholder: 'CREATE TABLE users (\n  status TEXT,\n  deleted_at TIMESTAMP\n);',
    queryHelp: 'Paste a PostgreSQL filter expression, with or without the WHERE keyword, rather than a complete SELECT statement. For example: WHERE status = \'online\' AND deleted_at IS NULL. Combine conditions with AND, OR, NOT and parentheses. Use double quotes for identifiers and single quotes for text values. Conditions supported by the visual editor become editable fields; other expressions remain in Raw mode when the parser can preserve them. Additional statements and SELECT clauses are not supported. A successful import replaces the current query; a failed import leaves it unchanged.',
    queryPlaceholder: 'WHERE status = \'online\' AND deleted_at IS NULL',
  },
  operators: postgresqlOperators,
  fieldModifiers: [
    'lower', 'upper', 'trim', 'ltrim', 'rtrim', 'initcap', 'reverse',
    'length', 'abs', 'round', 'floor', 'ceil', 'trunc', 'sqrt',
  ],
  generateConditionSql: generatePostgresqlConditionSql,
  generateWhereSql: generatePostgresqlWhereSql,
  importSqlFilter: importPostgresqlWhere,
  importSchemaSql: importPostgresqlSchema,
  parseRawCondition: parsePostgresqlRawCondition,
}
