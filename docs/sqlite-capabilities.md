# SQLite 3.37+ subset capabilities

The SQLite adapter generates `WHERE` fragments, imports filter expressions, validates source-preserved Raw conditions, and extracts field suggestions from explicit-column `CREATE TABLE` declarations. It uses the existing query tree, Pinia store, editor and import views. It does not execute SQL, connect to databases, inspect SQLite files, provide a backend, or build complete `SELECT` statements.

This document describes the implemented policy from source inspection. Examples and scenario outcomes below are **source-derived expectations, not executed results**. Syntax acceptance and field extraction do not establish execution validity against a database.

## Baseline and parser

[The adapter](../src/databases/sqlite/adapter.ts) advertises **SQLite 3.37+ subset**. The dependency is pinned to `sqlite3-parser@0.7.1` in [package.json](../package.json) and [package-lock.json](../package-lock.json), under the MIT license. Its license also notes that upstream vendored SQLite sources remain public domain. [The private facade](../src/databases/sqlite/parsing/library.ts) imports the public ESM entry `sqlite3-parser/sqlite-3.53.0` and configures `withOptions({ digitSeparator: '' })`.

The library's SQLite **3.53.0 grammar** and the application's **3.37+ supported subset** are distinct. Native parsing alone does not authorize application acceptance. Recursive expression policy, complete schema-clause accounting, version restrictions, identifier representability, and both tokenizer compatibility guards apply after or before parsing as appropriate. JSON arrows, numeric separators, and the newer `IS DISTINCT FROM` / `IS NOT DISTINCT FROM` spellings are excluded. Original operator tokens are inspected because the newer IS spellings collapse into ordinary IS AST nodes.

The saved library inspection found a package-local ESM runtime graph without Node APIs, an execution engine, WASM, external assets or runtime network loading. That is source evidence only: browser bundling, declaration resolution and runtime behavior have not been verified. No successful deployment or execution is implied. The local SQLite SVG and its Simple Icons CC0 provenance are recorded in [the asset notice](../src/assets/databases/README.md); the existing [license notice](../src/assets/databases/LICENSE.md) applies.

## Visual conditions and generation

[Operators](../src/databases/sqlite/operators.ts) use the existing input controls:

| Operators | Input shape | Permitted editor types |
| --- | --- | --- |
| `=`, `<>`, `<`, `<=`, `>`, `>=`, `IS`, `IS NOT` | One value | Text, number, boolean, date, time, datetime, field reference |
| `IN`, `NOT IN` | Nonempty homogeneous list | The same types |
| `BETWEEN`, `NOT BETWEEN` | Exactly two homogeneous endpoints | The same types |
| `IS NULL`, `IS NOT NULL` | No value (`hasValue: false`) | None |
| `IS TRUE`, `IS FALSE`, `IS NOT TRUE`, `IS NOT FALSE` | No value (`hasValue: false`) | None |
| `LIKE`, `NOT LIKE`, `GLOB`, `NOT GLOB` | One pattern | Text or field reference |

Literal SQL `NULL` and duration are outside visual values. Runtime validation rejects malformed nodes or value shapes, missing/sparse array items, heterogeneous lists/ranges, incomplete ranges, unsupported operators/modifiers, nonfinite numbers, and invalid primitive value types. It does not coerce editor values into valid SQL.

[Group generation](../src/databases/sqlite/serialisation/generateGroupSql.ts) emits parenthesized nonempty groups: `all` joins children with `AND`, `any` with `OR`, and `none` applies `NOT` to the OR of its complete children. Empty groups are omitted, including empty `none` groups. An empty root succeeds with an empty string; a nonempty root receives `WHERE`. Nested group operands retain their parentheses. Any invalid child fails the entire result with its node ID where available; no partial SQL is returned. Sparse or malformed children fail rather than disappear.

Native expression precedence drives import: `NOT` binds above `AND`, which binds above `OR`; enclosing parentheses remain semantically effective. `BETWEEN`'s internal `AND` is part of its predicate. `||` is concatenation, never logical OR. Visual conversion normalizes `==` to `=` and `!=` to `<>` only after complete conversion succeeds.

Comparisons follow SQLite affinity and applicable collation rules. `IS` and `IS NOT` are null-safe and do not yield NULL. Ordinary comparisons and negative predicates retain SQL NULL behavior: a NULL-dependent unknown result does not match a WHERE filter. `NOT IN` with a NULL-containing Raw list can yield unknown for an otherwise unmatched operand. `BETWEEN` is inclusive; `NOT BETWEEN` excludes its endpoints. No implicit null-check branches, forced collations, field rewrites or added wildcards are generated.

Native truth predicates use SQLite numeric conversion: nonzero is true and zero is false. `IS TRUE` therefore matches values such as 2, rather than only 1. NULL matches neither `IS TRUE` nor `IS FALSE`, and matches both `IS NOT TRUE` and `IS NOT FALSE`. These predicates generate their native spelling without an operand input.

### Identifiers and literals

[Identifier generation](../src/databases/sqlite/identifiers.ts) interprets the model's dots as qualification separators. A visual field has one to three segments: `column`, `table.column`, or `database.table.column`. Every segment is emitted in double quotes with embedded double quotes doubled, identically on the left and in right-hand field values, including list/range items. For example, model field `main.users.na"me` emits `"main"."users"."na""me"`.

