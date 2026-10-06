# MySQL 8.4 capabilities

MySQL supports visual filters, WHERE export, and SQL filter import with validated raw editing through its adapter. CREATE TABLE schema import provides field suggestions without type inference. Its catalogue is independent of PostgreSQL parsing and AST handling.

| Operators | Input shape | Value types |
| --- | --- | --- |
| `=`, `<>`, `>`, `>=`, `<`, `<=` | Single | Text, finite number, boolean, date, time, local datetime, field reference |
| `IN`, `NOT IN` | Non-empty list | The same types, with one homogeneous type per list |
| `BETWEEN`, `NOT BETWEEN` | Range with both endpoints | The same types, with one homogeneous type per range |
| `IS NULL`, `IS NOT NULL` | No value | None; requires `hasValue: false` |
| `LIKE`, `NOT LIKE` | Single SQL pattern | Text or field reference |

Dates use years 1000–9999. Time and local datetime inputs have seconds precision and no timezone. Field references are quoted identifiers, including list items and range endpoints. Invalid literals, incomplete ranges, empty lists, and unsupported operators/modifiers return generation errors associated with the condition.

Text comparisons use MySQL's configured collation. No case-insensitive operator, forced collation, or automatic LOWER rewrite is applied. LIKE accepts SQL patterns: `%` matches zero or more characters and `_` matches one character. SQL NULL requires a null-check operator rather than a literal value. Durations, ILIKE/NOT ILIKE, and IS TRUE/IS FALSE are unavailable in this initial catalogue.

## Explicit field modifier allowlist

All included functions accept the field as their only argument. These are deliberate user-selected transformations.

| Modifiers | Intended field input | Result |
| --- | --- | --- |
| `lower`, `upper` | Text | Text; character-set case mapping, with binary strings unchanged |
| `trim`, `ltrim`, `rtrim` | Text | Text with both/leading/trailing spaces removed |
| `reverse` | Text | Reversed text |
| `length` | Text | Number of bytes, not characters |
| `abs` | Number | Absolute numeric value |
| `round` | Number | Numeric value rounded to zero decimal places; algorithm depends on input type |
| `floor`, `ceil` | Number | Numeric integer rounded downward/upward |
| `sqrt` | Nonnegative number | Numeric square root; negative inputs produce SQL NULL |

Functions also propagate SQL NULL. The tree stores field names without schema types, so field argument types cannot be verified locally; MySQL handles field typing and coercion. Result types above describe the function result, not a restriction on SQL's comparison coercions.

INITCAP is unavailable as a MySQL built-in. PostgreSQL TRUNC is excluded: MySQL TRUNCATE requires a second precision argument, which the shared modifier model cannot represent. No modifier is inherited automatically from PostgreSQL.

