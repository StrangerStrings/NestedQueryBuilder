// Quote raw identifier segments independently; never interpret field names as SQL expressions.
export function quoteMysqlField(field: string): string {
  const parts = field.trim().split('.').map((part) => part.trim())
  if (parts.length > 3 || parts.some((part) => !part || part === '*')) {
    throw new Error('A plain or qualified field reference is required.')
  }
  for (const part of parts) {
    if (part.length > 64) throw new Error('MySQL identifier segments must not exceed 64 characters.')
    for (const character of part) {
      const codePoint = character.codePointAt(0) ?? 0
      if (codePoint === 0 || codePoint > 0xffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        throw new Error('MySQL identifiers require valid BMP characters and cannot contain NUL.')
      }
    }
  }
  return parts.map((part) => '`' + part.replaceAll('`', '``') + '`').join('.')
}

