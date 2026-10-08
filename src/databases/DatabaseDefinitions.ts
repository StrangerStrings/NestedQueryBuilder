import { postgresqlAdapter } from './postgresql/adapter'
import { mysqlAdapter } from './mysql/adapter'
import { mariadbAdapter } from './mariadb/adapter'
import { sqliteAdapter } from './sqlite/adapter'
import { elasticsearchAdapter } from './elasticsearch/adapter'
import type { DatabaseAdapter } from '../types/databaseAdapter'

export const databaseDefinitions = {
  postgresql: postgresqlAdapter,
  mysql: mysqlAdapter,
  mariadb: mariadbAdapter,
  sqlite: sqliteAdapter,
  elasticsearch: elasticsearchAdapter
} satisfies Record<string, DatabaseAdapter>

export type DatabaseId = keyof typeof databaseDefinitions
