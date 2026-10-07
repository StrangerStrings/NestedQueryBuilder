import type { SchemaImportResult } from '../../../types/databaseAdapter'
import { importMysqlMariaDbSchema } from '../../shared/mysqlMariaDb/schema/importSchema'
import { quoteMariadbField } from '../identifiers'
import { validateMariadbSchemaTable } from './validateSchema'

const mariadbSchemaDialect = {
  name: 'MariaDB',
  quoteField: quoteMariadbField,
  validateTable: validateMariadbSchemaTable,
} as const

// Extract suggestions only after every statement satisfies the explicit MariaDB schema subset.
export function importMariadbSchema(sql: string): SchemaImportResult {
  return importMysqlMariaDbSchema(sql, mariadbSchemaDialect)
}
