import { importVisualCondition } from '../../shared/mysqlMariaDb/parsing/importCondition'
import type { MysqlExpression } from './parseWhere'
import { mysqlOperators } from '../operators'
import { mysqlFieldModifiers } from '../modifiers'
export type { VisualConditionResult as MysqlConditionResult } from '../../shared/mysqlMariaDb/parsing/importCondition'

// Preserve MySQL's visual catalogue, string decoding, and conversion diagnostics.
export function importMysqlCondition(expression: MysqlExpression) {
  return importVisualCondition(expression, mysqlOperators, mysqlFieldModifiers, 'MySQL')
}
