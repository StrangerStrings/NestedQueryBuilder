import type { QueryCondition } from '../../../types/query'
import { parseWhere } from './parseWhere'
import { importWhereCondition } from './importWhereCondition'

// Convert a raw expression to an editable condition using the existing parser and errors.
export function parsePostgresqlRawCondition(sql: string):
  | { success: true; condition: QueryCondition }
  | { success: false; error: string } {
  const parsed = parseWhere(sql)
  if (!parsed.success) return parsed
  if (!parsed.expression) return { success: false, error: 'A condition expression is required.' }
  const result = importWhereCondition(parsed.expression)
  return result.success
    ? result
    : { success: false, error: `This expression requires Raw mode. ${result.error.message}` }
}
