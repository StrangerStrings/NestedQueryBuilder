import { importCompatibleWhere, parseCompatibleRawCondition } from '../../shared/mysqlMariaDb/parsing/importWhere'
import { generateMariadbConditionSql } from '../serialisation/generateConditionSql'
import { importMariadbCondition } from './importCondition'
import { parseMariadbWhere } from './parseWhere'
import { validateMariadbRaw } from './validateRaw'

const mariadbFilterOperations = {
  parse: parseMariadbWhere,
  importCondition: importMariadbCondition,
  generateCondition: generateMariadbConditionSql,
  validateRaw: validateMariadbRaw,
}

// Build the complete imported tree before the store can replace its existing query.
export function importMariadbWhere(sql: string) {
  return importCompatibleWhere(sql, mariadbFilterOperations)
}

// Convert one complete MariaDB raw condition only when every part is visually representable.
export function parseMariadbRawCondition(sql: string) {
  return parseCompatibleRawCondition(sql, mariadbFilterOperations)
}
