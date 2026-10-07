import { importCompatibleWhere, parseCompatibleRawCondition } from '../../shared/mysqlMariaDb/parsing/importWhere'
import { generateMysqlConditionSql } from '../serialisation/generateConditionSql'
import { importMysqlCondition } from './importCondition'
import { parseMysqlWhere } from './parseWhere'
import { validateMysqlRaw } from './validateRaw'

const mysqlFilterOperations = {
  parse: parseMysqlWhere,
  importCondition: importMysqlCondition,
  generateCondition: generateMysqlConditionSql,
  validateRaw: validateMysqlRaw,
}

// Import atomically with MySQL's existing parser, catalogue, exporter, and raw validation.
export function importMysqlWhere(sql: string) {
  return importCompatibleWhere(sql, mysqlFilterOperations)
}

// Convert only a complete supported MySQL raw condition to the visual editor.
export function parseMysqlRawCondition(sql: string) {
  return parseCompatibleRawCondition(sql, mysqlFilterOperations)
}
