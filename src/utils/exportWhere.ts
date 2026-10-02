import type { QueryGroup } from '../types/query'
import { exportWhereGroup, type ExportWhereGroupResult } from './exportWhereGroup'

export type ExportWhereResult = ExportWhereGroupResult

// Export the entire query tree atomically, retaining the offending node ID on failure.
export function exportWhere(root: QueryGroup): ExportWhereResult {
  return exportWhereGroup(root)
}
