import { quoteBacktickField } from '../shared/mysqlMariaDb/serialisation/identifiers'

// Quote raw MySQL identifiers using the common backtick rules and MySQL diagnostics.
export function quoteMysqlField(field: string): string {
  return quoteBacktickField(
    field,
    'MySQL identifier segments must not exceed 64 characters.',
    'MySQL identifiers require valid BMP characters and cannot contain NUL.',
  )
}
