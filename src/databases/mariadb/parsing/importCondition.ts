import { importVisualCondition } from '../../shared/mysqlMariaDb/parsing/importCondition'
import type { SqlFilterExpression } from '../../shared/mysqlMariaDb/parsing/parseWhere'
import { mariadbOperators } from '../operators'
import { mariadbFieldModifiers } from '../modifiers'

// Convert only the MariaDB editor's catalogue after its independent compatibility gate succeeds.
export function importMariadbCondition(expression: SqlFilterExpression) {
  return importVisualCondition(expression, mariadbOperators, mariadbFieldModifiers, 'MariaDB')
}