Empty or wildcard (`*`) segments, NUL, invalid surrogate sequences, literal dots within decoded segments, and significant surrounding whitespace that the model cannot preserve are rejected. There is no MySQL length limit or BMP-only restriction; valid supplementary Unicode is retained. Import admits strict double-quoted, backtick and bracket identifier forms. Double quotes and backticks use doubled closing delimiters; bracket quoting ends at the first closing bracket. Single-quoted identifier fallback and double-quoted-string fallback are excluded. Otherwise-supported quoted filter references such as `"a.b"` or `" padded "` remain Raw; unrepresentable schema suggestion names reject the entire schema.

[Literal generation](../src/databases/sqlite/serialisation/conditionLiteral.ts) doubles apostrophes in single-quoted text, preserves backslashes and valid Unicode, and rejects NUL or unpaired surrogates. It adds no charset introducer, escape-string prefix or BLOB replacement. Finite primitive JavaScript numbers use `String(value)` without locale formatting. Boolean editor values generate **`1` / `0`**. A visual boolean comparison can therefore emit `"active" IS 1`; imported `active IS 1` and `active IS 0` remain ordinary comparisons. Imported `active IS TRUE` becomes the native no-value truth predicate. Conversion recognizes intact unquoted TRUE/FALSE operands on the right of IS/IS NOT, retaining native AST distinctions; quoted or qualified references named TRUE/FALSE remain field comparisons. Bare TRUE/FALSE elsewhere stay Raw to preserve name resolution. Neither truth tests nor unquoted TRUE/FALSE expressions are rewritten into numeric booleans. Ordinary imported strings remain text, including date-looking strings.

Temporal values reuse [the existing validator](../src/utils/temporalValue.ts) and emit exact single-quoted `YYYY-MM-DD`, `HH:mm:ss`, and `YYYY-MM-DDTHH:mm:ss` strings. Dates require four decimal year digits and a valid month/day, including leap-year rules; times require hours 00–23 and minutes/seconds 00–59. These are local values at seconds precision, without fractional seconds, timezone conversion, casts or field transformations. Direct comparisons assume matching stored text, including the datetime `T`; differently formatted timestamps are not converted automatically.

### Patterns and modifiers

Visual `LIKE` and `NOT LIKE` use plain SQLite LIKE. `%` matches zero or more characters and `_` one character across the whole value. Ordinary LIKE folds ASCII case, without general Unicode case folding. Backslashes are ordinary pattern characters. The adapter adds neither `ESCAPE` nor wildcards. An explicit admitted `ESCAPE` clause stays Raw. Matching behavior can depend on runtime configuration or function overrides, which the application cannot inspect.

Ordinary `GLOB` is case-sensitive across the whole value: `*` matches zero or more characters, `?` one character, brackets provide classes/ranges, and `[^...]` negates a class. GLOB adds no SQL ESCAPE clause; runtime overrides can affect behavior.

[The nine visual modifiers](../src/databases/sqlite/modifiers.ts) each wrap one field:

| Modifier | Ordinary built-in behavior |
| --- | --- |
| `lower`, `upper` | Convert ASCII letter case, without general Unicode case folding |
| `trim`, `ltrim`, `rtrim` | Remove U+0020 spaces from both, left, or right ends; not all whitespace |
| `length` | Count Unicode characters in text up to its first NUL; BLOB values count bytes and numeric values use their text representation |
| `typeof` | Return the storage-type string `null`, `integer`, `real`, `text` or `blob`; `typeof(NULL)` returns the text `'null'`, not SQL NULL |
| `abs` | Apply SQLite numeric coercion and take the absolute value; nonnumeric text/BLOB yields 0.0 and the minimum signed 64-bit integer overflows |
| `round` | Apply numeric coercion and round to zero decimal places, returning a floating-point value |

The ordinary built-in modifiers other than `typeof` propagate NULL. Input storage types and overridden functions affect results; the editor does not evaluate them or infer their result types. `typeof(value) = 'integer'` imports as a single-field modifier comparison and exports with the native `TYPEOF` call. Optional math functions and modifiers such as `initcap`, `reverse`, `floor`, `ceil`, `trunc` and `sqrt` are excluded.

## Filter boundaries, Raw policy and fidelity

[Filter parsing](../src/databases/sqlite/parsing/parseWhere.ts) accepts **one expression**, with an optional initial significant unquoted `WHERE` and at most one final significant semicolon. Validated whitespace/comments-only input imports an empty root. Bare `WHERE`, `WHERE` plus only trivia, and a lone terminator fail. Full SELECT statements, appended clauses such as ORDER BY/LIMIT, extra statements, nonfilter commands and wrapper escapes fail. Native tokens determine boundaries without splitting inside quoted text or comments.

Ordinary line/block comments are admitted. Unterminated quotes/comments, NUL, unpaired surrogates, executable-comment forms `/*!...*/` / `/*M!...*/` (case-insensitive M), and optimizer hints `/*+...*/` are rejected. The same characters inside otherwise-supported quoted tokens are not interpreted as comment syntax.

[Raw validation](../src/databases/sqlite/parsing/validateRaw.ts) requires complete guarded library parsing **and** [recursive subset validation](../src/databases/sqlite/parsing/validateExpression.ts), independently of visual conversion. Failed visual conversion alone never grants Raw eligibility. Every operand, list item, endpoint, function argument, CASE base/WHEN/THEN/ELSE branch, collation and ESCAPE is validated.

### Accepted preservation and scalar forms

