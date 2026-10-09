# Elasticsearch Query DSL subset

The [adapter](../src/databases/elasticsearch/adapter.ts) connects the existing operator catalogue, condition and root generators, query importer and mapping importer. [DatabaseDefinitions](../src/databases/DatabaseDefinitions.ts) registers it alongside PostgreSQL, MySQL, MariaDB and SQLite. The display slot says **Query DSL subset**, without a verified version range. This mode generates JSON; it does not execute queries, connect to clusters or provide a backend. SQL formatting is bypassed and output is highlighted as JSON with the existing plain-text fallback.

This document records source inspection only. Examples and outcomes are source-derived expectations, not executed results.

## Filter context and import boundaries

Canonical output contains only a `query` member, whose `bool.filter` array wraps the generated clause. A valid import/help example is:

```json
{"query":{"bool":{"filter":[{"term":{"status":"online"}}]}}}
```

The importer also accepts a bare supported Boolean query object, but starts it in query context. Supported leaves must be reached through `filter` or `must_not`. Scoring-context term, match and other leaves, including scoring leaves under `must`/`should`, are rejected rather than normalized into filters. A `must`/`should` descendant already within filter context can be represented. Unsupported request members such as sort, size and aggregations fail; no request options are silently dropped.

A condition preview is a standalone clause, for example `{"term":{"status":"online"}}`. It cannot be imported directly because it would be a scoring leaf; place it inside `query.bool.filter` as above. Bare `{"match_all":{}}` and `{"query":{"match_all":{}}}` likewise cannot be imported directly. The sole admitted constant shape is the canonical empty root (with or without the query-only envelope):

```json
{"query":{"bool":{"filter":[{"match_all":{}}]}}}
```

[Group generation](../src/databases/elasticsearch/serialisation/generateGroupSql.ts) preserves nested `all`, `any` and `none` groups as `filter`, `should` with numeric `minimum_should_match: 1`, and `must_not`. Valid empty groups are omitted; an effectively empty root receives the canonical empty envelope. Invalid children fail the entire generation with a node ID where available. Import accepts clause objects or nonempty clause arrays and required alternatives. Only numeric `1` or string `"1"` thresholds are supported; optional should branches are rejected. The whole-query importer does not automatically fall back to Raw for unsupported clauses.

Raw conditions accept one JSON query clause, including a complete Boolean subtree, and allow clauses and options beyond the visual editor. Input must parse as a nonempty object with exactly one top-level member; clause names and clause-specific options are not validated. Ordinary JSON parsing and serialization apply, including formatting changes and numeric rounding. Empty, malformed or structurally invalid input displays an inline error and blocks complete query generation. Returning to Editor clears the condition while retaining its identity and group position. Raw retains the existing filter context; request-level sorting, pagination, aggregations and scoring control are outside its scope. Visual-editor and whole-query importer restrictions remain unchanged.

## Operators and values

| Editor operators | Query DSL and permitted values |
| --- | --- |
| Exact term / not exact term | `term`; text, number, Boolean, date or datetime |
| Any / no exact term in list | `terms`; nonempty homogeneous list of those types |
| Greater/less than, with inclusive variants | One native `range` bound; text, number, date or datetime |
| Between / not between | One native `range` with `gte` and `lte`; two homogeneous endpoints of those types |
| Exists / missing | `exists` or its negation; no value |
| Analyzed match / phrase | `match` / `match_phrase`; text |
| Indexed term prefix / wildcard | `prefix` / `wildcard`; text |

Negative operators wrap the positive clause in `bool.must_not`. They can match missing fields; add an `exists` condition if indexed presence is required. Exists concerns indexed values rather than `_source` presence. Null and empty arrays normally lack indexed values; empty strings can have them. Indexing exclusions and mapping settings such as null substitution affect this behavior.

Term/terms, prefix and wildcard operate on indexed terms without analyzing supplied text; matching depends on mapping/indexed terms. Match and match_phrase use field analysis. Omitted parameters are left to Elasticsearch defaults. Primitive shorthand remains supported. In the visual editor and whole-query importer, object forms require `value` (or `query` for match/phrase) and may include only the supported parameters below; terms lookup is excluded.

