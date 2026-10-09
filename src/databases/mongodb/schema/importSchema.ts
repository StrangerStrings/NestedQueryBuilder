import type { SchemaImportResult } from '../../../types/databaseAdapter'
import { JsonSourceError, readJsonSource } from '../../shared/parsing/readJsonSource'
import { validateMongoDBFieldName } from '../validation'

const sourceGuidance = 'Paste a direct schema containing properties, a sole $jsonSchema wrapper, or a sole validator wrapper containing only $jsonSchema.'

// Append literal member names using the shared source reader's path convention.
function memberPath(path: string, key: string): string {
  return `${path}[${JSON.stringify(key)}]`
}

// Distinguish explicit declarations from inherited object members.
function hasMember(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

// Extract declared MongoDB names atomically, reporting paths excluded from suggestions.
export function importMongoDBSchema(source: string): SchemaImportResult {
  const parsed = readJsonSource(source)
  if (!parsed.success) return { success: false, error: parsed.error.message }
  const document = parsed.value
  const fields = new Set<string>()
  const warnings: string[] = []

  // Abort extraction with the original source path and value rather than partial suggestions.
  function fail(message: string, path: string): never {
    const location = document.locations.get(path) ?? document.locations.get('$')!
    throw new JsonSourceError('unsupported-expression', message, location)
  }

  // Require object-shaped schemas, property containers and definitions at consumed positions.
  function object(value: unknown, path: string, description: string, guidance = ''): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      fail(`Expected a MongoDB ${description} object.${guidance ? ` ${guidance}` : ''}`, path)
    }
    return value as Record<string, unknown>
  }

  // Recover declaration order for integer-like names from original source value offsets.
  function entries(value: Record<string, unknown>, path: string): [string, unknown][] {
    // Compare source offsets instead of JavaScript's reordered integer-key enumeration.
    return Object.entries(value).sort(([left], [right]) =>
      document.locations.get(memberPath(path, left))!.offset - document.locations.get(memberPath(path, right))!.offset,
    )
  }

  // Report unsupported declaration sources without inspecting them for field names.
  function collectExclusions(schema: Record<string, unknown>, path: string): void {
    for (const [key, value] of entries(schema, path)) {
      let reason: string | undefined
      if (['allOf', 'anyOf', 'oneOf', 'not'].includes(key)) {
        reason = 'schema composition is not used to derive field suggestions; declare supported names in explicit properties'
      } else if (key === '$ref') {
        reason = 'schema references are not resolved for field suggestions; declare supported names in explicit properties'
      } else if (key === 'patternProperties') {
        reason = 'pattern-based declarations do not provide explicit field names for suggestions'
      } else if (key === 'additionalProperties' && value !== null && typeof value === 'object') {
        reason = 'additional-property schemas do not provide explicit field names for suggestions'
      } else if (key === 'items' && Array.isArray(value)) {
        reason = 'tuple-style items are not extracted; use one object items schema with explicit properties'
      }
      if (reason) warnings.push(`Excluded ${memberPath(path, key)}: ${reason}.`)
    }
  }

  // Diagnose consumed container declarations without assigning editor types or restrictions.
  function validateStructure(schema: Record<string, unknown>, path: string): void {
    for (const key of ['type', 'bsonType']) {
      if (!hasMember(schema, key)) continue
      const declarationPath = memberPath(path, key)
      const declaration = schema[key]
      const types = Array.isArray(declaration) ? declaration : [declaration]
      if (!types.length || types.some(
        // Nullable declarations still require every listed type to be a nonempty string.
        type => typeof type !== 'string' || !type.length,
      )) {
        fail(`MongoDB ${key} must be a nonempty type name or a nonempty array of type names; use "null" for nullable declarations.`, declarationPath)
      }
      if (hasMember(schema, 'properties') && !types.includes('object')) {
        fail(`MongoDB properties requires ${key} to allow "object"; remove the conflicting declaration or use an object type, optionally with "null".`, declarationPath)
      }
      if (hasMember(schema, 'items') && !types.includes('array')) {
        fail(`MongoDB items requires ${key} to allow "array"; remove the conflicting declaration or use an array type, optionally with "null".`, declarationPath)
      }
    }
  }

  // Exclude unrepresentable names and descendants without inventing paths from literal periods.
  function fieldPath(parent: string, name: string, path: string): string | undefined {
    if (name.includes('.')) {
      warnings.push(`Excluded ${path} and its descendants: literal periods in MongoDB property names cannot be represented as declared nested paths; use ordinary nested properties.`)
      return undefined
    }
    const field = parent ? `${parent}.${name}` : name
    try {
      validateMongoDBFieldName(name)
      validateMongoDBFieldName(field)
    } catch (error) {
      warnings.push(`Excluded ${path} and its descendants: ${error instanceof Error ? error.message : 'Unrepresentable MongoDB property name.'}`)
      return undefined
    }
    return field
  }

  // Preserve declaration order and structural failures, even inside excluded name subtrees.
  function traverse(value: unknown, path: string, parent: string | undefined): void {
    const properties = object(value, path, 'properties container')
    for (const [name, value] of entries(properties, path)) {
      const definitionPath = memberPath(path, name)
      const definition = object(value, definitionPath, 'property definition')
      validateStructure(definition, definitionPath)
      collectExclusions(definition, definitionPath)
      const field = parent === undefined ? undefined : fieldPath(parent, name, definitionPath)
      if (field !== undefined) fields.add(field)
      for (const [key, child] of entries(definition, definitionPath)) {
        const childPath = memberPath(definitionPath, key)
        if (key === 'properties') {
          traverse(child, childPath, field)
        } else if (key === 'items' && !Array.isArray(child)) {
          const items = object(child, childPath, 'items schema')
          validateStructure(items, childPath)
          collectExclusions(items, childPath)
          if (hasMember(items, 'properties')) {
            traverse(items.properties, memberPath(childPath, 'properties'), field)
          }
        }
      }
    }
  }

  try {
    if (!document.value || typeof document.value !== 'object' || Array.isArray(document.value)) {
      fail(`Expected a MongoDB schema source object. ${sourceGuidance}`, '$')
    }
    const root = document.value as Record<string, unknown>
    let schema = root
    let path = '$'
    if (hasMember(root, '$jsonSchema') || hasMember(root, 'validator')) {
      if (Object.keys(root).length !== 1) fail(sourceGuidance, '$')
      if (hasMember(root, 'validator')) {
        path = memberPath('$', 'validator')
        const validator = object(root.validator, path, 'validator wrapper', sourceGuidance)
        if (Object.keys(validator).length !== 1 || !hasMember(validator, '$jsonSchema')) {
          fail(sourceGuidance, path)
        }
        path = memberPath(path, '$jsonSchema')
        schema = object(validator.$jsonSchema, path, 'schema', sourceGuidance)
      } else {
        path = memberPath('$', '$jsonSchema')
        schema = object(root.$jsonSchema, path, 'schema', sourceGuidance)
      }
    }
    collectExclusions(schema, path)
    if (!hasMember(schema, 'properties')) {
      fail(`${sourceGuidance}${warnings.length ? ` Exclusions: ${warnings.join(' ')}` : ''}`, path)
    }
    validateStructure(schema, path)
    traverse(schema.properties, memberPath(path, 'properties'), '')
    if (!fields.size) {
      fail(`No usable explicitly declared MongoDB fields remain. Include representable names in properties or a supported object-array items.properties schema.${warnings.length ? ` Exclusions: ${warnings.join(' ')}` : ''}`, path)
    }
    return { success: true, fields: [...fields], warnings }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'MongoDB schema import failed.' }
  }
}
