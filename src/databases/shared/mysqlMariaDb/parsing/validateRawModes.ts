import type { SqlFilterExpression } from './parseWhere'

// Reject mode-sensitive opaque strings, NOT operands, and LIKE without an explicit escape.
export function rawModeError(expression: SqlFilterExpression): { success: false; error: string } | null {
  const tokens = expression.tokens
  for (const [index, token] of tokens.entries()) {
    const keyword = token.text.toUpperCase()
    if (token.text.startsWith('"') || (token.text.startsWith("'") && token.text.includes('\\')) || keyword === '||') {
      return { success: false, error: 'This raw expression depends on SQL string or operator modes. Use single-quoted strings with doubled apostrophes, UTF-8 hex literals, and explicit OR.' }
    }
    if (tokens[index - 1]?.text === '.' || tokens[index + 1]?.text === '.') continue
    if (keyword === 'NOT' && tokens[index - 1]?.text.toUpperCase() !== 'IS' && !['IN', 'BETWEEN', 'LIKE', 'REGEXP', 'RLIKE'].includes(tokens[index + 1]?.text.toUpperCase() ?? '')) {
      let depth = 0
      let end = -1
      if (tokens[index + 1]?.text === '(') {
        for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
          if (tokens[cursor]?.text === '(') depth += 1
          if (tokens[cursor]?.text === ')') depth -= 1
          if (depth === 0) { end = cursor; break }
        }
      }
      const next = end < 0 ? null : tokens[end + 1]?.text.toUpperCase() ?? ''
      if (next === null || !['', ')', ',', 'AND', 'OR', 'XOR', '&&'].includes(next)) {
        return { success: false, error: 'Parenthesize the complete operand of raw NOT to avoid SQL-mode-dependent precedence.' }
      }
    }
    if (keyword === 'LIKE') {
      const remaining = tokens.slice(index + 1)
      const escapeIndex = remaining.findIndex((candidate, offset) => candidate.text.toUpperCase() === 'ESCAPE' && remaining[offset - 1]?.text !== '.' && remaining[offset + 1]?.text !== '.')
      const nextLike = remaining.findIndex((candidate, offset) => candidate.text.toUpperCase() === 'LIKE' && remaining[offset - 1]?.text !== '.' && remaining[offset + 1]?.text !== '.')
      if (escapeIndex < 0 || (nextLike >= 0 && escapeIndex > nextLike)) {
        return { success: false, error: 'Raw LIKE requires an explicit ESCAPE clause to preserve its pattern behavior across SQL modes.' }
      }
    }
  }
  return null
}