| Editor operators | Optional parameters | Editor choices / canonical JSON values |
| --- | --- | --- |
| Analyzed match | `operator`, `fuzziness` | Any / All → `"or"` / `"and"`; Auto / 0 / 1 / 2 → `"AUTO"` / `0` / `1` / `2` |
| Analyzed phrase | `slop` | Nonnegative safe integer number |
| Exact term / not exact term, indexed term prefix / wildcard | `case_insensitive` | On / Off → `true` / `false` |

Parameters are stored as unique rows alongside each condition's operator and value. Multiple supported parameters can be configured on match. The editor starts the first supported row when expanded: Any for `operator`, Auto for `fuzziness`, 0 for `slop`, and Off for `case_insensitive`. These are explicit row values, not values inserted for omitted parameters. Changing a parameter selection resets it to its starting value. The add button selects the first unused parameter and is disabled when every supported parameter is present. Changing the condition operator removes unsupported rows.

The **Optional Parameters** settings control appears only for these Elasticsearch operators, including not exact term. Configured conditions reopen expanded. Closing the details panel, selecting another condition or navigating away preserves parameters. **Collapsing clears all parameters**; reopening starts a fresh first row. Slop uses a numeric input with minimum 0 and step 1, prevents letters, and stores blank, unfinished or invalid input as an invalid draft. Generation is blocked until the draft is corrected or removed; values are not rounded, clamped or restored on blur. Native controls provide keyboard operation, labels, expanded and Boolean state, visible focus, and focus transfer after a focused row is removed. Each configured row adds exactly one `*` beside the displayed operator, including Off and zero, without visible parameter summaries.

Import accepts lowercase `or`/`and` and uppercase `OR`/`AND`, case variants of `AUTO`, and numeric or string `0`/`1`/`2` fuzziness. Export normalizes these to lowercase `or`/`and`, uppercase `AUTO` and numeric fuzziness. Explicit false and zero are preserved. For example, a configured match may generate:

```json
{"query":{"bool":{"filter":[{"match":{"message":{"query":"quick fox","operator":"and","fuzziness":"AUTO"}}}]}}}
```

The visual editor and whole-query importer do not support analyzer options, boost, custom fuzziness thresholds, parameters on terms/list operators or other unmodeled settings. Invalid imported parameters fail rather than being dropped. Negated term queries retain `case_insensitive` inside their term clause.

Between remains **one range**, so one indexed value must satisfy both bounds. For a field containing `[5, 25]`, an inclusive range 10–20 does not become two separate comparisons satisfied by different values. Imported ranges allow one bound or exactly the inclusive `gte`/`lte` pair; mixed/exclusive two-bound forms and range options are unsupported. Bounds are preserved without reordering or evaluation.

Visual-editor and whole-query import [validation](../src/databases/elasticsearch/validation.ts) retains primitive types, including false and zero. Numbers must be finite, and integer values must fit JavaScript's safe-integer range (−9007199254740991 to 9007199254740991). [Source-number validation](../src/databases/elasticsearch/parsing/readJsonSource.ts) rejects consumed query tokens that overflow or nonzero tokens that underflow to zero. Ordinary floating-point rounding remains; arbitrary decimal precision is not promised. JSON strings remain text on import, including date-looking strings.

Date and datetime editor values use the shared calendar validator: `YYYY-MM-DD` and local `YYYY-MM-DDTHH:mm:ss`, at seconds precision without fractions or timezone conversion. Mapping formats and stored values must be compatible; importing a date_nanos suggestion does not add nanosecond editing. Standalone time, duration, field references and field modifiers are excluded from the visual editor. Field names are preserved without SQL quoting or path splitting, and must be nonempty without surrounding whitespace, NUL or line breaks.

Wildcard uses `*` for zero or more characters and `?` for one; patterns are JSON strings and receive no added wildcards. Cluster restrictions can prevent execution: see the official [wildcard](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-wildcard-query), [prefix](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-prefix-query) and [range](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-range-query) references for expensive-query settings and applicable exceptions. The builder does not inspect those settings or validate execution against mappings.

