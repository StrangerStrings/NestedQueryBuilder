// Quote the common identifier syntax while callers supply their database-specific errors.
export function quoteBacktickField(field: string, lengthError: string, unicodeError: string): string {
  const parts = field.trim().split('.').map((part) => part.trim())
  if (parts.length > 3 || parts.some((part) => !part || part === '*')) {
    throw new Error('A plain or qualified field reference is required.')
  }
  for (const part of parts) {
    if (part.length > 64) throw new Error(lengthError)
    for (const character of part) {
      const codePoint = character.codePointAt(0) ?? 0
      if (codePoint === 0 || codePoint > 0xffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        throw new Error(unicodeError)
      }
    }
  }
  return parts.map((part) => '`' + part.replaceAll('`', '``') + '`').join('.')
}
