import type { DatabaseAdapter } from '../../types/databaseAdapter'
import mongodbIcon from '../../assets/databases/mongodb.svg'
import { mongodbOperators } from './operators'
import { generateMongoDBConditionSql } from './serialisation/generateConditionSql'
import { generateMongoDBWhereSql } from './serialisation/generateWhereSql'
import { importMongoDBWhere } from './parsing/importWhere'
import { importMongoDBSchema } from './schema/importSchema'

export const mongodbAdapter: DatabaseAdapter = {
  id: 'mongodb',
  label: 'MongoDB',
  version: 'Primitive filter subset',
  icon: mongodbIcon,
  queryFormat: {
    formatterDialect: null,
    highlightLanguage: 'json',
  },
  presentation: {
    outputLabel: 'Filter JSON',
    queryImportLabel: 'MongoDB filter JSON to import',
    schemaImportLabel: 'MongoDB JSON Schema to import',
  },
  helpText: {
    schemaHelp: 'Paste a direct schema containing properties, a sole $jsonSchema wrapper, or a sole validator wrapper containing only $jsonSchema. Extraction provides names-only field suggestions: explicit property names, nested properties and object-array items.properties include container names and dotted descendant paths. Imports extract declared properties only and do not infer schemas or fields from sample documents. Literal periods and other unrepresentable names are skipped with visible warnings. Composition, references, patternProperties, additional-property schemas and tuple items do not produce suggestions and are reported as exclusions. If no usable fields remain, import fails. Suggestions do not infer editor types, restrict operators, enforce schema constraints, validate documents or establish execution validity; declaring BSON types does not enable typed BSON query values. Successful import replaces suggestions; failure retains previous suggestions.',
    schemaPlaceholder: '{"$jsonSchema":{"bsonType":"object","properties":{"status":{"bsonType":"string"},"profile":{"bsonType":"object","properties":{"active":{"bsonType":"bool"}}}}}}',
    queryHelp: 'Paste a bare MongoDB filter JSON object, for example {"status":{"$eq":"online"}}. Shell syntax, commands, request wrappers and execution are unavailable. Combine predicates with implicit AND, $and, $or and $nor. Supported field operators are $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $all, $regex, $size and Boolean $exists; primitive equality shorthand and null equality are accepted. Operands use strings, finite numbers and Booleans; lists must be nonempty and homogeneous. Use the dedicated equals null, does not equal null, exists and missing operators in the editor. Integer values must be safe JavaScript integers; imports reject overflow and nonzero underflow, while decimals retain ordinary floating-point rounding rather than exact decimal or BSON numeric precision. ObjectId, Date and other typed BSON or Extended JSON values, embedded-document/array equality, field references, Raw mode and field modifiers are unavailable. Regex uses a JSON-escaped pattern string without an $options member; patterns retain native MongoDB regex semantics, including inline flags, and are not compiled or validated as JavaScript regexes. $all means containing every listed value, not exact-array equality; $size means exact array length and requires a nonnegative safe integer. Null equality matches null or missing fields; null inequality requires an existing non-null value. Exists checks field presence, including null, rather than indexed-value existence; missing checks absence. Scalar equality can match array elements, and $nin can match missing fields. Separate bounds or dotted predicates need not match the same array element; same-element matching with $elemMatch is unsupported. Compatibility depends on the target server; no universal server-version baseline is guaranteed and version-dependent null behavior is not normalized. Root {} is accepted and generated for an empty query; nested empty filters are rejected on import, and empty editor groups are pruned during generation. Successful import replaces the query; failure retains the current query. Generated standalone condition filters can also be imported.',
    queryPlaceholder: '{"$and":[{"status":{"$eq":"online"}},{"age":{"$gte":18}}]}',
  },
  operators: mongodbOperators,
  generateConditionSql: generateMongoDBConditionSql,
  generateWhereSql: generateMongoDBWhereSql,
  importSqlFilter: importMongoDBWhere,
  importSchemaSql: importMongoDBSchema,
}