Raw preserves the following otherwise-supported forms without discarding their syntax:

- Mixed, NULL-containing and empty `IN` / `NOT IN` lists; literal NULL operands outside visual null checks.
- Precision-sensitive decimals; hexadecimal integers with one to sixteen hex digits.
- Nested allowlisted modifiers, modified right-hand fields, and two-argument `trim`, `ltrim`, `rtrim` or `round`.
- `LIKE` / `NOT LIKE` with a direct or scalar-parenthesized single-quoted constant ESCAPE containing exactly one Unicode scalar character.
- ASCII-compared built-in `BINARY`, `NOCASE` and `RTRIM` collations.
- Unquoted TRUE/FALSE outside a representable truth-test operand, truth tests whose left-hand expression cannot be represented visually, comments, and otherwise-supported quoted references with literal dots or significant surrounding whitespace.

The practical additional scalar subset admits one-expression parentheses; unary `+`, `-`, `~` and `NOT`; arithmetic `+`, `-`, `*`, `/`, `%`; concatenation `||`; bitwise `&`, `|`, `<<`, `>>`; scalar comparisons and logical predicates; inclusive BETWEEN in either polarity; IN lists in either polarity; LIKE/GLOB in either polarity; postfix null-check aliases (`ISNULL`, `NOTNULL`, `NOT NULL`); simple and searched `CASE`; blobs such as `X'00FF'`; and `CURRENT_DATE`, `CURRENT_TIME`, `CURRENT_TIMESTAMP`. References have one to three strictly interpreted segments. These additional forms require Raw when the visual model cannot retain the whole expression.

Decimal tokens permit digits with an optional fractional part (including `1.`), or a leading decimal point with digits (such as `.5`), optionally followed by an e/E exponent with an optional sign and digits. Unary signs are separate expression nodes. Exact original spellings are checked without rounding or evaluating overflow/underflow during Raw policy validation.

Filter calls admit the nine core names above plus six Raw-only scalar functions and five Raw-only date/time functions. Names must be unqualified; strictly quoted names denoting these built-ins after dequoting and ASCII comparison are also accepted. `lower`, `upper`, `length`, `abs`, `typeof` require exactly one argument; `trim`, `ltrim`, `rtrim`, `round` allow one or two.

| Raw-only filter function | Accepted argument count |
| --- | --- |
| `coalesce` | At least 2 |
| `ifnull`, `nullif`, `instr` | Exactly 2 |
| `substr` | 2 or 3 |
| `replace` | Exactly 3 |
| `date`, `time`, `datetime`, `julianday` | Zero or more: optional time value followed by modifiers |
| `strftime` | At least 1: format, optional time value, then modifiers |

These six scalar functions, five date/time functions and `typeof` are filter-only; schema DEFAULT/CHECK acceptance retains the original eight-function allowlist. Every argument is recursively validated in the same context, including arguments SQLite could skip at runtime. Wrong arity or any unsupported descendant, such as a binding, subquery or arbitrary call, rejects the complete input. Function decorations remain excluded. The validator does not assume argument storage types or evaluate calls.

The six scalar functions have no visual modifiers or argument controls. For example, `coalesce(a, ifnull(b, '')) = 'x'` remains Raw through import and export with its source preserved. Raw-to-visual conversion explains that Raw mode is required to preserve the function arguments and source; failed conversion retains the existing Raw condition. Nested calls and right-hand scalar calls also use the established Raw preservation path.

