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
  version: 'Query DSL subset',
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
    schemaHelp: 'Paste a typeless mapping containing properties, a mappings wrapper, or one index’s Get Mapping response containing only mappings. Ordinary object properties become dotted field paths; declared multi-fields are included, but no .keyword field is invented. Supported leaves include text/keyword variants, Boolean, numeric, date/date_nanos and IP fields. Nested subtrees and unsupported specialized types are excluded with visible reasons while supported fields are imported. If none remain, import fails. Legacy typed mappings and multi-index responses are unsupported. Runtime fields and dynamic templates do not produce suggestions. Suggestions do not configure operators, infer field types, validate cluster settings or establish execution validity. A failed import retains previous suggestions.',
    schemaPlaceholder: '{"properties":{"status":{"type":"keyword"},"message":{"type":"text","fields":{"exact":{"type":"keyword"}}},"active":{"type":"boolean"}}}',
    queryHelp: 'Paste Query DSL JSON with a query-only envelope, for example {"query":{"bool":{"filter":[{"term":{"status":"online"}}]}}}. Generation always uses filter context and does not execute queries. Imports requiring score normalization are rejected: leaves must be reached through filter or must_not; top-level scoring leaves and scoring must/should leaves are unsupported. A bare condition preview is only a clause, so wrap it in query.bool.filter before importing. Bare match_all cannot be imported directly; the empty query uses exactly {"query":{"bool":{"filter":[{"match_all":{}}]}}}. Combine filter clauses with bool filter, required should (minimum_should_match 1), and must_not. Optional should clauses and extra request members/options are unsupported. Exact term/terms, prefix and wildcard target indexed terms without analysis; match and match_phrase analyze text using field defaults. Exists checks indexed values, not source presence: null and empty arrays normally lack indexed values, empty strings may have them, and mapping settings can alter this. Negation can include missing fields; add exists when presence is required. Between emits one inclusive native range: on multivalued fields one indexed value must satisfy both bounds, rather than separate bounds matching different values. Numbers must be finite and integer values must be safe JavaScript integers; imports reject overflow and nonzero underflow, but decimals retain ordinary floating-point rounding. Date and datetime editor values use valid local YYYY-MM-DD and YYYY-MM-DDTHH:mm:ss strings, without fractions or timezone conversion; imported strings remain text. Field references, duration, standalone time, Raw mode and field modifiers are unavailable. Wildcard uses * for zero or more characters and ? for one, and patterns must use JSON string escaping; no wildcards are added. Mapping, analyzer and cluster settings govern behavior; expensive-query restrictions may block wildcard, prefix or text/keyword range queries. Successful import replaces the query; failure leaves it unchanged.',
    queryPlaceholder: '{"query":{"bool":{"filter":[{"term":{"status":"online"}}]}}}',
  },
  operators: elasticsearchOperators,
  generateConditionSql: generateElasticsearchConditionSql,
  generateWhereSql: generateElasticsearchWhereSql,
  importSqlFilter: importElasticsearchWhere,
  importSchemaSql: importElasticsearchSchema,
}
