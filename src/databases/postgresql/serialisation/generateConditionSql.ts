import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryCondition } from '../../../types/query'
import { exportWhereCondition } from './exportWhereCondition'
import { serializeWhereExpression } from './serializeWhereExpression'

// Export and serialize a selected condition, preserving validation errors.
export function generatePostgresqlConditionSql(condition: QueryCondition): SqlResult {
  const result = exportWhereCondition(condition)
  return result.success ? serializeWhereExpression(result.expression) : result
}
