export const postgresqlOperators = [
  { id: 'postgresql.eq', label: 'Equals', requiresValue: true },
  { id: 'postgresql.gt', label: 'Greater than', requiresValue: true },
  { id: 'postgresql.isNull', label: 'Is null', requiresValue: false },
] as const

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
