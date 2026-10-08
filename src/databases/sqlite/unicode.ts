// Reject NUL and unpaired surrogates while retaining valid supplementary Unicode.
export function assertSqliteUnicode(value: string, context: string): void {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0
    if (codePoint === 0) throw new Error(`${context} cannot contain NUL.`)
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      throw new Error(`${context} must contain valid Unicode; unpaired surrogates are unsupported.`)
    }
  }
}