## Mapping suggestions and exclusions

[Mapping import](../src/databases/elasticsearch/schema/importSchema.ts) accepts these typeless shapes:

```json
{"properties":{"status":{"type":"keyword"}}}
```

```json
{"mappings":{"properties":{"status":{"type":"keyword"}}}}
```

```json
{"logs":{"mappings":{"properties":{"status":{"type":"keyword"}}}}}
```

Ordinary objects traverse declared `properties`; scalar `fields` traverse declared multi-fields. `message` with `fields.exact` produces `message` and `message.exact`, never an invented `message.keyword`. Suggestions preserve spelling, declaration order and deduplicate full paths; index names are not prefixed. Supported leaves are text, match_only_text, keyword, constant_keyword, wildcard, boolean, byte, short, integer, long, unsigned_long, half_float, float, double, scaled_float, date, date_nanos and ip.

Nested subtrees and unsupported specialized types (including aliases, geo/vector/flattened types) are excluded with explicit field/type/reason warnings. Supported fields remain importable. If no supported leaves remain, import fails with exclusions in the error. Legacy typed mappings, multi-index responses, malformed structures and unrepresentable names fail atomically. Runtime fields and dynamic templates are metadata, not suggestions. Ordinary mapping metadata is admitted without emulating its effects. Mapping import provides autocomplete, not operator configuration or mapping-aware execution validation.

## Source-inspection traces

| Scenario | Inspected path and expected behavior |
| --- | --- |
| Nested all/any/none | `generateGroupSql.ts` recursively preserves Boolean groups; `importWhere.ts` propagates filter context and reconstructs fresh groups without flattening away requirements |
| Escaped quotes, backslashes and newline text literals | `readJsonSource.ts` decodes JSON strings and retains source locations; `importLeafCondition.ts` retains decoded strings; `generateConditionSql.ts` uses JSON.stringify to re-escape literals |
| Term false and term zero | Leaf scalar conversion uses typeof, validation accepts primitive false/0, and generation reads hasValue rather than testing literal truthiness |
| Native multivalued range | Condition generation uses a single range object with both endpoints; leaf import maps that pair to between, never two independent bound clauses |
| Generated-query round trips | Root generation wraps every supported clause under filter; import traverses that context, admits the generated threshold and revalidates via root generation. Empty output uses the explicitly recognized canonical constant shape. IDs/group wrappers or imported date value types may differ; byte-for-byte tree fidelity is not claimed |
| Scoring rejection | `importWhere.ts` begins in query context; supported scoring leaves fail before leaf conversion. Top-level match_all fails; only the canonical empty filter shape bypasses constant rejection |
| Declared multi-fields and ordinary objects | `importSchema.ts` traverses properties and fields only, joins declared names and adds supported leaves to an ordered Set |
| Partial mapping feedback | Mapping importer returns supported fields plus warnings; `queryStore.ts` replaces suggestions only on success; `SchemaImport.vue` shows “with exclusions” and a named warnings list in a polite status region |

[ConditionPanel](../src/components/ConditionPanel.vue) exposes the adapter’s Raw JSON controls; [ConditionFieldInput](../src/components/ConditionFieldInput.vue) gates modifier controls on a nonempty modifier catalogue. The adapter omits field modifiers. ConditionValueInput menus intersect operator dataTypes, which exclude field references, duration and standalone time. [DatabaseList](../src/components/DatabaseList.vue) retains named buttons, pressed state, decorative local images, keyboard activation and the second activation of the same different target before switching. Its code and the PostgreSQL default/startup example in [queryStore](../src/stores/queryStore.ts) were unchanged in this stage. All four existing registry entries remain intact. The [local SVG provenance](../src/assets/databases/README.md) records the Simple Icons source and CC0 notice; no runtime external image request is introduced.

## Verification limits

No tests were created or changed. No tests, formatting, linting, Vue/TypeScript type checks, builds, parser harnesses, browser/runtime validation or cluster execution were performed. Runtime behavior and automated validation remain unperformed. Stage completion means ready for source review.
