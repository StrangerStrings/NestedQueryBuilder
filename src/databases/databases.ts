import { postgresqlOperators } from './postgresql/operators'

export const databaseDefinitions = {
  postgresql: {
    id: 'postgresql',
    operators: postgresqlOperators,
  },
  elasticsearch: {
    id: 'elasticsearch',
    operators: [],
  },
} as const
