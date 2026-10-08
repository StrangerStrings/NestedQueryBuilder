import { assertSqliteUnicode } from './unicode'

// Quote decoded segments without reinterpreting literal dots or repairing names.
export function quoteSqliteIdentifierSegments(parts: readonly string[]): string {
  if (!Array.isArray(parts) || parts.length < 1 || parts.length > 3) {
    throw new Error('SQLite field references require one to three identifier segments.')
  }
  const quoted: string[] = []
  for (const part of parts) {
    if (typeof part !== 'string' || !part || part === '*') {
      throw new Error('SQLite identifier segments must be nonempty strings and cannot be wildcards.')
    }
    assertSqliteUnicode(part, 'SQLite identifier segments')
    if (part.includes('.')) {
      throw new Error('Literal dots in SQLite identifier segments cannot be represented by the field model.')
    }
    if (part !== part.trim()) {
      throw new Error('SQLite identifier segments cannot have significant leading or trailing whitespace.')
    }
    quoted.push(`"${part.replaceAll('"', '""')}"`)
  }
  return quoted.join('.')
}

// Treat dots in model fields only as qualification separators, identically on either side.
export function quoteSqliteField(field: string): string {
  if (typeof field !== 'string') throw new Error('A SQLite field name must be a string.')
  return quoteSqliteIdentifierSegments(field.split('.'))
}
