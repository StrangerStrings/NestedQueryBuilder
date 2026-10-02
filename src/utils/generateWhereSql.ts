import type { QueryGroup } from '../types/query'
import { exportWhere } from './exportWhere'
import { serializeWhereExpression } from './serializeWhereExpression'

export type GenerateWhereSqlResult =
  | { success: true; sql: string }
  | { success: false; error: string; nodeId?: string }

// Export and serialize a complete filter, preserving conversion errors and their node IDs.
export function generateWhereSql(root: QueryGroup): GenerateWhereSqlResult {
  const exported = exportWhere(root)
  if (!exported.success) return exported
  if (exported.expression === null) return { success: true, sql: '' }

  const serialized = serializeWhereExpression(exported.expression)
  if (!serialized.success) return serialized

  return { success: true, sql: `WHERE ${serialized.sql}` }
}
