import type { DatabaseAdapter } from '../../types/databaseAdapter'
import { postgresqlOperators } from './operators'
import { generateWhereSql as generatePostgresqlWhereSql } from './serialisation/generateWhereSql'
import { generatePostgresqlConditionSql } from './serialisation/generateConditionSql'
import { importSqlWhere as importPostgresqlWhere } from './parsing/importWhere'
import { importSchema as importPostgresqlSchema } from './schema/importSchema'
import { parsePostgresqlRawCondition } from './parsing/parseRawCondition'

export const postgresqlAdapter: DatabaseAdapter = {
  id: 'postgresql',
  label: 'PostgreSQL',
  sql: { formatterDialect: 'postgresql', highlightLanguage: 'sql' },
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
