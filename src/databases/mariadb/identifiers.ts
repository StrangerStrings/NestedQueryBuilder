import { quoteBacktickField } from '../shared/mysqlMariaDb/serialisation/identifiers'

// Quote MariaDB identifiers using the compatible backtick rules and MariaDB diagnostics.
export function quoteMariadbField(field: string): string {
  return quoteBacktickField(
    field,
    'MariaDB identifier segments must not exceed 64 characters.',
    'MariaDB identifiers require valid BMP characters and cannot contain NUL.',
  )
}
