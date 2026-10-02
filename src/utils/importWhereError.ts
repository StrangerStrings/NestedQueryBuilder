import { toSql, type Expr } from 'pgsql-ast-parser'

export type ImportWhereError = {
  kind: 'syntax' | 'unsupported-expression' | 'unsupported-operator' | 'unsupported-value'
  message: string
  fragment?: string
}

// Describe an import failure and include the offending expression as SQL when available.
export function createImportWhereError(
  kind: ImportWhereError['kind'],
  message: string,
  expression?: Expr,
): ImportWhereError {
  const error: ImportWhereError = { kind, message }
  if (expression) {
    try {
      error.fragment = toSql.expr(expression)
    } catch {
      // Some unsupported AST nodes cannot be rendered as SQL.
    }
  }
  return error
}
