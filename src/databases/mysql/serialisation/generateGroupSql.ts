import type { SqlResult } from '../../../types/databaseAdapter'
import type { QueryGroup } from '../../../types/query'
import { renderQueryGroup } from '../../shared/mysqlMariaDb/serialisation/renderQueryGroup'
import { generateMysqlConditionSql } from './generateConditionSql'

// Preserve MySQL's group policy and raw validation through its own condition exporter.
export function generateMysqlGroupSql(group: QueryGroup): SqlResult {
  return renderQueryGroup(group, generateMysqlConditionSql, 'Invalid MySQL group.')
}
