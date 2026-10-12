import type { ValueDataType } from '../../../../types/databaseOperator'
import { isValidTemporal } from '../../../../utils/temporalValue'

// Keep ASCII readable; hex preserves other UTF-8 text under either backslash-escaping SQL mode.
function textSql(value: string): string {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      throw new Error(
        'Text values must contain valid Unicode; unpaired surrogates are unsupported.',
      )
    }
  }
  // oxlint-disable-next-line no-control-regex -- Control characters are intentionally validated.
  if (/[\\\u0000-\u001f\u007f-\uffff]/.test(value)) {
    const hex = Array.from(new TextEncoder().encode(value), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
    return `_utf8mb4 X'${hex}'`
  }
  return `'${value.replaceAll("'", "''")}'`
}

// Render only the agreed scalar subset; callers handle fields and dialect-specific value errors.
export function renderScalarLiteral(type: ValueDataType, value: unknown): string | undefined {
  if (type === 'text' && typeof value === 'string') return textSql(value)
  if (type === 'number' && typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (type === 'boolean' && typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if ((type === 'date' || type === 'time' || type === 'datetime') && typeof value === 'string') {
    if (!isValidTemporal(value, type) || (type !== 'time' && Number(value.slice(0, 4)) < 1000))
      return
    const target = type === 'datetime' ? 'DATETIME' : type.toUpperCase()
    return `CAST(${textSql(value.replace('T', ' '))} AS ${target})`
  }
}
