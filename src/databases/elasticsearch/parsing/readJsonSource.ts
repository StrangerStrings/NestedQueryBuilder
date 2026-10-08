import type { FilterImportResult } from '../../../types/databaseAdapter'

/** Paths use $["decoded key"][arrayIndex]; offsets and lengths use UTF-16 units. */
export type JsonSourceLocation = {
  readonly path: string
  readonly offset: number
  readonly length: number
  readonly fragment: string
}
export type JsonSourceNumber = JsonSourceLocation & { readonly value: number }
export type JsonSourceDocument = {
  readonly value: unknown
  readonly locations: ReadonlyMap<string, JsonSourceLocation>
  readonly numbers: ReadonlyMap<string, JsonSourceNumber>
}
export type JsonSourceResult<T> =
  | { success: true; value: T }
  | { success: false; error: JsonSourceError }

// Carry import-compatible failures together with their original source evidence.
export class JsonSourceError extends Error {
  readonly kind: Extract<FilterImportResult, { success: false }>['error']['kind']
  readonly path: string
  readonly offset: number
  readonly length: number
  readonly fragment: string

  // Include the path and offset in messages so schema callers can also report plain errors.
  constructor(kind: JsonSourceError['kind'], message: string, location: JsonSourceLocation) {
    super(`${message} At ${location.path} (UTF-16 offset ${location.offset}): ${JSON.stringify(location.fragment)}.`)
    this.name = 'JsonSourceError'
    this.kind = kind
    this.path = location.path
    this.offset = location.offset
    this.length = location.length
    this.fragment = location.fragment
  }
}

