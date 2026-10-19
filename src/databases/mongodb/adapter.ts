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
  version: '3.6+',
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
    schemaHelp: 'Paste a schema containing properties, a $jsonSchema wrapper, or a validator containing only $jsonSchema to populate field autocomplete. Declared properties, nested objects and object-array properties provide field names and dotted paths. Sample documents do not produce suggestions. Unsupported schema features and unrepresentable names are skipped with warnings. Suggestions do not configure field types, operators or validation. A failed import retains previous suggestions.',
    schemaPlaceholder:
      '{"$jsonSchema":{"bsonType":"object","properties":{"status":{"bsonType":"string"},"profile":{"bsonType":"object","properties":{"active":{"bsonType":"bool"}}}}}}',
    queryHelp: 'Paste a MongoDB filter JSON object. For example: {"status":{"$eq":"online"}}. Combine conditions with implicit AND, $and, $or and $nor. Use JSON strings, numbers, Booleans and supported null comparisons; {} represents an empty query. Supported conditions become editable fields; unsupported operators and values are rejected without falling back to Raw mode. Typed BSON, Extended JSON values, shell expressions, complete commands and aggregation pipelines are unsupported. A successful import replaces the current query; a failed import leaves it unchanged.',
    queryPlaceholder: '{"$and":[{"status":{"$eq":"online"}},{"age":{"$gte":18}}]}',
  },
  operators: mongodbOperators,
  rawCondition: {
    label: 'Raw MongoDB filter JSON',
    placeholder: '{"status":{"$eq":"online"}}',
    accessibleLabel: 'Raw MongoDB filter JSON condition',
    clearOnReturn: true,
  },
  generateConditionSql: generateMongoDBConditionSql,
  generateWhereSql: generateMongoDBWhereSql,
  importSqlFilter: importMongoDBWhere,
  importSchemaSql: importMongoDBSchema,
}