Function signatures and behavior were reviewed against the MySQL 8.4 [string function reference](https://dev.mysql.com/doc/refman/8.4/en/string-functions.html) and [mathematical function reference](https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html). Pattern semantics follow the [string comparison reference](https://dev.mysql.com/doc/refman/8.4/en/string-comparison-functions.html).

## WHERE SQL generation

The adapter renders the shared tree directly, without PostgreSQL parsing or AST serialization. Each nonempty group is parenthesized: `all` joins children with AND, `any` joins them with OR, and `none` renders NOT around their OR. Empty groups are omitted, including empty `none` groups, matching PostgreSQL's policy. An empty root succeeds with an empty SQL string rather than a bare WHERE. No SQL is returned if any child fails; errors retain the offending node ID.

Identifiers are raw names, not prequoted SQL. Dots separate up to three qualification segments; surrounding whitespace is trimmed. Every segment is backtick-quoted and embedded backticks are doubled, including reserved words. Segments are limited to 64 valid BMP characters; NUL, supplementary characters, empty segments, and wildcard segments are rejected. Parentheses and other special characters inside names remain identifier characters, never executable SQL. Names containing literal dots are outside this field-name representation. Use a UTF-8 (`utf8mb4`) client connection when copying non-ASCII identifiers. These rules follow the [identifier reference](https://dev.mysql.com/doc/refman/8.4/en/identifiers.html).

### SQL modes and strings

String escaping supports both enabled and disabled `NO_BACKSLASH_ESCAPES`, as well as `ANSI_QUOTES`. Printable ASCII without backslashes uses single quotes, with apostrophes doubled. Backslashes, control characters, and non-ASCII text use UTF-8 bytes in `_utf8mb4 X'…'` literals; this avoids backslash interpretation and preserves text rather than producing a binary string. Unpaired Unicode surrogates are rejected before encoding instead of silently replaced. This approach follows the [hexadecimal literal](https://dev.mysql.com/doc/refman/8.4/en/hexadecimal-literals.html) and [string literal](https://dev.mysql.com/doc/refman/8.4/en/string-literals.html) references.

LIKE and NOT LIKE always append `ESCAPE _utf8mb4 X'5c'`, explicitly selecting backslash regardless of SQL mode. Pattern inputs are the actual pattern characters, not SQL source escapes: `\%` matches a literal percent sign, `\_` matches a literal underscore, and two backslashes match a literal backslash. The renderer does not add a case conversion or COLLATE clause. See the [LIKE escape rules](https://dev.mysql.com/doc/refman/8.4/en/string-comparison-functions.html).

Numbers must be finite JavaScript numbers, rendered without locale formatting. Booleans render as TRUE/FALSE. Valid local temporal values use CAST to DATE, TIME, or DATETIME; datetime's T separator becomes a space. Lists are parenthesized and ranges render two endpoints separated by AND. Only allowlisted modifiers can wrap a field. Field-reference values use the same identifier quoting as the condition field.

Negative operators and NOT groups retain SQL's three-valued NULL semantics. No implicit IS NULL branches are added. Literal NULL, missing/invalid values, empty lists, incomplete ranges, and unsupported operators/modifiers are rejected in visual conditions. Raw conditions are validated as single MySQL filter expressions before export. This stage produces copyable literal SQL only; parameterization remains out of scope.

## Database UI

Select MySQL 8.4 in Databases, add conditions or nested groups in Builder or import a filter in Import, then use Output to preview and copy the generated SQL. Manual field entry and query-derived autocomplete remain available. Operators, shapes, value types, and field modifiers come from the active adapter. SQL filter import and Raw editing are exposed through their adapter capabilities. CREATE TABLE schema import supplies field suggestions through the same adapter-based workflow; guarded handlers prevent unsupported entry points.

Changing the database starts a fresh empty root and clears schema suggestions, condition selection, editor state, import drafts, validation feedback, and copy feedback. Selecting the active target again leaves the query intact. Operator-label preferences remain in the settings store. PostgreSQL retains its imports and raw editing, and Elasticsearch retains its placeholder views.

The adapter selects the SQL formatter dialect; both SQL targets use the installed SQL highlighting grammar, which includes backtick identifiers. Generation failures replace the SQL preview and disable copying. Condition warnings and the details panel show adapter errors, including errors associated with a condition node. Pending clipboard feedback is discarded if the query or database changes.

## Comparison help

Operator tooltips explain the selected dialect's existing comparisons. MySQL text comparison and pattern matching use the applicable database or column collation; the app does not determine case sensitivity. PostgreSQL keeps LIKE separate from ILIKE, which requests case folding according to its active locale.

Pattern tooltips distinguish user-entered SQL patterns from SQL string-literal quoting. Wildcards are used as entered: `%` matches zero or more characters and `_` matches one character. The exporter adds no wildcards or automatic pattern escapes. Each dialect's tooltip describes its existing backslash pattern behavior; MySQL's explicit ESCAPE is independent of NO_BACKSLASH_ESCAPES.

Negative comparison descriptions direct users to IS NULL in an any group to include NULL fields explicitly. Group-mode help explains that none is NOT applied to the OR of its children; an outer any group can combine it with IS NULL. These explanations add no operators or query rewrites. Operator descriptions are associated with the selector for assistive technology and shown on keyboard focus; group help is associated with the existing mode button.

## SQL filter import

The MySQL adapter uses `dt-sql-parser`'s MySQL grammar and ANTLR runtime, independently of PostgreSQL's parser and AST. Parser contexts and tokens stay within the MySQL implementation. Small lexical extensions recognize SQL-standard DATE/TIME/TIMESTAMP literals and hexadecimal ESCAPE constants, retaining the original source and token ranges rather than replacing SQL text. Logical conversion applies MySQL's documented NOT, AND, XOR, OR precedence; CASE bodies, BETWEEN separators, and explicit parentheses are preserved. XOR and other unsupported expressions remain opaque rather than gaining visual operators.

Import accepts a filter with or without WHERE, plus an optional trailing semicolon. Empty input imports an empty root, matching PostgreSQL. Extra statements, outer SELECT clauses, executable comments, and optimizer hints are rejected. The adapter returns existing syntax and unsupported-expression error categories. The store replaces the tree only after complete success; failed imports retain the old tree and input draft. Imported nodes receive fresh IDs and use the shared selection and colour assignment workflow.

Import assumes MySQL 8.4 with `ANSI_QUOTES`, `NO_BACKSLASH_ESCAPES`, `HIGH_NOT_PRECEDENCE`, and `PIPES_AS_CONCAT` disabled. These assumptions appear beside the import and raw controls with accessible help associations. Single- and double-quoted strings are decoded using standard MySQL escapes; backticks identify fields. UTF-8 hex strings emitted by the exporter are decoded without replacement characters. Explicit charsets that visual serialization would discard remain raw. Plain strings resembling dates are kept as text; only exact local temporal casts or typed temporal literals become temporal values. Fractional seconds, timezones, invalid calendar values, lossy numeric conversions, changed exact/approximate number typing, mixed value lists, meaningful unsupported casts, and unsupported modifiers are not coerced into visual values.

Structured AND and OR become all and any groups. NOT becomes none; an OR operand supplies its children, and any other operand remains one child. Only groups sharing the same mode are flattened. No NULL branches or other rewrites are added. Supported conditions are editable using the current catalogue; `!=` is normalized to `<>`. Custom pattern escapes remain raw. Imported LIKE without ESCAPE uses the assumed mode's backslash default, which structured export makes explicit.

Valid expressions outside visual capabilities use PostgreSQL's opaque raw-condition fallback when safe. Their source is retained, not regenerated from a PostgreSQL AST. Before acceptance and every export, a raw expression is validated independently of visual conversion. Raw strings with backslash escapes or double quotes, ambiguous NOT precedence, and `||` are rejected rather than silently changing across modes. Raw LIKE requires explicit ESCAPE. Use single quotes with doubled apostrophes or UTF-8 hex literals, explicit OR, and parenthesized NOT operands. Raw export wraps the complete expression in parentheses with a newline before closing, preserving precedence and preventing line comments from consuming surrounding SQL. Switching to the visual editor requires a complete supported single condition; valid unsupported SQL stays in Raw mode. Database switching clears the query, preventing PostgreSQL raw conditions from carrying into MySQL.

Import-mode rules follow MySQL's [string literal reference](https://dev.mysql.com/doc/refman/8.4/en/string-literals.html) and [operator precedence reference](https://dev.mysql.com/doc/refman/8.4/en/operator-precedence.html). New catalogue entries and broader statement import remain outside SQL filter import.

## CREATE TABLE schema import

The existing Schema view is enabled by the MySQL adapter's `importSchemaSql` capability. It uses the installed MySQL grammar to validate every statement and identify explicit column definitions. Indexes, keys, table constraints, column types, generated expressions, and supported table options contribute no suggestions of their own. No types are inferred and no connections are made. Accepted column syntax and options are limited to what the parser can safely distinguish; syntax errors and unsupported constructs return an error without regex extraction or partial results.

Only CREATE TABLE statements with explicit columns are accepted, including TEMPORARY and IF NOT EXISTS when parsed. Separate multiple statements with semicolons; the final semicolon is optional. CREATE TABLE LIKE and CREATE TABLE AS SELECT (including SELECT forms with an explicit column list) are rejected, as are non-CREATE TABLE statements, executable comments, and optimizer hints. At least one column per table is required. Parsing uses the same standard MySQL string and identifier modes as filter import; use backticks for quoted names rather than ANSI_QUOTES double quotes.

Qualification follows PostgreSQL's convention: one distinct table produces plain column names; multiple distinct tables produce `table.column` or `database.table.column` names. Exact duplicate suggestions are removed in first-seen order. Repeated definitions of the same exact table name do not trigger qualification. Identifier spelling and case are retained, with doubled backticks decoded once. Suggestions contain raw names, so the shared MySQL identifier renderer quotes each segment exactly once on SQL export. Reserved words, internal spaces, and embedded backticks therefore work with the existing field selector.

Literal dots, surrounding whitespace, wildcard names, and identifiers outside the renderer's length and Unicode limits cannot be represented faithfully and are rejected. This applies to table qualification segments as well as columns. The submitted schema is fully extracted and validated before suggestions are replaced. Failed imports preserve suggestions and the submitted SQL; successful imports replace suggestions without clearing or rewriting the query. Switching database still clears imported schema suggestions. PostgreSQL's schema importer is unchanged.

CREATE TABLE forms and quoting were reviewed against the MySQL 8.4 [CREATE TABLE reference](https://dev.mysql.com/doc/refman/8.4/en/create-table.html) and [identifier reference](https://dev.mysql.com/doc/refman/8.4/en/identifiers.html).
