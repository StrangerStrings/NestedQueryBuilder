import type { DatabaseAdapter } from '../../types/databaseAdapter'
import elasticsearchIcon from '../../assets/databases/elasticsearch.svg'
import { elasticsearchOperators } from './operators'
import { generateElasticsearchConditionSql } from './serialisation/generateConditionSql'
import { generateElasticsearchWhereSql } from './serialisation/generateWhereSql'
import { importElasticsearchWhere } from './parsing/importWhere'
import { importElasticsearchSchema } from './schema/importSchema'

export const elasticsearchAdapter: DatabaseAdapter = {
  id: 'elasticsearch',
  label: 'Elasticsearch',
  version: '7.14+',
  icon: elasticsearchIcon,
  queryFormat: {
    formatterDialect: null,
    highlightLanguage: 'json',
  },
  presentation: {
    outputLabel: 'Query DSL',
    queryImportLabel: 'Query DSL JSON to import',
    schemaImportLabel: 'Mapping JSON to import',
  },
  helpText: {
    schemaHelp: 'Paste a typeless mapping containing properties, a mappings wrapper, or a single-index Get Mapping response to populate field autocomplete. Object properties become dotted paths; declared multi-fields are included. Nested fields and unsupported types are skipped with warnings. Legacy typed mappings and multi-index responses are unsupported. Suggestions do not configure field types or operators. A failed import retains previous suggestions.',
    schemaPlaceholder:
      '{"properties":{"status":{"type":"keyword"},"message":{"type":"text","fields":{"exact":{"type":"keyword"}}},"active":{"type":"boolean"}}}',
    queryHelp:
      'Paste Query DSL JSON containing only a query member. For example: {"query":{"bool":{"filter":[{"term":{"status":"online"}}]}}}. Conditions must use filter or must_not context. Combine conditions with bool filter, must_not and required should clauses (minimum_should_match 1). Supported conditions become editable fields; unsupported clauses and options are rejected without falling back to Raw mode. Scoring queries, optional should clauses, sorting, pagination and aggregations are not supported. A successful import replaces the current query; a failed import leaves it unchanged.',
    queryPlaceholder: '{"query":{"bool":{"filter":[{"term":{"status":"online"}}]}}}',
  },
  operators: elasticsearchOperators,
  rawCondition: {
    label: 'Raw JSON',
    placeholder: '{"term":{"status":"online"}}',
    accessibleLabel: 'Raw Query DSL JSON condition',
    clearOnReturn: true,
  },
  generateConditionSql: generateElasticsearchConditionSql,
  generateWhereSql: generateElasticsearchWhereSql,
  importSqlFilter: importElasticsearchWhere,
  importSchemaSql: importElasticsearchSchema,
}
