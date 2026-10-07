import { mysqlOperators } from '../mysql/operators'

// Reuse every compatible MySQL entry; only pattern help needs a MariaDB display name.
export const mariadbOperators = mysqlOperators.map((operator) => {
  if (!operator.helpText) return operator
  return { ...operator, helpText: operator.helpText.replace('MySQL output', 'MariaDB output') }
})
