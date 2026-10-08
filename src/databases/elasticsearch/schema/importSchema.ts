import type { SchemaImportResult } from '../../../types/databaseAdapter'
import { readJsonSource } from '../parsing/readJsonSource'
import { validateElasticsearchFieldName } from '../validation'

const supportedLeafTypes = new Set([
  'text', 'match_only_text', 'keyword', 'constant_keyword', 'wildcard',
  'boolean', 'byte', 'short', 'integer', 'long', 'unsigned_long',
  'half_float', 'float', 'double', 'scaled_float', 'date', 'date_nanos', 'ip',
])
const mappingMetadata = new Set([
  '_meta', '_source', '_routing', '_field_names', '_size', '_data_stream_timestamp',
  'dynamic', 'enabled', 'subobjects', 'date_detection', 'numeric_detection',
  'dynamic_date_formats', 'dynamic_templates', 'runtime',
])

// Append a decoded member name using the JSON source reader's path convention.
function memberPath(path: string, key: string): string {
  return `${path}[${JSON.stringify(key)}]`
}

// Distinguish declared members from inherited names without normalizing their spelling.
function hasMember(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

// Resolve mapping wrappers by structure, then extract supported suggestions atomically with exclusions.
export function importElasticsearchSchema(source: string): SchemaImportResult {
  const parsed = readJsonSource(source)
  if (!parsed.success) return { success: false, error: parsed.error.message }
  const document = parsed.value
  const fields = new Set<string>()
  const warnings: string[] = []

  // Identify the offending JSON path without returning partially extracted suggestions.
  function fail(message: string, path: string): never {
    throw new Error(`${message} At ${path}.`)
  }

  // Require objects at mapping, property-container and field-definition positions.
  function object(value: unknown, path: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      fail('Expected an Elasticsearch mapping object.', path)
    }
    return value as Record<string, unknown>
  }

  // Recover declaration order even for integer-like keys reordered by JSON.parse.
  function entries(value: Record<string, unknown>, path: string): [string, unknown][] {
    // Compare original value offsets rather than JavaScript object enumeration order.
    return Object.entries(value).sort(([left], [right]) =>
      document.locations.get(memberPath(path, left))!.offset - document.locations.get(memberPath(path, right))!.offset,
    )
  }

  // Validate both declared names and joined paths without trimming or SQL quoting.
  function fieldPath(parent: string, name: string, path: string): string {
    try {
      validateElasticsearchFieldName(name)
      const joined = parent ? `${parent}.${name}` : name
      validateElasticsearchFieldName(joined)
      return joined
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Unrepresentable Elasticsearch field name.', path)
    }
  }

  // Walk only declared properties or multi-fields, keeping actual names and source order.
  function traverse(value: unknown, path: string, parent: string, multiFields = false): void {
    const container = object(value, path)
    for (const [name, definition] of entries(container, path)) {
      const definitionPath = memberPath(path, name)
      const field = fieldPath(parent, name, definitionPath)
      const mapping = object(definition, definitionPath)
      const hasType = hasMember(mapping, 'type')
      const hasProperties = hasMember(mapping, 'properties')
      const hasFields = hasMember(mapping, 'fields')
      const type = mapping.type
      if (hasType && (typeof type !== 'string' || !type.length)) {
        fail(`Field ${JSON.stringify(field)} requires a nonempty string type.`, memberPath(definitionPath, 'type'))
      }
      if (typeof type === 'string' && type !== 'object' && !supportedLeafTypes.has(type)) {
        const reason = type === 'nested'
          ? 'nested queries are unsupported; the entire subtree is excluded'
          : 'this specialized field type is outside the supported subset; the field and any descendants are excluded'
        warnings.push(`Excluded field ${JSON.stringify(field)} (type ${JSON.stringify(type)}): ${reason}.`)
        continue
      }
      if (type === 'object' || (!hasType && hasProperties)) {
        if (multiFields || hasFields) {
          fail(`Object field ${JSON.stringify(field)} cannot be a multi-field or declare fields; use properties.`, definitionPath)
        }
        if (hasProperties) traverse(mapping.properties, memberPath(definitionPath, 'properties'), field)
        continue
      }
      if (!hasType) {
        fail(`Field ${JSON.stringify(field)} needs a supported type or an ordinary properties container.`, definitionPath)
      }
      if (hasProperties) {
        fail(`Scalar field ${JSON.stringify(field)} cannot declare properties; use an object container.`, memberPath(definitionPath, 'properties'))
      }
      fields.add(field)
      if (hasFields) traverse(mapping.fields, memberPath(definitionPath, 'fields'), field, true)
    }
  }

  try {
    const root = object(document.value, '$')
    let mapping = root
    let path = '$'
    const rootKeys = Object.keys(root)
    const soleMember = rootKeys.length === 1 ? root[rootKeys[0]!] : undefined
    const indexCandidate = soleMember && typeof soleMember === 'object' && !Array.isArray(soleMember)
      ? soleMember as Record<string, unknown>
      : undefined
    const wrappedMapping = indexCandidate && hasMember(indexCandidate, 'mappings')
      ? indexCandidate.mappings
      : undefined
    if (wrappedMapping && typeof wrappedMapping === 'object' && !Array.isArray(wrappedMapping)
      && hasMember(wrappedMapping as Record<string, unknown>, 'properties')) {
      const indexPath = memberPath('$', rootKeys[0]!)
      if (Object.keys(indexCandidate!).length !== 1) {
        fail('Expected one index containing only mappings.', indexPath)
      }
      path = memberPath(indexPath, 'mappings')
      mapping = object(wrappedMapping, path)
    } else if (!hasMember(root, 'properties')) {
      if (hasMember(root, 'mappings')) {
        if (Object.keys(root).length !== 1) {
          fail('Paste only a mappings wrapper or one index\'s Get Mapping response.', '$')
        }
        path = memberPath('$', 'mappings')
        mapping = object(root.mappings, path)
      } else {
        const keys = Object.keys(root)
        if (keys.length > 1) {
          fail('Ambiguous or unsupported mapping response. Paste one index\'s typeless mapping; multi-index responses are unsupported.', '$')
        }
        if (keys.length !== 1) {
          fail('Include a typeless mapping containing properties.', '$')
        }
        const indexPath = memberPath('$', keys[0]!)
        const index = object(root[keys[0]!], indexPath)
        if (!hasMember(index, 'mappings') || Object.keys(index).length !== 1) {
          fail('Expected one index containing mappings. Legacy typed mappings are unsupported; paste a typeless mapping containing properties.', indexPath)
        }
        path = memberPath(indexPath, 'mappings')
        mapping = object(index.mappings, path)
      }
    }
    if (!hasMember(mapping, 'properties')) {
      fail('A typeless mapping must contain properties. Legacy typed mappings are unsupported; remove the mapping-type wrapper.', path)
    }
    for (const key of Object.keys(mapping)) {
      if (key !== 'properties' && !mappingMetadata.has(key)) {
        fail('Unsupported mapping member or legacy mapping type. Paste one typeless mapping containing properties and ordinary mapping metadata.', memberPath(path, key))
      }
    }
    traverse(mapping.properties, memberPath(path, 'properties'), '')
    if (!fields.size) {
      return {
        success: false,
        error: `No supported mapping leaves remain. Include declared text/keyword, Boolean, numeric, date/date_nanos or IP fields outside excluded subtrees.${warnings.length ? ` Exclusions: ${warnings.join(' ')}` : ''}`,
      }
    }
    return { success: true, fields: [...fields], warnings }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Elasticsearch mapping import failed.' }
  }
}
