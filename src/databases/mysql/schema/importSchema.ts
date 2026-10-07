import type { SchemaImportResult } from '../../../types/databaseAdapter'
import { importMysqlMariaDbSchema } from '../../shared/mysqlMariaDb/schema/importSchema'
import { quoteMysqlField } from '../identifiers'

const mysqlSchemaDialect = { name: 'MySQL', quoteField: quoteMysqlField } as const

// Preserve MySQL's schema grammar, identifier diagnostics, and suggestion conventions.
export function importMysqlSchema(sql: string): SchemaImportResult {
  return importMysqlMariaDbSchema(sql, mysqlSchemaDialect)
}