// Validate complete JSON and decoded key uniqueness before materializing the document.
export function readJsonSource(source: string): JsonSourceResult<JsonSourceDocument> {
  let offset = 0
  const locations = new Map<string, JsonSourceLocation>()
  const numbers = new Map<string, JsonSourceNumber>()

  // Capture an exact half-open range in the submitted source.
  function location(path: string, start: number, end: number): JsonSourceLocation {
    return { path, offset: start, length: end - start, fragment: source.slice(start, end) }
  }

  // Stop at the offending source range without losing the current value path.
  function syntax(message: string, path: string, start = offset, end = Math.min(source.length, offset + 1)): never {
    throw new JsonSourceError('syntax', message, location(path, start, end))
  }

  // Consume only the four whitespace characters admitted by JSON grammar.
  function whitespace(): void {
    while (offset < source.length && /[ \t\r\n]/.test(source.charAt(offset))) offset += 1
  }

  // Validate and decode strings locally, including escape-equivalent object keys.
  function string(path: string): string {
    const start = offset
    offset += 1
    let decoded = ''
    while (offset < source.length) {
      const character = source.charAt(offset)
      offset += 1
      if (character === '"') return decoded
      if (character.charCodeAt(0) < 0x20) syntax('Unescaped control character in JSON string.', path, offset - 1, offset)
      if (character !== '\\') {
        decoded += character
        continue
      }
      const escapeStart = offset - 1
      const escape = source.charAt(offset)
      offset += 1
      if (escape === 'u') {
        const digits = source.slice(offset, offset + 4)
        if (!/^[0-9a-fA-F]{4}$/.test(digits)) {
          syntax('Invalid JSON Unicode escape.', path, escapeStart, Math.min(source.length, offset + 4))
        }
        decoded += String.fromCharCode(Number.parseInt(digits, 16))
        offset += 4
      } else {
        switch (escape) {
          case '"': decoded += '"'; break
          case '\\': decoded += '\\'; break
          case '/': decoded += '/'; break
          case 'b': decoded += '\b'; break
          case 'f': decoded += '\f'; break
          case 'n': decoded += '\n'; break
          case 'r': decoded += '\r'; break
          case 't': decoded += '\t'; break
          default: syntax('Invalid JSON string escape.', path, escapeStart, Math.min(source.length, offset))
        }
      }
    }
    syntax('Unterminated JSON string.', path, start, source.length)
  }

  // Retain the complete numeric spelling while applying grammar rather than query policy.
  function number(path: string): void {
    const start = offset
    while (offset < source.length && !/[ \t\r\n,\]}]/.test(source.charAt(offset))) offset += 1
    const token = source.slice(start, offset)
    if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(token)) {
      syntax('Invalid JSON number.', path, start, offset)
    }
    numbers.set(path, { ...location(path, start, offset), value: Number(token) })
  }

  // Read members and reject repeated decoded names independently within each object.
  function object(path: string): void {
    offset += 1
    whitespace()
    const keys = new Set<string>()
    if (source.charAt(offset) === '}') {
      offset += 1
      return
    }
    while (true) {
      if (source.charAt(offset) !== '"') syntax('Expected a JSON object key.', path)
      const keyStart = offset
      const key = string(path)
      const childPath = `${path}[${JSON.stringify(key)}]`
      if (keys.has(key)) syntax('Duplicate decoded JSON object key.', childPath, keyStart, offset)
      keys.add(key)
      whitespace()
      if (source.charAt(offset) !== ':') syntax('Expected a colon after JSON object key.', childPath)
      offset += 1
      value(childPath)
      whitespace()
      if (source.charAt(offset) === '}') {
        offset += 1
        return
      }
      if (source.charAt(offset) !== ',') syntax('Expected a comma or closing object brace.', path)
      offset += 1
      whitespace()
    }
  }

  // Read array elements with paths that distinguish indices from string object keys.
  function array(path: string): void {
    offset += 1
    whitespace()
    if (source.charAt(offset) === ']') {
      offset += 1
      return
    }
    let index = 0
    while (true) {
      value(`${path}[${index}]`)
      index += 1
      whitespace()
      if (source.charAt(offset) === ']') {
        offset += 1
        return
      }
      if (source.charAt(offset) !== ',') syntax('Expected a comma or closing array bracket.', path)
      offset += 1
    }
  }

  // Dispatch one JSON value and preserve its entire original source range.
  function value(path: string): void {
    whitespace()
    const start = offset
    const character = source.charAt(offset)
    if (character === '{') object(path)
    else if (character === '[') array(path)
    else if (character === '"') string(path)
    else if (character === '-' || /[0-9]/.test(character)) number(path)
    else if (source.startsWith('true', offset)) offset += 4
    else if (source.startsWith('false', offset)) offset += 5
    else if (source.startsWith('null', offset)) offset += 4
    else syntax('Expected a JSON value.', path)
    locations.set(path, location(path, start, offset))
  }

  try {
    value('$')
    whitespace()
    if (offset !== source.length) syntax('Expected exactly one JSON document; trailing content is unsupported.', '$', offset, source.length)
    return { success: true, value: { value: JSON.parse(source), locations, numbers } }
  } catch (error) {
    return { success: false, error: error instanceof JsonSourceError
      ? error
      : new JsonSourceError('syntax', error instanceof Error ? error.message : 'Invalid JSON source.', location('$', offset, offset)) }
  }
}

// Opt in only for consumed query literals; ignored mapping metadata needs grammar checks alone.
// Ordinary floating-point rounding remains a limitation; this does not promise decimal fidelity.
export function validateQueryNumber(token: JsonSourceNumber): JsonSourceResult<number> {
  const value = token.value
  const significand = token.fragment.split(/[eE]/)[0] ?? ''
  let message: string | undefined
  if (!Number.isFinite(value)) message = 'Elasticsearch query numbers must be finite; this token overflows.'
  else if (value === 0 && /[1-9]/.test(significand)) message = 'A nonzero Elasticsearch query number must not underflow to zero.'
  else if (Number.isInteger(value) && !Number.isSafeInteger(value)) message = 'Elasticsearch query integer values must be safe integers.'
  if (message) return { success: false, error: new JsonSourceError('unsupported-value', message, token) }
  return { success: true, value }
}
