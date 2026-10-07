import { parseMysqlMariaDbWhere } from '../../shared/mysqlMariaDb/parsing/parseWhere'
export type { SqlFilterExpression as MysqlExpression, SqlFilterToken as MysqlToken, SqlFilterParseResult as MysqlParseResult } from '../../shared/mysqlMariaDb/parsing/parseWhere'

// Preserve MySQL's grammar and comment policy through the shared parsing implementation.
export function parseMysqlWhere(filter: string) {
  return parseMysqlMariaDbWhere(filter, 'MySQL')
}
