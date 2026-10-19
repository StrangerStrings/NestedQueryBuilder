import type { DatabaseOperator, ValueDataType } from '../../types/databaseOperator'

const primitiveTypes: ValueDataType[] = ['text', 'number', 'boolean']
const orderedTypes: ValueDataType[] = ['text', 'number']

export const mongodbOperators = [
  {
    id: 'eq' as const,
    label: 'equals',
    description: 'Matches the supplied primitive value, including matching elements of an array field.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: primitiveTypes },
  },
  {
    id: 'ne' as const,
    label: 'does not equal',
    description: 'Matches fields unequal to the supplied primitive, including missing fields.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: primitiveTypes },
  },
  {
    id: 'gt' as const,
    label: 'greater than',
    description: 'Matches values greater than the supplied value.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: orderedTypes },
  },
  {
    id: 'gte' as const,
    label: 'greater than/equal',
    description: 'Matches values greater than or equal to the supplied value.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: orderedTypes },
  },
  {
    id: 'lt' as const,
    label: 'less than',
    description: 'Matches values less than the supplied value.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: orderedTypes },
  },
  {
    id: 'lte' as const,
    label: 'less than/equal',
    description: 'Matches values less than or equal to the supplied value.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: orderedTypes },
  },
  {
    id: 'in' as const,
    label: 'in list',
    description: 'Matches any listed primitive value, including matching elements of an array field.',
    valueInput: { hasValue: true, dataShape: 'list', dataTypes: primitiveTypes },
  },
  {
    id: 'nin' as const,
    label: 'not in list',
    description: 'Matches fields with none of the listed primitive values, including missing fields.',
    valueInput: { hasValue: true, dataShape: 'list', dataTypes: primitiveTypes },
  },
  {
    id: 'all' as const,
    label: 'contains all',
    description: 'Matches array fields containing every listed primitive value; this is not exact-array equality.',
    valueInput: { hasValue: true, dataShape: 'list', dataTypes: primitiveTypes },
  },
  {
    id: 'type' as const,
    label: 'has type',
    description: 'Matches a BSON type alias or numeric code, including array elements. The alias "array" matches the array itself.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: orderedTypes },
  },
  {
    id: 'type_list' as const,
    label: 'has any listed type',
    description: 'Matches any listed BSON type, including array elements; "array" matches the array itself. Use a nonempty list of aliases or numeric codes, without mixing them.',
    valueInput: { hasValue: true, dataShape: 'list', dataTypes: orderedTypes },
  },
  {
    id: 'regex' as const,
    label: 'matches regex',
    description: 'Matches text using a native MongoDB regular expression. Optional Parameters provides yes/no controls for i (case-insensitive), m (multiline anchors), s (dot matches newlines), and x (ignore unescaped whitespace and allow comments). Patterns and inline flags are preserved; imported u is retained.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['text'] },
  },
  {
    id: 'size' as const,
    label: 'array size',
    description: 'Matches array fields with exactly the supplied nonnegative integer number of elements.',
    valueInput: { hasValue: true, dataShape: 'single', dataTypes: ['number'] },
  },
  {
    id: 'exists' as const,
    label: 'exists',
    description: 'Matches fields present in the document, including null values.',
    valueInput: { hasValue: false },
  },
  {
    id: 'missing' as const,
    label: 'missing',
    description: 'Matches fields that are absent from the document.',
    valueInput: { hasValue: false },
  },
  {
    id: 'equals_null' as const,
    label: 'equals null',
    description: 'Uses MongoDB null equality, matching null values and missing fields.',
    valueInput: { hasValue: false },
  },
  {
    id: 'not_equals_null' as const,
    label: 'does not equal null',
    description: 'Uses MongoDB null inequality, matching existing fields with non-null values.',
    valueInput: { hasValue: false },
  },
] satisfies DatabaseOperator[]

export type MongoDBOperator = (typeof mongodbOperators)[number]
