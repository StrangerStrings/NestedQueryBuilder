import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryGroup } from '../../../types/query'
import { renderQueryGroup } from '../../shared/mysqlMariaDb/serialisation/renderQueryGroup'
import { generateMariadbConditionSql } from './generateConditionSql'

// Combine MariaDB visual conditions with the established all/any/none and empty-group semantics.
export function generateMariadbGroupSql(group: QueryGroup): SqlResult {
  if (!group || group.kind !== 'group' || !Array.isArray(group.children)) {
    return { success: false, error: 'A MariaDB query group with a children array is required.', nodeId: group?.id }
  }
  return renderQueryGroup(group, generateMariadbConditionSql, 'Invalid MariaDB group.')
}
