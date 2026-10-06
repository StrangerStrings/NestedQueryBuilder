import { postgresqlAdapter } from './postgresql/adapter'
import { mysqlAdapter } from './mysql/adapter'
import type { DatabaseAdapter } from '../types/databaseAdapter'

export const databaseDefinitions = {
  postgresql: postgresqlAdapter,
  mysql: mysqlAdapter
} satisfies Record<string, DatabaseAdapter>

export type DatabaseId = keyof typeof databaseDefinitions
