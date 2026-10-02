# PostgreSQL filtering operator reference

Scope: PostgreSQL 18 **filtering operators and predicates**: all **529 Boolean-returning catalogue overloads across 52 symbols**, plus SQL predicates, aliases and common builder labels. Extension operators (for example PostGIS, hstore and pg_trgm) and user-defined operators depend on the database and are outside this built-in inventory. Catalogue coverage is taken from the [PostgreSQL 18 source](https://github.com/postgres/postgres/blob/11aed8d19cd71d2754ac10c71ec668280bd955f5/src/include/catalog/pg_operator.dat).

## Reading the four answers

- **Field types:** exact built-in operand signatures are grouped below. “Same type” means the field and value use that type. “Field → value” names a supported mixed pair. Implicit coercions can add usable SQL types: notably `varchar` → `text` and `cidr` → `inet`. Domains generally use their base type. PostgreSQL `"char"` is an internal one-byte type, not SQL `character(n)`. `timestamp` and `time` without an explicit suffix mean without time zone. `T` denotes a matching element/subtype; “compatible T” allows coercion to a common type. Range families include `int4range`, `int8range`, `numrange`, `daterange`, `tsrange`, `tstzrange` and their multiranges.
- **Values:** additional operands after choosing the field. A binary operator needs one value; a unary operator needs none. An array, JSON document, range or composite is one structured SQL value even if its editor contains multiple items.
- **Options:** includes SQL modifiers and type-sensitive behavior that can affect a control. These are design possibilities, not controls already implemented. Ordinary comparisons with a NULL input yield unknown; use explicit NULL predicates where needed.
- **Import:** “Limited today” means only a bare field reference on the left and a SQL **string literal** on the right for `=` or `>`. The current importer does not infer field types, recover casts, or accept numeric/Boolean/date literals. `IS NULL` accepts a bare field reference. `AND`, `OR` and `NOT` are recovered as groups when all nested leaves are supported. See [condition import](/Users/ben/Desktop/queryBuilder/src/utils/importWhereCondition.ts) and [group import](/Users/ben/Desktop/queryBuilder/src/utils/importWhere.ts).
- **“Yes in principle”** means an importer could preserve the explicit SQL syntax after implementing parser/AST handling and an appropriate value model. It does **not** assert that the installed `pgsql-ast-parser` supports every form. Resolving overloaded operator families may require schema metadata or explicit casts. Recovering a builder shorthand from equivalent arbitrary SQL is not always unique.

## SQL predicates and keyword spellings

These forms have SQL grammar of their own, or are aliases for catalogue symbols. Their type restrictions still depend on the underlying comparison or expression.

| Operator | Which field types support it? | How many values does it need? | Are there special options? | Can SQL import recover it? |
| --- | --- | --- | --- | --- |
| `BETWEEN` | Types supporting the corresponding ordering comparisons below. | 2 bounds | Inclusive endpoints; supplied bound order matters. | No today; yes in principle. |
| `NOT BETWEEN` | Types supporting the corresponding ordering comparisons below. | 2 bounds | Inclusive endpoints; supplied bound order matters. | No today; yes in principle. |
| `BETWEEN SYMMETRIC` | Types supporting the corresponding ordering comparisons below. | 2 bounds | Inclusive endpoints; SYMMETRIC accepts either bound order. | No today; yes in principle. |
| `NOT BETWEEN SYMMETRIC` | Types supporting the corresponding ordering comparisons below. | 2 bounds | Inclusive endpoints; SYMMETRIC accepts either bound order. | No today; yes in principle. |
| `IS DISTINCT FROM` | Types with a suitable equality comparison below. | 1 (may be NULL) | Treats NULL as a comparable value. | No today; yes in principle. |
| `IS NOT DISTINCT FROM` | Types with a suitable equality comparison below. | 1 (may be NULL) | Treats NULL as a comparable value. | No today; yes in principle. |
| `IS NULL` | All field types, including json, XML and composites. | 0 | Composite row null tests inspect members; SQL NULL differs from JSON null. | Yes today for a bare field. |
| `IS NOT NULL` | All field types, including json, XML and composites. | 0 | For composites, not always the inverse of IS NULL. | No direct form today; yes in principle. |
| `ISNULL` | All field types. | 0 | Nonstandard alias of IS NULL. | No dedicated handling today; parser normalization is unverified. |
| `NOTNULL` | All field types. | 0 | Nonstandard alias of IS NOT NULL. | No today; yes in principle. |
| `!=` | Same type pairs as <> below. | 1 | Alias of <>. | No today; yes in principle. |
| `IS TRUE` | boolean | 0 | Only true matches. Always returns true/false. | No today; yes in principle. |
| `IS NOT TRUE` | boolean | 0 | False and NULL match. Always returns true/false. | No today; yes in principle. |
| `IS FALSE` | boolean | 0 | Only false matches. Always returns true/false. | No today; yes in principle. |
| `IS NOT FALSE` | boolean | 0 | True and NULL match. Always returns true/false. | No today; yes in principle. |
| `IS UNKNOWN` | boolean | 0 | Only NULL matches. Always returns true/false. | No today; yes in principle. |
| `IS NOT UNKNOWN` | boolean | 0 | True and false match. Always returns true/false. | No today; yes in principle. |

Source: [comparison predicates](https://www.postgresql.org/docs/18/functions-comparison.html).

### Lists, quantified comparisons, rows and subqueries

| Operator | Which field types support it? | How many values does it need? | Are there special options? | Can SQL import recover it? |
| --- | --- | --- | --- | --- |
| `IN (value, …)` | Field/value types with suitable = comparison. | 1…N list items | NULL list members affect an unmatched result; empty list is invalid SQL. | No today; yes in principle. |
| `NOT IN (value, …)` | Field/value types with suitable <> comparison. | 1…N list items | NULL list members can make the result unknown. | No today; yes in principle. |
| `operator ANY(array)` | Left type supported by chosen operator; matching array element type. | 1 array (0…N items) | Choose comparison; ANY means at least one; empty array gives false. | No today; needs quantifier/array support. |
| `operator SOME(array)` | Same as ANY(array). | 1 array (0…N items) | Synonym of ANY. | No today; needs quantifier/array support. |
| `operator ALL(array)` | Left type supported by chosen operator; matching array element type. | 1 array (0…N items) | Choose comparison; ALL means every item; empty array gives true. | No today; needs quantifier/array support. |
| `IN (SELECT …)` | Scalar or row with compatible subquery columns. | 1 subquery | Row arity and equality support; subquery may return no rows. | No today; needs subquery support. |
| `NOT IN (SELECT …)` | Scalar or row with compatible subquery columns. | 1 subquery | NULL comparisons can produce unknown. | No today; needs subquery support. |
| `operator ANY(SELECT …)` | Scalar or row supported by the selected Boolean operator. | 1 subquery | At least one match; empty result gives false. | No today; needs subquery support. |
| `operator SOME(SELECT …)` | Same as ANY(subquery). | 1 subquery | Synonym of ANY. | No today; needs subquery support. |
| `operator ALL(SELECT …)` | Scalar or row supported by the selected Boolean operator. | 1 subquery | Every row must match; empty result gives true. | No today; needs subquery support. |
| `EXISTS (SELECT …)` | No field is required. | 1 subquery | Tests row existence; subquery output types do not matter. | No today; needs subquery support. |
| `NOT EXISTS (SELECT …)` | No field is required. | 1 subquery | Negates row existence. | No today; needs subquery support. |
| `operator (SELECT …)` | Scalar or row supported by the selected comparison. | 1 single-row subquery | More than one row raises an error; no rows gives NULL. | No today; needs subquery support. |
| `ROW(…) operator ROW(…)` | Matching row lengths; members must support the comparison. | 1 row (N components) | Member order and NULLs matter; row ordering needs B-tree comparison support. | No today; needs row-expression support. |

Sources: [row/array comparisons](https://www.postgresql.org/docs/18/functions-comparisons.html), [subqueries](https://www.postgresql.org/docs/18/functions-subquery.html).

### Logical operators

| Operator | Which field types support it? | How many values does it need? | Are there special options? | Can SQL import recover it? |
| --- | --- | --- | --- | --- |
| Boolean field directly in WHERE | boolean | 0 | Only true passes; false and NULL do not. | No today; needs a Boolean-field condition mapping. |
| `AND` | Boolean expressions/predicates. | 1 additional predicate (2 operands total) | Three-valued Boolean logic; nesting/precedence. | Yes today as an all group, if leaves are supported. |
| `OR` | Boolean expressions/predicates. | 1 additional predicate (2 operands total) | Three-valued Boolean logic; nesting/precedence. | Yes today as an any group, if leaves are supported. |
| `NOT` | Boolean expression/predicate. | 0 literal values; 1 child predicate | NULL remains unknown; preserve grouping. | Yes today as a none group, if leaves are supported. |

Source: [logical operators](https://www.postgresql.org/docs/18/functions-logical.html).

### Pattern keyword spellings

| Operator | Which field types support it? | How many values does it need? | Are there special options? | Can SQL import recover it? |
| --- | --- | --- | --- | --- |
| `LIKE` | Text types; bytea also supports LIKE/NOT LIKE. | 1 pattern; optional escape setting | ESCAPE; whole-string match. Collation. | No today; yes in principle. |
| `NOT LIKE` | Text types; bytea also supports LIKE/NOT LIKE. | 1 pattern; optional escape setting | ESCAPE; whole-string match. Collation. | No today; yes in principle. |
| `ILIKE` | Text types. | 1 pattern; optional escape setting | ESCAPE; whole-string match. Locale case folding; deterministic collation. | No today; yes in principle. |
| `NOT ILIKE` | Text types. | 1 pattern; optional escape setting | ESCAPE; whole-string match. Locale case folding; deterministic collation. | No today; yes in principle. |
| `SIMILAR TO` | Text types. | 1 pattern; optional escape setting | ESCAPE; whole-string match. SQL regex; deterministic collation. | No today; yes in principle. |
| `NOT SIMILAR TO` | Text types. | 1 pattern; optional escape setting | ESCAPE; whole-string match. SQL regex; deterministic collation. | No today; yes in principle. |

Source: [pattern matching](https://www.postgresql.org/docs/18/functions-matching.html). Catalogue spellings such as `~~` are listed below.

### JSON, XML and temporal predicates

| Operator | Which field types support it? | How many values does it need? | Are there special options? | Can SQL import recover it? |
| --- | --- | --- | --- | --- |
| `IS JSON` | text/character strings, UTF-8 bytea, json, jsonb. | 0 | WITH/WITHOUT UNIQUE KEYS; chosen JSON shape. | No today; needs SQL/JSON predicate support. |
| `IS NOT JSON` | text/character strings, UTF-8 bytea, json, jsonb. | 0 | WITH/WITHOUT UNIQUE KEYS; chosen JSON shape. | No today; needs SQL/JSON predicate support. |
| `IS JSON VALUE` | text/character strings, UTF-8 bytea, json, jsonb. | 0 | WITH/WITHOUT UNIQUE KEYS; chosen JSON shape. | No today; needs SQL/JSON predicate support. |
| `IS NOT JSON VALUE` | text/character strings, UTF-8 bytea, json, jsonb. | 0 | WITH/WITHOUT UNIQUE KEYS; chosen JSON shape. | No today; needs SQL/JSON predicate support. |
| `IS JSON SCALAR` | text/character strings, UTF-8 bytea, json, jsonb. | 0 | WITH/WITHOUT UNIQUE KEYS; chosen JSON shape. | No today; needs SQL/JSON predicate support. |
| `IS NOT JSON SCALAR` | text/character strings, UTF-8 bytea, json, jsonb. | 0 | WITH/WITHOUT UNIQUE KEYS; chosen JSON shape. | No today; needs SQL/JSON predicate support. |
| `IS JSON ARRAY` | text/character strings, UTF-8 bytea, json, jsonb. | 0 | WITH/WITHOUT UNIQUE KEYS; chosen JSON shape. | No today; needs SQL/JSON predicate support. |
| `IS NOT JSON ARRAY` | text/character strings, UTF-8 bytea, json, jsonb. | 0 | WITH/WITHOUT UNIQUE KEYS; chosen JSON shape. | No today; needs SQL/JSON predicate support. |
| `IS JSON OBJECT` | text/character strings, UTF-8 bytea, json, jsonb. | 0 | WITH/WITHOUT UNIQUE KEYS; chosen JSON shape. | No today; needs SQL/JSON predicate support. |
| `IS NOT JSON OBJECT` | text/character strings, UTF-8 bytea, json, jsonb. | 0 | WITH/WITHOUT UNIQUE KEYS; chosen JSON shape. | No today; needs SQL/JSON predicate support. |
| `IS DOCUMENT` | xml | 0 | Document versus XML content fragment; NULL stays NULL. | No today; yes in principle. |
| `IS NOT DOCUMENT` | xml | 0 | Negates document test; NULL stays NULL. | No today; yes in principle. |
| `(start, end) OVERLAPS (start, end)` | date, time or timestamp pairs; a pair can be start + interval. | 2 right-hand endpoints; left side also needs 2 expressions | Bounds are reordered; half-open periods except zero-length instants; timezone may matter. | No today; needs period/expression support. |

Sources: [SQL/JSON tests](https://www.postgresql.org/docs/18/functions-json.html#FUNCTIONS-SQLJSON-CHECK), [SQL/JSON input-type handling](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/parser/parse_expr.c), [XML predicates](https://www.postgresql.org/docs/18/functions-xml.html#FUNCTIONS-XML-PREDICATES), [temporal OVERLAPS](https://www.postgresql.org/docs/18/functions-datetime.html).

## Complete built-in filtering catalogue, grouped by type

Every Boolean-returning catalogue overload is included in one of the tables below. Multiple rows for the same symbol distinguish operand families, meaning or unary/binary form. Comparison tables include enums, arrays, composites, JSONB and system types where their exact signatures exist; `json` and `xml` have no ordinary built-in equality/order operator. Arrays/composites additionally require their members to support the relevant operation.

### Comparisons

| Operator | Which field types support it? | How many values does it need? | Are there special options? | Can SQL import recover it? |
| --- | --- | --- | --- | --- |
| `=` — equal | Same type: `boolean`, `"char"`, `name`, `smallint`, `integer`, `text`, `xid`, `xid8`, `cid`, `tid`, `bigint`, `oid`, `oidvector`, `real`, `double precision`, `money`, `character(n)`, `T[]`, `date`, `time`, `time with time zone`, `timestamp with time zone`, `interval`, `macaddr`, `macaddr8`, `inet`, `numeric`, `bit`, `bit varying`, `bytea`, `timestamp`, `uuid`, `enum`, `tsvector`, `tsquery`, `composite/record`, `range<T>`, `jsonb`, `multirange<T>`<br>Field → value: `integer` → `bigint`; `name` → `text`; `text` → `name`; `xid` → `integer`; `bigint` → `integer`; `smallint` → `integer`; `integer` → `smallint`; `real` → `double precision`; `double precision` → `real`; `smallint` → `bigint`; `bigint` → `smallint`; `date` → `timestamp`; `date` → `timestamp with time zone`; `timestamp` → `date`; `timestamp with time zone` → `date`; `timestamp` → `timestamp with time zone`; `timestamp with time zone` → `timestamp` | 1 | Compatible types/casts; text collation; NULL yields unknown. | Limited today; yes in principle. |
| `<>` — not equal | Same type: `boolean`, `xid`, `xid8`, `tid`, `bigint`, `integer`, `smallint`, `text`, `oid`, `oidvector`, `real`, `"char"`, `name`, `double precision`, `money`, `character(n)`, `T[]`, `date`, `time`, `time with time zone`, `timestamp with time zone`, `interval`, `macaddr`, `macaddr8`, `inet`, `numeric`, `bit`, `bit varying`, `bytea`, `timestamp`, `uuid`, `enum`, `tsvector`, `tsquery`, `composite/record`, `range<T>`, `jsonb`, `multirange<T>`<br>Field → value: `integer` → `bigint`; `name` → `text`; `text` → `name`; `xid` → `integer`; `bigint` → `integer`; `smallint` → `integer`; `integer` → `smallint`; `real` → `double precision`; `double precision` → `real`; `smallint` → `bigint`; `bigint` → `smallint`; `date` → `timestamp`; `date` → `timestamp with time zone`; `timestamp` → `date`; `timestamp with time zone` → `date`; `timestamp` → `timestamp with time zone`; `timestamp with time zone` → `timestamp` | 1 | Compatible types/casts; text collation; NULL yields unknown. | No today; yes in principle. |
| `<` — less than | Same type: `boolean`, `smallint`, `integer`, `xid8`, `tid`, `bigint`, `oid`, `oidvector`, `real`, `"char"`, `name`, `text`, `double precision`, `money`, `character(n)`, `T[]`, `date`, `time`, `time with time zone`, `timestamp with time zone`, `interval`, `macaddr`, `macaddr8`, `inet`, `numeric`, `bit`, `bit varying`, `bytea`, `timestamp`, `uuid`, `enum`, `tsvector`, `tsquery`, `composite/record`, `range<T>`, `jsonb`, `multirange<T>`<br>Field → value: `integer` → `bigint`; `name` → `text`; `text` → `name`; `bigint` → `integer`; `smallint` → `integer`; `integer` → `smallint`; `real` → `double precision`; `double precision` → `real`; `smallint` → `bigint`; `bigint` → `smallint`; `date` → `timestamp`; `date` → `timestamp with time zone`; `timestamp` → `date`; `timestamp with time zone` → `date`; `timestamp` → `timestamp with time zone`; `timestamp with time zone` → `timestamp` | 1 | Compatible types/casts; text collation; NULL yields unknown. | No today; yes in principle. |
| `>` — greater than | Same type: `boolean`, `xid8`, `tid`, `bigint`, `smallint`, `integer`, `oid`, `oidvector`, `real`, `"char"`, `name`, `text`, `double precision`, `money`, `character(n)`, `T[]`, `date`, `time`, `time with time zone`, `timestamp with time zone`, `interval`, `macaddr`, `macaddr8`, `inet`, `numeric`, `bit`, `bit varying`, `bytea`, `timestamp`, `uuid`, `enum`, `tsvector`, `tsquery`, `composite/record`, `range<T>`, `jsonb`, `multirange<T>`<br>Field → value: `integer` → `bigint`; `name` → `text`; `text` → `name`; `bigint` → `integer`; `smallint` → `integer`; `integer` → `smallint`; `real` → `double precision`; `double precision` → `real`; `smallint` → `bigint`; `bigint` → `smallint`; `date` → `timestamp`; `date` → `timestamp with time zone`; `timestamp` → `date`; `timestamp with time zone` → `date`; `timestamp` → `timestamp with time zone`; `timestamp with time zone` → `timestamp` | 1 | Compatible types/casts; text collation; NULL yields unknown. | Limited today; yes in principle. |
| `<=` — less than or equal | Same type: `boolean`, `xid8`, `tid`, `bigint`, `smallint`, `integer`, `oid`, `oidvector`, `real`, `"char"`, `name`, `text`, `double precision`, `money`, `character(n)`, `T[]`, `date`, `time`, `time with time zone`, `timestamp with time zone`, `interval`, `macaddr`, `macaddr8`, `inet`, `numeric`, `bit`, `bit varying`, `bytea`, `timestamp`, `uuid`, `enum`, `tsvector`, `tsquery`, `composite/record`, `range<T>`, `jsonb`, `multirange<T>`<br>Field → value: `integer` → `bigint`; `name` → `text`; `text` → `name`; `bigint` → `integer`; `smallint` → `integer`; `integer` → `smallint`; `real` → `double precision`; `double precision` → `real`; `smallint` → `bigint`; `bigint` → `smallint`; `date` → `timestamp`; `date` → `timestamp with time zone`; `timestamp` → `date`; `timestamp with time zone` → `date`; `timestamp` → `timestamp with time zone`; `timestamp with time zone` → `timestamp` | 1 | Compatible types/casts; text collation; NULL yields unknown. | No today; yes in principle. |
| `>=` — greater than or equal | Same type: `boolean`, `xid8`, `tid`, `bigint`, `smallint`, `integer`, `oid`, `oidvector`, `real`, `"char"`, `name`, `text`, `double precision`, `money`, `character(n)`, `T[]`, `date`, `time`, `time with time zone`, `timestamp with time zone`, `interval`, `macaddr`, `macaddr8`, `inet`, `numeric`, `bit`, `bit varying`, `bytea`, `timestamp`, `uuid`, `enum`, `tsvector`, `tsquery`, `composite/record`, `range<T>`, `jsonb`, `multirange<T>`<br>Field → value: `integer` → `bigint`; `name` → `text`; `text` → `name`; `bigint` → `integer`; `smallint` → `integer`; `integer` → `smallint`; `real` → `double precision`; `double precision` → `real`; `smallint` → `bigint`; `bigint` → `smallint`; `date` → `timestamp`; `date` → `timestamp with time zone`; `timestamp` → `date`; `timestamp with time zone` → `date`; `timestamp` → `timestamp with time zone`; `timestamp with time zone` → `timestamp` | 1 | Compatible types/casts; text collation; NULL yields unknown. | No today; yes in principle. |

Sources: [PostgreSQL type-family documentation](https://www.postgresql.org/docs/18/functions-comparison.html), [exact built-in signatures](https://github.com/postgres/postgres/blob/11aed8d19cd71d2754ac10c71ec668280bd955f5/src/include/catalog/pg_operator.dat).

### Text matching

| Operator | Which field types support it? | How many values does it need? | Are there special options? | Can SQL import recover it? |
| --- | --- | --- | --- | --- |
| `^@` — starts with | Same type: `text` | 1 | Literal prefix. | No today; yes in principle. |
| `~` — matches regular expression, case-sensitive | Same type: `text`<br>Field → value: `name` → `text`; `character(n)` → `text` | 1 | Anchors; embedded flags; deterministic collation. | No today; yes in principle. |
| `!~` — does not match regular expression, case-sensitive | Same type: `text`<br>Field → value: `name` → `text`; `character(n)` → `text` | 1 | Anchors; embedded flags; deterministic collation. | No today; yes in principle. |
| `~~` — matches LIKE expression | Same type: `text`<br>Field → value: `name` → `text`; `character(n)` → `text` | 1 | Wildcard escaping; keyword ESCAPE. Collation. | No today; yes in principle. |
| `!~~` — does not match LIKE expression | Same type: `text`<br>Field → value: `name` → `text`; `character(n)` → `text` | 1 | Wildcard escaping; keyword ESCAPE. Collation. | No today; yes in principle. |
| `~*` — matches regular expression, case-insensitive | Same type: `text`<br>Field → value: `name` → `text`; `character(n)` → `text` | 1 | Anchors; embedded flags; deterministic collation. | No today; yes in principle. |
| `!~*` — does not match regular expression, case-insensitive | Same type: `text`<br>Field → value: `name` → `text`; `character(n)` → `text` | 1 | Anchors; embedded flags; deterministic collation. | No today; yes in principle. |
| `~~*` — matches LIKE expression, case-insensitive | Same type: `text`<br>Field → value: `name` → `text`; `character(n)` → `text` | 1 | Wildcard escaping; keyword ESCAPE. Locale case folding; deterministic collation. | No today; yes in principle. |
| `!~~*` — does not match LIKE expression, case-insensitive | Same type: `text`<br>Field → value: `name` → `text`; `character(n)` → `text` | 1 | Wildcard escaping; keyword ESCAPE. Locale case folding; deterministic collation. | No today; yes in principle. |
| `~<~` — less than | Same type: `text`, `character(n)` | 1 | Bytewise pattern-index ordering; differs from locale ordering. | No today; yes in principle. |
| `~<=~` — less than or equal | Same type: `text`, `character(n)` | 1 | Bytewise pattern-index ordering; differs from locale ordering. | No today; yes in principle. |
| `~>=~` — greater than or equal | Same type: `text`, `character(n)` | 1 | Bytewise pattern-index ordering; differs from locale ordering. | No today; yes in principle. |
| `~>~` — greater than | Same type: `text`, `character(n)` | 1 | Bytewise pattern-index ordering; differs from locale ordering. | No today; yes in principle. |

Sources: [PostgreSQL type-family documentation](https://www.postgresql.org/docs/18/functions-matching.html), [exact built-in signatures](https://github.com/postgres/postgres/blob/11aed8d19cd71d2754ac10c71ec668280bd955f5/src/include/catalog/pg_operator.dat), [pattern ordering](https://www.postgresql.org/docs/18/indexes-opclass.html).

### Arrays

| Operator | Which field types support it? | How many values does it need? | Are there special options? | Can SQL import recover it? |
| --- | --- | --- | --- | --- |
| `&&` — overlaps | Same type: `T[]` | 1 array (0…N items) | Element equality; at least one common element. | No today; yes in principle. |
| `@>` — contains | Same type: `T[]` | 1 array (0…N items) | Element equality; duplicates do not affect containment. | No today; yes in principle. |
| `<@` — is contained by | Same type: `T[]` | 1 array (0…N items) | Element equality; duplicates do not affect containment. | No today; yes in principle. |

Sources: [PostgreSQL type-family documentation](https://www.postgresql.org/docs/18/functions-array.html), [exact built-in signatures](https://github.com/postgres/postgres/blob/11aed8d19cd71d2754ac10c71ec668280bd955f5/src/include/catalog/pg_operator.dat).

### JSON and JSONB

| Operator | Which field types support it? | How many values does it need? | Are there special options? | Can SQL import recover it? |
| --- | --- | --- | --- | --- |
| `@>` — contains | Same type: `jsonb` | 1 JSON value | Structural containment; JSONB only. | No today; yes in principle. |
| `?` — key exists | Field → value: `jsonb` → `text` | 1 | Top-level object key or string array element; JSONB only. | No today; yes in principle. |
| `?\|` — any key exists | Field → value: `jsonb` → `text[]` | 1 array (0…N items) | Any listed top-level key/string element; JSONB only. | No today; yes in principle. |
| `?&` — all keys exist | Field → value: `jsonb` → `text[]` | 1 array (0…N items) | All listed top-level keys/string elements; JSONB only. | No today; yes in principle. |
| `<@` — is contained by | Same type: `jsonb` | 1 JSON value | Structural containment; JSONB only. | No today; yes in principle. |
| `@?` — jsonpath exists | Field → value: `jsonb` → `jsonpath` | 1 JSONPath | JSONPath lax/strict mode; suppresses certain path/type errors. | No today; yes in principle. |
| `@@` — jsonpath match | Field → value: `jsonb` → `jsonpath` | 1 JSONPath | JSONPath predicate; first result must be Boolean; can yield NULL. | No today; yes in principle. |

Sources: [PostgreSQL type-family documentation](https://www.postgresql.org/docs/18/functions-json.html), [exact built-in signatures](https://github.com/postgres/postgres/blob/11aed8d19cd71d2754ac10c71ec668280bd955f5/src/include/catalog/pg_operator.dat).

### Ranges and multiranges

| Operator | Which field types support it? | How many values does it need? | Are there special options? | Can SQL import recover it? |
| --- | --- | --- | --- | --- |
| `&&` — overlaps | Same type: `range<T>`, `multirange<T>`<br>Field → value: `range<T>` → `multirange<T>`; `multirange<T>` → `range<T>` | 1 range/multirange | Matching subtype; inclusive/exclusive, unbounded or empty bounds. | No today; yes in principle. |
| `@>` — contains | Same type: `range<T>`, `multirange<T>`<br>Field → value: `range<T>` → `T`; `multirange<T>` → `T`; `multirange<T>` → `range<T>`; `range<T>` → `multirange<T>` | 1 | Matching subtype; inclusive/exclusive, unbounded or empty bounds. | No today; yes in principle. |
| `<@` — is contained by | Same type: `range<T>`, `multirange<T>`<br>Field → value: `T` → `range<T>`; `T` → `multirange<T>`; `range<T>` → `multirange<T>`; `multirange<T>` → `range<T>` | 1 range/multirange | Matching subtype; inclusive/exclusive, unbounded or empty bounds. | No today; yes in principle. |
| `<<` — is left of | Same type: `range<T>`, `multirange<T>`<br>Field → value: `range<T>` → `multirange<T>`; `multirange<T>` → `range<T>` | 1 range/multirange | Matching subtype; inclusive/exclusive, unbounded or empty bounds. | No today; yes in principle. |
| `>>` — is right of | Same type: `range<T>`, `multirange<T>`<br>Field → value: `range<T>` → `multirange<T>`; `multirange<T>` → `range<T>` | 1 range/multirange | Matching subtype; inclusive/exclusive, unbounded or empty bounds. | No today; yes in principle. |
| `&<` — overlaps or is left of | Same type: `range<T>`, `multirange<T>`<br>Field → value: `range<T>` → `multirange<T>`; `multirange<T>` → `range<T>` | 1 range/multirange | Matching subtype; inclusive/exclusive, unbounded or empty bounds. | No today; yes in principle. |
| `&>` — overlaps or is right of | Same type: `range<T>`, `multirange<T>`<br>Field → value: `range<T>` → `multirange<T>`; `multirange<T>` → `range<T>` | 1 range/multirange | Matching subtype; inclusive/exclusive, unbounded or empty bounds. | No today; yes in principle. |
| `-\|-` — is adjacent to | Same type: `range<T>`, `multirange<T>`<br>Field → value: `range<T>` → `multirange<T>`; `multirange<T>` → `range<T>` | 1 range/multirange | Adjacency depends on bound inclusivity and subtype canonicalization. | No today; yes in principle. |

Sources: [PostgreSQL type-family documentation](https://www.postgresql.org/docs/18/functions-range.html), [exact built-in signatures](https://github.com/postgres/postgres/blob/11aed8d19cd71d2754ac10c71ec668280bd955f5/src/include/catalog/pg_operator.dat).

### Full-text search

| Operator | Which field types support it? | How many values does it need? | Are there special options? | Can SQL import recover it? |
| --- | --- | --- | --- | --- |
| `@@` — text search match | Same type: `text`<br>Field → value: `tsvector` → `tsquery`; `tsquery` → `tsvector`; `text` → `tsquery` | 1 | Text-search configuration; query parser; weights/prefixes when building tsquery. | No today; yes in principle. |
| `@@@` — deprecated, use @@ instead | Field → value: `tsvector` → `tsquery`; `tsquery` → `tsvector` | 1 | Deprecated spelling of @@. | No today; yes in principle. |
| `@>` — contains | Same type: `tsquery` | 1 | Compares lexeme sets; ignores Boolean query structure. | No today; yes in principle. |
| `<@` — is contained by | Same type: `tsquery` | 1 | Compares lexeme sets; ignores Boolean query structure. | No today; yes in principle. |

Sources: [PostgreSQL type-family documentation](https://www.postgresql.org/docs/18/functions-textsearch.html), [exact built-in signatures](https://github.com/postgres/postgres/blob/11aed8d19cd71d2754ac10c71ec668280bd955f5/src/include/catalog/pg_operator.dat).

### IP and MAC addresses

| Operator | Which field types support it? | How many values does it need? | Are there special options? | Can SQL import recover it? |
| --- | --- | --- | --- | --- |
| `<<` — is subnet | Same type: `inet` | 1 | Network prefixes matter; host bits are ignored. Strict containment. | No today; yes in principle. |
| `<<=` — is subnet or equal | Same type: `inet` | 1 | Network prefixes matter; host bits are ignored. Equality allowed. | No today; yes in principle. |
| `>>` — is supernet | Same type: `inet` | 1 | Network prefixes matter; host bits are ignored. Strict containment. | No today; yes in principle. |
| `>>=` — is supernet or equal | Same type: `inet` | 1 | Network prefixes matter; host bits are ignored. Equality allowed. | No today; yes in principle. |
| `&&` — overlaps (is subnet or supernet) | Same type: `inet` | 1 | Network prefixes matter; host bits are ignored. | No today; yes in principle. |

Sources: [PostgreSQL type-family documentation](https://www.postgresql.org/docs/18/functions-net.html), [exact built-in signatures](https://github.com/postgres/postgres/blob/11aed8d19cd71d2754ac10c71ec668280bd955f5/src/include/catalog/pg_operator.dat).

### Geometry

| Operator | Which field types support it? | How many values does it need? | Are there special options? | Can SQL import recover it? |
| --- | --- | --- | --- | --- |
| `<<` — is left of | Same type: `polygon`, `box`, `point`, `circle` | 1 | Strict axis separation. | No today; yes in principle. |
| `&<` — overlaps or is left of | Same type: `polygon`, `box`, `circle` | 1 | Extent comparison; overlap optional. | No today; yes in principle. |
| `&>` — overlaps or is right of | Same type: `polygon`, `box`, `circle` | 1 | Extent comparison; overlap optional. | No today; yes in principle. |
| `>>` — is right of | Same type: `polygon`, `box`, `point`, `circle` | 1 | Strict axis separation. | No today; yes in principle. |
| `<@` — is contained by | Same type: `polygon`, `box`, `circle`<br>Field → value: `point` → `polygon`; `point` → `circle`; `point` → `lseg`; `lseg` → `box` | 1 | Pair-specific containment/boundary rules. | No today; yes in principle. |
| `@>` — contains | Same type: `polygon`, `box`, `circle`<br>Field → value: `box` → `point`; `path` → `point`; `polygon` → `point`; `circle` → `point` | 1 | Pair-specific containment/boundary rules. Open/closed path matters. | No today; yes in principle. |
| `~=` — same as | Same type: `polygon`, `box`, `point`, `circle` | 1 | Geometric sameness. | No today; yes in principle. |
| `&&` — overlaps | Same type: `polygon`, `box`, `circle` | 1 | Boundary contact counts. | No today; yes in principle. |
| `>=` — greater than or equal by area | Same type: `box`, `circle` | 1 | Area comparison. | No today; yes in principle. |
| `>` — greater than by area | Same type: `box`, `circle` | 1 | Area comparison. | Limited today; yes in principle. |
| `=` — equal by area | Same type: `box`, `circle` | 1 | Area comparison. | Limited today; yes in principle. |
| `<` — less than by area | Same type: `box`, `circle` | 1 | Area comparison. | No today; yes in principle. |
| `<=` — less than or equal by area | Same type: `box`, `circle` | 1 | Area comparison. | No today; yes in principle. |
| `>^` — deprecated, use \|>> instead | Same type: `point` | 1 | Deprecated, use \|>> instead. | No today; yes in principle. |
| `<^` — deprecated, use <<\| instead | Same type: `point` | 1 | Deprecated, use <<\| instead. | No today; yes in principle. |
| `<@` — point inside box | Field → value: `point` → `box` | 1 | Pair-specific containment/boundary rules. | No today; yes in principle. |
| `<@` — point within closed path, or point on open path | Field → value: `point` → `path` | 1 | Pair-specific containment/boundary rules. Open/closed path matters. | No today; yes in principle. |
| `<>` — not equal | Same type: `point`, `lseg` | 1 | Paths: point count; others: geometry. | No today; yes in principle. |
| `=` — equal | Same type: `path`, `lseg`, `line` | 1 | Paths: point count; others: geometry. | Limited today; yes in principle. |
| `<` — less than | Same type: `path` | 1 | Path point count. | No today; yes in principle. |
| `>` — greater than | Same type: `path` | 1 | Path point count. | Limited today; yes in principle. |
| `<=` — less than or equal | Same type: `path` | 1 | Path point count. | No today; yes in principle. |
| `>=` — greater than or equal | Same type: `path` | 1 | Path point count. | No today; yes in principle. |
| `?#` — intersect | Same type: `path`, `lseg`, `line`<br>Field → value: `lseg` → `line`; `lseg` → `box`; `line` → `box` | 1 | Boundary contact counts. | No today; yes in principle. |
| `>^` — is above (allows touching) | Same type: `box` | 1 | Touching edges allowed. | No today; yes in principle. |
| `<^` — is below (allows touching) | Same type: `box` | 1 | Touching edges allowed. | No today; yes in principle. |
| `?#` — deprecated, use && instead | Same type: `box` | 1 | Deprecated, use && instead. | No today; yes in principle. |
| `?-` — horizontally aligned | Same type: `point` | 1 | No tolerance argument. | No today; yes in principle. |
| `?\|` — vertically aligned | Same type: `point` | 1 | No tolerance argument. | No today; yes in principle. |
| `<>` — not equal by area | Same type: `circle` | 1 | Area comparison. | No today; yes in principle. |
| `\|>>` — is above | Same type: `circle`, `point`, `box`, `polygon` | 1 | Strict axis separation. | No today; yes in principle. |
| `<<\|` — is below | Same type: `circle`, `point`, `box`, `polygon` | 1 | Strict axis separation. | No today; yes in principle. |
| `?\|\|` — parallel | Same type: `lseg`, `line` | 1 | No tolerance argument. | No today; yes in principle. |
| `?-\|` — perpendicular | Same type: `lseg`, `line` | 1 | No tolerance argument. | No today; yes in principle. |
| `?-` — horizontal (prefix unary) | `lseg`, `line` | 0 | No tolerance argument. | No today; yes in principle. |
| `?\|` — vertical (prefix unary) | `lseg`, `line` | 0 | No tolerance argument. | No today; yes in principle. |
| `<@` — point on line | Field → value: `point` → `line` | 1 | Pair-specific containment/boundary rules. | No today; yes in principle. |
| `<@` — lseg on line | Field → value: `lseg` → `line` | 1 | Pair-specific containment/boundary rules. | No today; yes in principle. |
| `<` — less than by length | Same type: `lseg` | 1 | Segment-length comparison. | No today; yes in principle. |
| `<=` — less than or equal by length | Same type: `lseg` | 1 | Segment-length comparison. | No today; yes in principle. |
| `>` — greater than by length | Same type: `lseg` | 1 | Segment-length comparison. | Limited today; yes in principle. |
| `>=` — greater than or equal by length | Same type: `lseg` | 1 | Segment-length comparison. | No today; yes in principle. |
| `&<\|` — overlaps or is below | Same type: `box`, `polygon`, `circle` | 1 | Extent comparison; overlap optional. | No today; yes in principle. |
| `\|&>` — overlaps or is above | Same type: `box`, `polygon`, `circle` | 1 | Extent comparison; overlap optional. | No today; yes in principle. |

Sources: [PostgreSQL type-family documentation](https://www.postgresql.org/docs/18/functions-geometry.html), [exact built-in signatures](https://github.com/postgres/postgres/blob/11aed8d19cd71d2754ac10c71ec668280bd955f5/src/include/catalog/pg_operator.dat).

### Binary strings

| Operator | Which field types support it? | How many values does it need? | Are there special options? | Can SQL import recover it? |
| --- | --- | --- | --- | --- |
| `~~` — matches LIKE expression | Same type: `bytea` | 1 | Byte pattern with LIKE wildcards; no case-insensitive byte variant. | No today; yes in principle. |
| `!~~` — does not match LIKE expression | Same type: `bytea` | 1 | Byte pattern with LIKE wildcards; no case-insensitive byte variant. | No today; yes in principle. |

Sources: [PostgreSQL type-family documentation](https://www.postgresql.org/docs/18/functions-binarystring.html), [exact built-in signatures](https://github.com/postgres/postgres/blob/11aed8d19cd71d2754ac10c71ec668280bd955f5/src/include/catalog/pg_operator.dat).

### System and internal operators

| Operator | Which field types support it? | How many values does it need? | Are there special options? | Can SQL import recover it? |
| --- | --- | --- | --- | --- |
| `@>` — contains | Field → value: `aclitem[]` → `aclitem` | 1 | ACL privilege/grantor semantics; specialized system metadata. | No today; yes in principle. |
| `=` — equal | Same type: `aclitem` | 1 | ACL privilege/grantor semantics; specialized system metadata. | Limited today; yes in principle. |
| `=` — equal | Same type: `pg_lsn` | 1 | WAL position ordering/equality. | Limited today; yes in principle. |
| `<>` — not equal | Same type: `pg_lsn` | 1 | WAL position ordering/equality. | No today; yes in principle. |
| `<` — less than | Same type: `pg_lsn` | 1 | WAL position ordering/equality. | No today; yes in principle. |
| `>` — greater than | Same type: `pg_lsn` | 1 | WAL position ordering/equality. | Limited today; yes in principle. |
| `<=` — less than or equal | Same type: `pg_lsn` | 1 | WAL position ordering/equality. | No today; yes in principle. |
| `>=` — greater than or equal | Same type: `pg_lsn` | 1 | WAL position ordering/equality. | No today; yes in principle. |
| `*=` — identical | Same type: `composite/record` | 1 | Binary record representation; differs from logical composite comparison. | No today; yes in principle. |
| `*<>` — not identical | Same type: `composite/record` | 1 | Binary record representation; differs from logical composite comparison. | No today; yes in principle. |
| `*<` — less than | Same type: `composite/record` | 1 | Binary record representation; differs from logical composite comparison. | No today; yes in principle. |
| `*>` — greater than | Same type: `composite/record` | 1 | Binary record representation; differs from logical composite comparison. | No today; yes in principle. |
| `*<=` — less than or equal | Same type: `composite/record` | 1 | Binary record representation; differs from logical composite comparison. | No today; yes in principle. |
| `*>=` — greater than or equal | Same type: `composite/record` | 1 | Binary record representation; differs from logical composite comparison. | No today; yes in principle. |

Sources: [PostgreSQL type-family documentation](https://www.postgresql.org/docs/18/functions-comparisons.html), [exact built-in signatures](https://github.com/postgres/postgres/blob/11aed8d19cd71d2754ac10c71ec668280bd955f5/src/include/catalog/pg_operator.dat).

## Common builder labels derived from SQL

These labels are useful in a condition dropdown but are not extra PostgreSQL catalogue operators. Their value count is the count exposed by that shorthand.

| Operator | Which field types support it? | How many values does it need? | Are there special options? | Can SQL import recover it? |
| --- | --- | --- | --- | --- |
| Contains text | Text types. | 1 text value | Escaped LIKE/ILIKE `%value%`; case sensitivity. | No today; future recognition is ambiguous with raw pattern matching. |
| Does not contain text | Text types. | 1 text value | Negated contains pattern; case sensitivity. | No today; future recognition is ambiguous with raw pattern matching. |
| Starts with text | Text types. | 1 text value | Literal ^@ or escaped LIKE/ILIKE `value%`. | No today; literal ^@ is identifiable; pattern-derived label is ambiguous. |
| Does not start with text | Text types. | 1 text value | Negated starts-with predicate; case sensitivity. | No today; future recognition depends on the chosen SQL form. |
| Ends with text | Text types. | 1 text value | Escaped LIKE/ILIKE `%value`; case sensitivity. | No today; future recognition is ambiguous with raw pattern matching. |
| Does not end with text | Text types. | 1 text value | Negated ends-with predicate; case sensitivity. | No today; future recognition is ambiguous with raw pattern matching. |
| Is empty text | Text types. | 0 | Export as field = ''; whitespace and NULL remain separate. | Current import recovers Equals with an empty string, not this label. |
| Is not empty text | Text types. | 0 | Export as field <> ''; decide whether NULL should also match. | No today; future label recovery is ambiguous with Not equals. |
| Array is empty | Arrays. | 0 | Use cardinality(field) = 0; SQL NULL remains separate. | No today; needs function/expression recognition. |
| Array is not empty | Arrays. | 0 | Use cardinality(field) > 0; SQL NULL remains separate. | No today; needs function/expression recognition. |

Sources: [pattern semantics](https://www.postgresql.org/docs/18/functions-matching.html), [array cardinality](https://www.postgresql.org/docs/18/functions-array.html). Label choices and import ambiguity are builder design conclusions.
