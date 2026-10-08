type DecimalKey = { negative: boolean; digits: string; exponent: bigint }
type NumericValueResult = { success: true; value: number } | { success: false; reason: string }

// Compare decimal coefficients and arbitrary-size exponents without expanding powers of ten.
function decimalKey(spelling: string): DecimalKey {
  const match = /^([+-]?)([0-9]*)(?:\.([0-9]*))?(?:[eE]([+-]?[0-9]+))?$/.exec(spelling)
  if (!match || !(match[2] || match[3])) throw new Error('A decimal numeric token is required.')
  const fraction = match[3] ?? ''
  const coefficient = `${match[2] ?? ''}${fraction}`.replace(/^0+/, '')
  if (!coefficient) return { negative: false, digits: '0', exponent: 0n }
  const digits = coefficient.replace(/0+$/, '')
  const exponent = BigInt(match[4] ?? '0') - BigInt(fraction.length) + BigInt(coefficient.length - digits.length)
  return { negative: match[1] === '-', digits, exponent }
}

// Admit only numbers whose exact decimal value and SQLite token category survive regeneration.
export function sqliteVisualNumber(spelling: string, tokenName: string): NumericValueResult {
  if (tokenName !== 'INTEGER' && tokenName !== 'FLOAT') throw new Error('An intact SQLite numeric token is required.')
  if (/^[+-]?0[xX]/.test(spelling)) {
    return { success: false, reason: 'Hexadecimal literals require Raw mode.' }
  }
  const original = decimalKey(spelling)
  const value = Number(spelling)
  if (!Number.isFinite(value)) {
    return { success: false, reason: 'Numeric overflow cannot be represented by the visual editor.' }
  }
  if (Object.is(value, -0)) {
    return { success: false, reason: 'Negative zero requires Raw mode to preserve its sign.' }
  }
  const rendered = String(value)
  const regenerated = decimalKey(rendered)
  if (original.negative !== regenerated.negative || original.digits !== regenerated.digits ||
      original.exponent !== regenerated.exponent) {
    return { success: false, reason: 'Numeric precision or underflow cannot be preserved by the visual editor.' }
  }
  if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
    return { success: false, reason: 'Integers outside the safe visual numeric range require Raw mode.' }
  }
  const originalReal = tokenName === 'FLOAT' || /[.eE]/.test(spelling)
  if (originalReal && !/[.eE]/.test(rendered)) {
    return { success: false, reason: 'This real literal would regenerate as an integer token; Raw mode preserves its numeric category.' }
  }
  return { success: true, value }
}