The five date/time calls also remain Raw, without visual modifiers or argument controls. Their literal policy is based on the [official SQLite 3.37.0 `src/date.c`](https://raw.githubusercontent.com/sqlite/sqlite/version-3.37.0/src/date.c), rather than the installed parser's newer grammar:

- A time-value argument can be any recursively accepted expression; the editor does not evaluate it or validate its date contents.
- Literal modifiers (including single-expression parenthesized string literals) accept ASCII-case-insensitive `start of day`, `start of month`, `start of year`, `weekday 0` through `weekday 6`, `unixepoch`, `localtime` and `utc`. Legacy numeric shifts accept singular/plural second, minute, hour, day, month and year units, optional signs, fractional amounts and decimal exponents. Clock shifts accept `HH:MM`, `HH:MM:SS` or `HH:MM:SS.fraction`, with an optional sign (hours 00–24, minutes/seconds 00–59). This checks supported spellings, not whether a particular date/modifier sequence yields a non-NULL result.
- Literal `strftime` formats (also through scalar parentheses) accept text and only `%d`, `%f`, `%H`, `%j`, `%J`, `%m`, `%M`, `%s`, `%S`, `%w`, `%W`, `%Y` and `%%`. Unknown/newer directives and an unfinished `%` fail with source-aware feedback.
- Newer literal modifiers such as `auto`, `julianday`, `subsec`, `subsecond`, `floor`, `ceiling`, and extended `±YYYY-MM-DD` date shifts are rejected. `unixepoch()` and `timediff()` calls are unavailable.
- Dynamic formats and modifiers are allowed whenever their expressions pass the same recursive restrictions. Their contents are not statically evaluated: runtime values may be unsupported by SQLite 3.37, so baseline compatibility is **not guaranteed for dynamic formats/modifiers**. Nested literals used as arguments to another date/time call still receive that call's literal checks.
- `date()`, `time()`, `datetime()`, `julianday()` and format-only calls such as `strftime('%Y')` use SQLite's native current-time default. Results depend on execution time. Import/export retains the omitted argument without inserting an explicit time value. `strftime()` fails arity validation.

For example, `date(created_at, 'start of month', '+1 month') = '2026-11-01'`, `strftime('%Y', created_at) = '2026'`, `date(created_at, modifier_column) = '2026-11-01'` and `strftime(format_column, created_at) = '2026'` remain Raw and export with their calls, arguments and order preserved. Invalid arity, disallowed literals, decorations or unsupported descendants reject the complete input. The expansion applies only to filter conditions and does not widen schema DEFAULT/CHECK acceptance.

Excluded forms include CAST, row values, variables/bindings, arbitrary or optional-math functions, qualified calls, star calls, DISTINCT/ALL, argument ordering, WITHIN GROUP, FILTER/OVER decorations, aggregates/windows, subqueries, IN-table forms, EXISTS, SELECTs/CTEs, JSON arrows, MATCH/REGEXP/extensions, RAISE, custom collations, nonconstant or multi-character ESCAPE, GLOB ESCAPE, numeric separators, newer DISTINCT FROM spellings, and all unlisted AST forms/operators. Raw is not unrestricted SQL pass-through. NameExpr/KeywordLiteral nodes are excluded from filters, with only the narrowly specified schema DEFAULT exceptions below.

### Numbers and original source

[Numeric conversion](../src/databases/sqlite/parsing/numericValue.ts) compares the original exact decimal spelling with the regenerated JavaScript number spelling using canonical sign, coefficient and BigInt exponent, without expanding powers of ten. Conversion additionally requires a finite value, safe integer range where applicable, no negative zero, and preservation of integer versus real token category. A comparison of rounded floating-point values is not used as a fidelity check.

| Imported numeric operand | Source-derived conversion policy |
| --- | --- |
| `0.1`, `1e-2` | May convert to visual numbers while preserving exact decimal value and category |
| `0.10000000000000001`, `9007199254740993` | Raw: visual numeric precision/range cannot preserve them |
| `-0.0`, `1e309`, underflow spellings losing their nonzero value | Raw: sign or finite/exact value cannot be preserved |
| `1.0` | Raw: regeneration would change a real token to an integer token |
| Hexadecimal integer | Raw: original spelling/category is not visual decimal output |

[Logical decomposition](../src/databases/sqlite/parsing/expression.ts) follows native AST nodes. Raw leaves retain original source envelopes, including spelling and comments, excluding accepted WHERE/terminator boundary tokens. Trivia before a logical operator belongs to the left child, trivia after it to the right; outer trivia reaches the first/last descendants. Comment-bearing leaves remain Raw because the visual model cannot store comments. Successfully visualized leaves can normalize aliases, numeric spelling and harmless whitespace. There is no promise of byte-identical regeneration of the entire submitted filter.

[Generation](../src/databases/sqlite/serialisation/generateConditionSql.ts) revalidates every Raw leaf through the facade, then encloses its complete source in parentheses with a newline before the closing parenthesis. A trailing line comment cannot swallow generated closing syntax. [SQLite preview and copy](../src/components/QueryPreview.vue) bypass formatting if any Raw condition exists at any depth, including a none group. Visual-only SQLite output uses the installed SQLite formatter dialect, with original generated SQL as the exception fallback. No formatter upgrade was introduced.

### Atomic imports, conversion and diagnostics

[Filter import](../src/databases/sqlite/parsing/importWhere.ts) validates the complete submission before constructing a local tree. Native AND/OR/NOT become all/any/none groups with fresh IDs through `createId`. [Visual conversion](../src/databases/sqlite/parsing/importCondition.ts) requires one complete supported condition with a representable field or one single-field modifier, fully representable literal or unmodified right-hand fields, and homogeneous list/range values; the strict visual renderer gates success. It never drops semantic clauses or unsupported descendants.

Raw-to-visual conversion accepts exactly one fully representable condition, allowing harmless scalar parentheses. Logical expressions and preservation-only leaves fail with a reason for remaining Raw. [The store](../src/stores/queryStore.ts) changes the query or schema suggestions only on complete success, and changes a Raw condition to visual only after conversion succeeds. Failed filter/schema imports retain previous state and submitted drafts; failed conversion retains the Raw source and state. Editing Raw can temporarily store incomplete/invalid text, but generation validation then fails and copying is disabled.

Existing result contracts are preserved. Filter errors distinguish `syntax` (malformed admitted grammar), `unsupported-expression` (excluded constructs/policy), `unsupported-operator` (recognized disallowed operators), and `unsupported-value` (prohibited values/references or tokenizer compatibility failures). Eligible precision-sensitive values and unrepresentable quoted filter references use Raw rather than rejection. Errors include original fragments and useful locations. Schema failures return an error string; generation failures use `SqlResult` with the offending node ID where available. Public parsing/import/generation entry points contain exceptions and do not expose partial SQL/suggestions.

## CREATE TABLE field suggestions

[Schema import](../src/databases/sqlite/schema/importSchema.ts) guards and parses the entire program before extracting fields. [Clause validation](../src/databases/sqlite/schema/validateSchema.ts) and [its token cursor](../src/databases/sqlite/schema/cursor.ts) account for every admitted clause alongside the native AST.

Accept one or more semicolon-separated ordinary, TEMP or TEMPORARY `CREATE TABLE` declarations with explicit nonempty column definitions, optional `IF NOT EXISTS`, optional database qualification, supported identifier quoting, and ordinary comments. The final semicolon is optional. Empty separators are tolerated only alongside supported tables; empty, separator-only and no-column submissions fail. Nested expression/type commas are handled by native structure, not string splitting.

Ordinary columns may be typeless or use multiword identifier-based declared types with zero, one or two signed decimal numeric parameters, such as `DECIMAL(10,2)`. Types and constraints do not infer editor types, import constraints into query state, restrict available operators, or synthesize rowid/alias fields.

### Constraints and options

| Constraint/context | Accepted syntax within the subset |
| --- | --- |
| Named inline/table constraint | `CONSTRAINT name` immediately attached to a supported constraint |
| Inline PRIMARY KEY | Optional ASC/DESC, ON CONFLICT and bounded AUTOINCREMENT |
| Inline NOT NULL, explicit NULL, UNIQUE | Optional ON CONFLICT |
| Inline DEFAULT | Context-specific expression policy below |
| Inline CHECK | One validated parenthesized expression; no inline ON CONFLICT |
| Inline COLLATE | BINARY, NOCASE or RTRIM |
| Inline REFERENCES | Unqualified target table, optional nonempty plain reference columns, bounded options and attached deferrability |
| Table PRIMARY KEY / UNIQUE | Nonempty unqualified names, optional per-name built-in COLLATE and ASC/DESC, optional ON CONFLICT; no expressions, NULLS ordering or table AUTOINCREMENT |
| Table CHECK | Validated parenthesized expression and optional ON CONFLICT |
| Table FOREIGN KEY | Nonempty plain local names and the supported REFERENCES/deferrability clauses |

ON CONFLICT actions are limited to `ROLLBACK`, `ABORT`, `FAIL`, `IGNORE`, `REPLACE`. AUTOINCREMENT requires an inline unparameterized `INTEGER PRIMARY KEY`, without DESC or WITHOUT ROWID. FK local/reference lists prohibit ordering and collations. REFERENCES targets are unqualified; local/reference names and constraint names never become suggestions.

`ON DELETE` and `ON UPDATE` may each occur once, in either order, with SET NULL, SET DEFAULT, CASCADE, RESTRICT or NO ACTION. MATCH may occur once with SIMPLE, FULL or PARTIAL. These MATCH names are admitted syntactically, but SQLite ignores the requested MATCH semantics. Custom MATCH and ON INSERT are excluded. DEFERRABLE or NOT DEFERRABLE may take INITIALLY DEFERRED/IMMEDIATE and must attach to its FK declaration; INITIALLY alone fails. Inline separate deferrability nodes must immediately follow REFERENCES without a naming prefix. Dangling, repeated, displaced or incorrectly attached CONSTRAINT prefixes fail through complete source-token accounting, including prefixes discarded by library reducers.

| Expression context | Exact application policy |
| --- | --- |
| Bare DEFAULT | Single-quoted string, blob, NULL, decimal/signed decimal literal, unquoted TRUE/FALSE or CURRENT_DATE/CURRENT_TIME/CURRENT_TIMESTAMP. Signs apply only to numeric literals. No references or arbitrary calls. |
| Parenthesized DEFAULT | Admitted scalar grammar, CASE, allowlisted functions/arities, built-in collations and permitted literals; no references, bindings, subqueries or hexadecimal values. Only unquoted TRUE/FALSE are identifier-form constants. |
| CHECK | Admitted scalar grammar, CASE, blobs and allowlisted functions/arities, with unqualified references; no qualified references, current-time constants, bindings, subqueries or arbitrary functions. |

Hexadecimal DEFAULT values are excluded in every DEFAULT context. Every expression descendant is validated, including unused CASE branches. Parenthesized/signed DEFAULT wrapper spans can include DEFAULT itself; the implementation consumes the actual child expression and syntax tokens. DEFAULT/CHECK validation uses the already-guarded program AST, without reparsing unguarded slices or granting unknown functions acceptance.

Schema DEFAULT/CHECK calls remain limited to `lower`, `upper`, `length`, `abs`, `trim`, `ltrim`, `rtrim` and `round` with their existing arities. Filter-only `typeof`, `coalesce`, `ifnull`, `nullif`, `instr`, `substr` and `replace` support does not expand schema acceptance.

STRICT requires one declared type token denoting `INT`, `INTEGER`, `REAL`, `TEXT`, `BLOB` or `ANY`, without parameters or multiword/custom types. STRICT and WITHOUT ROWID may occur separately or together, in either comma-separated order. Repeated or quoted option words, missing commas and unknown suffixes fail; source tokens are checked rather than trusting collapsed AST flags.

Generated columns (including abbreviated AS), CREATE TABLE AS SELECT, virtual tables, views, indexes, triggers, ALTER, PRAGMA, CLI dot commands and other unsupported statements/clauses are excluded. One excluded clause or unrepresentable suggested identifier rejects the entire schema and leaves previous suggestions intact.

### Qualification, deduplication and validity

Table identities and suggestions use ASCII-only A–Z folding for deduplication, retaining first spelling and insertion order. Repeated lexical table identities merge; absent and explicit database qualifiers remain distinct. Unicode case folding is not used. One distinct unqualified table produces `column`; multiple distinct tables produce `table.column` for unqualified tables. Explicit database qualification **always** produces `database.table.column`, even for one imported table. Every suggestion must round-trip through visual field generation.

The help's schema example is within this syntax subset:

```sql
CREATE TABLE main.users (
  id INTEGER PRIMARY KEY,
  status TEXT,
  active INTEGER,
  created_at TEXT
) STRICT, WITHOUT ROWID;
```

Its source-derived suggestions are `main.users.id`, `main.users.status`, `main.users.active`, `main.users.created_at`. The corresponding help filter is:

```sql
WHERE "main"."users"."status" = 'online' AND "main"."users"."active" IS TRUE
```

Both conditions can become visual; the truth test retains native `IS TRUE` generation. Boolean value-editor output still uses numeric `1`/`0`, for example `"main"."users"."active" IS 1`, which is an ordinary comparison.

Schema acceptance is syntax validation and extraction only. It does not establish database/table existence, FK target resolution/cardinality, stored-value compatibility, argument types, runtime overrides, or all engine constraint rules. For example, a syntactically admitted WITHOUT ROWID table lacking a primary key can still be rejected by SQLite on execution. No engine constraint emulation or SQL execution is provided.

## Two distinct Unicode tokenizer compatibility restrictions

**Actual U+FEFF** is one UTF-16 code unit (UTF-8 EF BB BF). The visible sequence **ï»¿** is three distinct characters, **U+00EF U+00BB U+00BF**, three UTF-16 code units (UTF-8 C3 AF C2 BB C2 BF). They are different submissions and trigger different rules.

[The preflight](../src/databases/sqlite/parsing/source.ts) tokenizes the complete source with `emitTrivia: true`, obtains public token names, and examines exact source slices before dropping trivia or recognizing emptiness/boundaries:

1. Reject an **unquoted native ID** token whose exact slice **starts with actual U+FEFF**. The selected library includes it in the name, while SQLite treats it as boundary whitespace. The error retains the whole offending ID and names U+FEFF.
2. Separately reject a **native SPACE** token whose exact slice **equals U+00EF U+00BB U+00BF**. The selected library misclassifies those three visible characters as SPACE and would otherwise discard them. The error retains that exact three-character slice.

These are **selected-library compatibility restrictions, not invalid SQLite syntax and not global character bans**. They apply at token boundaries anywhere, not only at the beginning of input. Quoted identifiers, single-quoted strings, ordinary comments, and occurrences after the first character of an intact identifier pass these two gates, subject to other subset/model rules. In particular, the model's `trim()` representability check can still keep quoted leading/trailing U+FEFF names Raw or reject them as schema suggestions; passing compatibility does not guarantee visual conversion. Input is not stripped, normalized, repaired, reinterpreted or automatically quoted.

### Facade and location review

The configured native parser remains private in [library.ts](../src/databases/sqlite/parsing/library.ts); native `parse` / `parseStmt` calls follow `prepareSqliteSource`. `prepareSource` preflights the complete original **and every derived buffer**. The reviewed flow covers:

| Entry/buffer | Source path and guard |
| --- | --- |
| Filter import, Raw conversion | `importWhere.ts` → `parseWhere.ts` → original `prepareSqliteSource`, before empty/boundary checks |
| Raw acceptance and generation revalidation | `validateRaw.ts` → `parseWhere.ts`; generation forwards compatibility errors with a node ID |
| Equal-width private expression buffer | Only validated WHERE/semicolon spans are blanked with ASCII spaces; the buffer and its complete original are preflighted again |
| Fixed `SELECT 1 WHERE (\n…\n)` wrapper | `wrapSqliteSource` marks synthetic regions; guarded `parseSqliteStatement` uses `allowTrailing: false` and complete structural checks |
| Diagnostic-only program parse | `filterFailure` calls guarded `parseSqliteProgram`, preserving terminal compatibility failure |
| Reassembled Raw leaf envelopes | `rawSourceBuffer` maps each original slice; `validateSqliteRaw` guards both the complete original and assembled source |
| Whole schema, including later statements and expression descendants | `importSchema.ts` → guarded `parseSqliteProgram`; DEFAULT/CHECK validate that prepared AST without new parsing |

No application native-parser entry bypass was found. Source mappings retain original fragments, line/column and UTF-16 offsets; astral characters count as two UTF-16 units. Synthetic wrapper diagnostics are identified and reported as missing/incomplete expression boundaries rather than fictitious submitted characters. Compatibility errors are terminal filter `unsupported-value` failures, never accepted Raw fallback. Conversion/schema contracts propagate their messages; generation preserves the offending node ID where available. Store mutation occurs only after success.

### Source-only compatibility scenarios

Here **`<U+FEFF>` means insert the actual U+FEFF code point**, not the literal angle-bracket placeholder. **`<U+00EF U+00BB U+00BF>` means insert the three characters ï»¿**. Each schema fragment below is considered inside an otherwise supported complete declaration where necessary. Outcomes are source-derived expectations only.

| Submitted source/context | Expected source-policy outcome |
| --- | --- |
| Standalone `<U+FEFF>` | Unquoted-ID compatibility failure before empty-root recognition; whole original ID/location retained |
| `<U+FEFF>x = 1`; `WHERE <U+FEFF>x = 1`; `x = 1 AND <U+FEFF>y = 2` (separate inputs) | Same terminal compatibility rejection at the first or later predicate; no changed field or partial tree |
| Standalone `<U+00EF U+00BB U+00BF>`; `<U+00EF U+00BB U+00BF>x = 1`; `WHERE <U+00EF U+00BB U+00BF>x = 1`; `x = 1 AND <U+00EF U+00BB U+00BF>y = 2` | Exact SPACE-token compatibility rejection; three original units retained, never truncated to x/y or accepted as empty |
| Either affected boundary sequence in Raw validation or Raw-to-visual conversion | Guarded failure; conversion does not mutate Raw source or state |
| A nested Raw condition containing either affected boundary sequence during generation | Complete SqlResult failure with the Raw node ID where available; no partial preview SQL and copying disabled |
| `CREATE TABLE <U+FEFF>t (x INT)`; `CREATE TABLE t (<U+FEFF>x INT)`; their three-code-point counterparts | Whole-schema compatibility rejection before suggestions |
| `CREATE TABLE ok (x INT); CREATE TABLE later (<U+FEFF>y INT)`; corresponding later three-code-point token | Later statement rejects the whole submission; previous suggestions and draft remain |
| `CONSTRAINT <U+FEFF>c UNIQUE`; `REFERENCES <U+FEFF>parent(id)`; `REFERENCES parent(<U+FEFF>id)`; corresponding three-code-point cases | Whole-source guard covers constraint/reference tokens that would never become suggestions |
| `DEFAULT (<U+FEFF>TRUE)`; `CHECK (<U+FEFF>x > 0)`; `DEFAULT (<U+00EF U+00BB U+00BF>TRUE)`; `CHECK (<U+00EF U+00BB U+00BF>x > 0)` | Preflight fails before native AST/schema expression policy can discard or reinterpret the affected token |
| `"a<U+FEFF>x" = 1`, backtick/bracket counterparts, and quoted three-code-point counterparts | Compatibility gates preserve quoted tokens; otherwise-supported representable references may convert visually |
| `"<U+FEFF>x" = 1`; `"x<U+FEFF>" = 1` | Pass compatibility, remain Raw because segment trim-based representability would lose significant U+FEFF |
| `CREATE TABLE "<U+FEFF>t" (x INT)`; `CREATE TABLE t ("<U+FEFF>x" INT)` | Pass compatibility, fail atomically as unrepresentable suggestions; not a tokenizer error |
| `CREATE TABLE "ï»¿t" ("ï»¿x" INT)`; `CREATE TABLE "a<U+FEFF>t" ("a<U+FEFF>x" INT)` | Pass compatibility and model gates; full quoted names retained in suggestions |
| `a<U+FEFF>x = 1`; `aï»¿x = 1` | Intact embedded-ID occurrences pass; no global removal/rejection |
| `x = '<U+FEFF>'`; `x = 'ï»¿'` | Single-quoted strings pass compatibility and retain all characters as text |
| `/* <U+FEFF> ï»¿ */ x = 1`; `x = 1 -- <U+FEFF> ï»¿` | Ordinary comments pass compatibility, stay within Raw envelopes, and generate with newline-safe closing syntax |
| `WHERE "😀" = 9007199254740993 -- tail` | Astral quoted reference passes; precision-sensitive number stays Raw at original UTF-16 offset 13 (code-point offset would be 12) |
| `WHERE "😀" = 1 AND <U+FEFF>y = 2` and three-code-point counterpart | Later compatibility diagnostics map past the astral character in original UTF-16 coordinates, with the affected sequence explicitly named |

## Editor integration and source-only acceptance review

[Registry integration](../src/databases/DatabaseDefinitions.ts) adds SQLite to PostgreSQL, MySQL and MariaDB; [the adapter type](../src/types/databaseAdapter.ts) adds only the SQLite formatter dialect. SQLite-native types stay under `src/databases/sqlite/`. Shared query model, conversions, Pinia ownership and existing-mode dispatch are preserved; no Elasticsearch mode or new editing surface was added.

[Database selection](../src/components/DatabaseList.vue) requires a second activation of the same different target before clearing state. Selecting the active target again retains state. `changeDatabase` clears query/schema state only for a different supported target. [App component keys](../src/App.vue), [builder selection handling](../src/components/QueryBuilder.vue), and import watchers reset drafts, help expansion, validation feedback, selection and editor state. [Preview revision tracking](../src/components/QueryPreview.vue) clears copy feedback on edits/switches and prevents a pending clipboard result from reporting success/error for a different query/database. User display preferences remain independent.

[Query import](../src/components/QueryImport.vue) and [schema import](../src/components/SchemaImport.vue) have named textareas, error descriptions/invalid state, alert errors and polite success announcements. Existing [collapsible help](../src/components/CollapsableHelp.vue) has named keyboard-accessible buttons, expanded state and controlled/described content. [Condition controls](../src/components/ConditionPanel.vue) preserve named Raw input, mode buttons, announced conversion/generation feedback and errors tied to the condition. Output uses [SQL highlighting with plain-text fallback](../src/components/QueryDisplay.vue); generation failure replaces the query preview with an alert and disables copying. The SQLite import submit buttons deliberately use nonempty **draft length**, not `trim()`, so standalone U+FEFF reaches the guard; other modes retain their previous readiness behavior.

All SQLite-created functions, the renderer's catalogue callback, and the SQLite-changed preview functions/callback have preceding short comments. Unchanged legacy functions were not annotated or refactored.

Additional source-reviewed scenarios:

| Scenario | Reviewed policy/path |
| --- | --- |
| Nested all/any/none with empty none children and an invalid deeper child | `generateGroupSql.ts` omits only valid empty groups; failure propagates the child ID and returns no partial SQL |
| `WHERE age BETWEEN 18 AND 30 OR active == 1 AND score != 5` | Native BETWEEN remains one predicate; AND nests beneath OR; aliases convert to canonical IDs |
| `name \|\| '!' = 'Ben!'`; `a = 1 < b` | Native scalar structure remains Raw; concatenation does not become an any group |
| Apostrophes, backslashes, reserved words, doubled quotes, astral names, `"a.b"` and `" padded "` | Literal/identifier guards preserve representable values; unrepresentable quoted filter references stay Raw; schema suggestion equivalents fail |
| Empty/mixed/NULL lists, `1.0`, unsafe integers, signed negative zero, overflow/underflow | Recursive policy admits preservation cases; numeric/visual checks retain complete Raw source |
| `lower(trim(name, ' ')) = upper(other)`; `name COLLATE NOCASE = 'A'`; `name LIKE 'a!_%' ESCAPE '!'` | Every call/operand/clause validated and preserved; visual conversion cannot drop them |
| `/* before */ WHERE x = 1 /* between */ AND y = 2 -- after` | Native logical split assigns comments to leaf envelopes; each extracted Raw buffer is mapped and revalidated |
| Full SELECT, appended ORDER BY/LIMIT, two expressions separated by semicolon, wrapper escape, malformed/comment-policy failures | Boundary/structural/preflight gates fail before store replacement |
| `WHERE x = 'a;--b' /* ; */;` | Quoted/comment semicolons remain within their native tokens; only the final significant terminator is excluded |
| `CREATE TEMPORARY TABLE draft (note, amount DECIMAL(10,2) DEFAULT -1.5)` | Typeless/type-parameter syntax and signed DEFAULT token/AST spans accounted for |
| STRICT/WITHOUT ROWID in either comma order; invalid STRICT type; repeated/quoted option; dangling/repeated CONSTRAINT | Complete suffix/prefix validation, STRICT type validation and atomic failure |
| `CREATE TABLE Users (ID INT); CREATE TABLE users (id INT, Name TEXT)` | Repeated ASCII-equivalent table/column identities merge, preserving first spelling/order: ID, Name |
| One unqualified table; multiple unqualified tables; one explicit `main` table; absent versus explicit qualifiers | Qualification uses distinct table identities and always retains explicit database qualifiers |
| Supported first schema statement followed by a view, unsupported CHECK descendant or unrepresentable suggested name | Entire import fails; previous suggestions and submitted draft remain |
| Failed Raw conversion, failed generation, database switch during pending copy | Conversion leaves state intact; generation disables copy; revision/database checks discard stale feedback |

### Requirement and saved-decision coverage

Every R1–R27 is mapped below; these are source-review claims, not runtime acceptance results.

| Requirements | Source coverage and documentation section |
| --- | --- |
| R1–R3 | `adapter.ts`, `DatabaseDefinitions.ts`, `databaseAdapter.ts`, package/asset changes; Baseline and Editor integration |
| R4 | `serialisation/generateGroupSql.ts`, `generateWhereSql.ts`; Visual conditions and scenario table |
| R5–R8 | `identifiers.ts`, `unicode.ts`, `serialisation/conditionLiteral.ts`, unchanged `temporalValue.ts`; Identifiers and literals |
| R9–R11 | `operators.ts`, `modifiers.ts`, `serialisation/renderVisualComparison.ts`; Operator/pattern/modifier tables |
| R12–R13 | `parsing/source.ts`, `library.ts`, `parseWhere.ts`, `expression.ts`; Boundaries, facade and scenarios |
| R14–R15 | `parsing/validateExpression.ts`, `importCondition.ts`, `numericValue.ts`; Practical Raw and fidelity |
| R16–R18 | `parsing/validateRaw.ts`, `importWhere.ts`, `serialisation/generateConditionSql.ts`, `queryStore.ts`; Atomicity and guarded generation |
| R19–R23 | `schema/importSchema.ts`, `cursor.ts`, `validateSchema.ts`, `validateSqliteSchemaExpression`, `queryStore.ts`; Complete schema subset and qualification |
| R24–R25 | `parsing/source.ts`, parser/import/generation result boundaries, `QueryPreview.vue`; Diagnostics, atomicity and disabled copy |
| R26 | This document and `adapter.ts` help/placeholders |
| R27 | `DatabaseList.vue`, `App.vue`, `QueryBuilder.vue`, `QueryImport.vue`, `SchemaImport.vue`, `ConditionPanel.vue`, `CollapsableHelp.vue`, `QueryPreview.vue`, `QueryDisplay.vue`; Editor integration |

All eight saved answers are reflected: the pinned SQLite-capable library; practical recursively validated Raw coverage; SQLite 3.37+ with STRICT/WITHOUT ROWID; unchanged temporal strings; plain LIKE without automatic ESCAPE; visual IS/IS NOT; explicit database qualification even for one table; and the approved narrow U+FEFF compatibility rejection alongside the separate three-character SPACE-token guard. The dedicated compatibility section traces the approved amendment through all original and derived entry points. No unresolved requirement or saved-decision conflict was found in this source-only review.

## Verification limits

No tests were created or changed. No tests, formatting, linting, type checks, builds, parser/formatter harnesses, dependency installation or SQL execution were performed in this documentation/review stage. Runtime parsing, browser bundling, TypeScript declaration resolution, formatter behavior and clipboard behavior remain unverified. COMPLETE for this stage means ready for source review, not runtime verification.
