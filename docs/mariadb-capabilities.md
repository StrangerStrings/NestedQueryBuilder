# MariaDB 11.4 LTS capabilities

The registered MariaDB adapter supports visual WHERE export, SQL filter import, raw editing, and CREATE TABLE field suggestions through the existing database UI. SQL formatting uses the installed formatter’s `mariadb` dialect and highlighting uses the existing `sql` configuration.

## Comparisons and character length

MariaDB has explicit operator and modifier catalogues independent of future MySQL additions. Alongside the existing comparisons, it exposes `<=>` with the existing scalar types (text, finite number, boolean, local date/time/datetime, or field reference), plus `REGEXP` and `NOT REGEXP` with a single text pattern or field reference.

Native `<=>` treats two NULLs as equal, and a NULL and a non-NULL value as unequal. Literal NULL has no visual input: comparisons with NULL on either side remain validated Raw SQL without rewriting them. REGEXP and NOT REGEXP use native MariaDB regular-expression semantics; use anchors for a whole-text match. Case sensitivity follows the applicable collation. NOT REGEXP retains SQL NULL semantics. Patterns use ordinary SQL string escaping, with no LIKE ESCAPE clause, wildcard insertion, pattern rewriting, or JavaScript regex validation.

The existing single-field modifier selector includes `CHAR_LENGTH`, which counts characters; `LENGTH` continues to count bytes. Other existing modifiers remain available. Field types and server coercion are still the database's responsibility.

For example, `a <=> b`, `name NOT REGEXP pattern_column`, and `CHAR_LENGTH(name) > 3` become visual conditions. MariaDB import also recognizes `RLIKE` and `NOT RLIKE`, normalizing visual exports to `REGEXP` and `NOT REGEXP`. Raw SQL retains its original source spelling. These aliases do not add visual import support to other databases.

## Parsing boundary

The installed `dt-sql-parser` 4.5.1 provides a MySQL grammar, not a MariaDB dialect. The common parser validates one WHERE expression, optionally preceded by WHERE and optionally followed by a single semicolon. It rejects additional statements and trailing SELECT clauses. MariaDB then independently checks the complete token stream against a documented syntax subset; MySQL grammar acceptance alone never enables a construct.

The subset contains the existing MariaDB comparison, membership, range, null-check, LIKE, NULL-safe equality, and regular-expression operators (including RLIKE aliases); AND, OR, NOT, and the AND spelling `&&`; qualified identifiers; text, UTF-8 hex text, decimal/scientific numbers, booleans, and local temporal values; and the existing single-argument modifier functions. CAST is limited to DATE, TIME, and DATETIME. Typed DATE/TIME/TIMESTAMP literals use the visual editor's exact local seconds-precision values and date years 1000–9999.

Modifier names must be adjacent to their opening parenthesis, as in `LOWER(field)`. Whitespace and comments in that position are rejected because IGNORE_SPACE is not assumed.

Only `_utf8mb4` charset introducers are accepted. Bare hexadecimal literals are limited to a one-byte LIKE ESCAPE constant. COLLATE is limited to the documented `utf8mb4_bin` and `utf8mb4_general_ci` names. These clauses remain raw; the editor gains no collation or cast controls. Other casts, charsets, collations, functions, operators, subqueries, JSON arrows, and unverified syntax are rejected with an unsupported-expression error rather than passed through.

## Visual conversion and raw preservation

Shared conversion creates visual conditions only when the complete expression can be represented without dropping casts, charsets, modifiers, or suffixes. It retains the existing numeric precision checks, homogeneous list/range checks, raw-name identifier model, temporal validation, and backslash pattern rules. The exporter’s `_utf8mb4 X'…'` text and `ESCAPE _utf8mb4 X'5c'` forms are recognized by the parser's existing lexical extensions without changing SQL text.

Compatible but unrepresentable expressions can stay raw, including mixed lists, NULL list items, nested existing modifiers, modified right-hand field references, temporal field casts, custom constant LIKE escapes, supported collations, and numbers that would lose precision in the visual model. Raw text is not regenerated through a visual condition or another database's AST.

Every raw expression is validated before fallback import and on every export. Raw validation is separate from conversion to a single visual condition. Logical raw expressions may be exported but cannot become one visual condition. Raw export surrounds the entire expression with parentheses and places a newline before the closing parenthesis. Ordinary comments cannot consume the surrounding generated SQL. MySQL executable comments, MariaDB `/*M!…*/` executable comments (including versioned forms), and optimizer hints are rejected.

## SQL-mode and runtime assumptions

Import assumes ANSI_QUOTES, NO_BACKSLASH_ESCAPES, HIGH_NOT_PRECEDENCE, PIPES_AS_CONCAT, ORACLE, and EMPTY_STRING_IS_NULL are disabled. Backticks identify fields; single- and double-quoted strings are decoded under those assumptions. Visual export uses backticks, doubled apostrophes, UTF-8 hex text where necessary, and an explicit backslash LIKE escape, so it does not depend on ANSI_QUOTES or NO_BACKSLASH_ESCAPES.

Opaque raw strings with double quotes or backslash escapes are rejected. Use single quotes with doubled apostrophes or introduced UTF-8 hex text. Raw NOT requires its complete operand to be parenthesized, raw LIKE requires an explicit constant single-character ESCAPE, and `||` is rejected.

Validation establishes the supported syntax and preservation policy, not execution validity for an unknown schema. Column existence, argument types, charset/collation applicability, numeric coercions, SQL modes, and server-specific execution behavior still depend on the target database. No live MariaDB execution has been performed.

The existing store replaces a query only after complete import success and assigns IDs/colours through the existing workflow. Failed imports leave the query and submitted SQL intact. Shared components invoke active-adapter capabilities. Selecting a different database uses the existing reset workflow for the query, suggestions, drafts, selection, editing and copy feedback; selecting the same database retains them. User display preferences are independent of that reset.

## CREATE TABLE suggestions

Schema import shares MySQL’s AST-based column extraction and duplicate handling, with a separate MariaDB 11.4 compatibility gate. The gate checks the whole schema before returning suggestions; it does not infer types or execute DDL. It accepts one or more semicolon-separated explicit CREATE TABLE definitions, optionally TEMPORARY or IF NOT EXISTS. Names can be plain or backtick-quoted, including doubled backticks and a separately quoted database/table qualifier. Names with literal dots, surrounding whitespace, non-BMP characters, NUL or excessive length are rejected because the shared field model or target cannot represent them faithfully.

Common numeric, text/binary, enum/set, temporal, JSON and spatial type spellings are recognized only to validate syntax. Standard NULL/default, auto-increment, primary/unique/foreign key, comment and collation clauses are accepted. Ordinary column indexes, prefix lengths, BTREE/HASH, index comments and key block sizes are supported; constraints and indexes never become fields. Generated columns and CHECK constraints are accepted only when their expressions fit the established operand/predicate subset, with arithmetic admitted solely for schema expressions. CURRENT_TIMESTAMP and its NOW/LOCALTIME/LOCALTIMESTAMP aliases permit precision 0–6 in defaults and ON UPDATE clauses. No functions, operators or query-model controls are added to filter import by this schema policy.

Supported table options are ENGINE (InnoDB, MyISAM, MEMORY), DEFAULT CHARSET/CHARACTER SET, COLLATE, COMMENT, AUTO_INCREMENT, ROW_FORMAT with a recognized keyword, AVG_ROW_LENGTH, MIN_ROWS, MAX_ROWS and KEY_BLOCK_SIZE. Charset names are limited to utf8mb4, utf8mb3, latin1, ascii and binary. The existing collation allowlist retains utf8mb4_bin/general_ci, utf8mb3_bin/general_ci, latin1_bin/swedish_ci, ascii_bin/general_ci and binary, and adds exactly `utf8mb4_unicode_ci`, `utf8mb4_unicode_520_ci`, `utf8mb3_unicode_ci` and `utf8mb3_unicode_520_ci`. This schema-only allowlist applies to table/column collation clauses and COLLATE in supported DEFAULT, generated-column and CHECK expressions, including nested operands. Unknown collations reject the complete schema. Their applicability still depends on the declared charset; no new UI controls or filter/Raw COLLATE names are added, and MySQL behavior is unchanged.

These four legacy Unicode collations are compatible throughout MariaDB 11.4. The official [MariaDB 11.4.2 source definitions](https://github.com/MariaDB/server/blob/mariadb-11.4.2/strings/ctype-uca.c) include all four names before 11.4.5; the [supported-collations reference](https://mariadb.com/docs/server/reference/data-types/string-data-types/character-sets/supported-character-sets-and-collations) also lists them. Its collation table is a snapshot from 11.4.5, not an introduction version for these legacy names. The schema-import baseline remains MariaDB 11.4; this expansion excludes 0900 aliases and does not require 11.4.5.

CREATE TABLE LIKE/AS SELECT, other statement types, partitions, functional indexes, MySQL SRID attributes, ENFORCED/NOT ENFORCED, visibility/storage/column-format extensions, parser plugins, engine attributes, unknown options and unverified expressions are rejected. The MySQL grammar also cannot cover all MariaDB DDL; MariaDB-only forms such as OR REPLACE and PERSISTENT are outside this importer. Errors request the supported explicit subset instead of extracting names heuristically.

One distinct table yields plain column suggestions; multiple distinct tables yield qualified suggestions, preserving spelling/case and first-seen duplicate handling. Names remain unquoted in state and are quoted by the active exporter. Failure preserves the previous suggestions and submitted SQL; success replaces suggestions without changing the query. This policy establishes documented syntax compatibility, not runtime table validity, storage-engine availability or successful execution on MariaDB.

## Official references

- [MariaDB identifier names](https://mariadb.com/docs/server/reference/sql-structure/sql-language-structure/identifier-names)
- [String literals](https://mariadb.com/docs/server/reference/sql-structure/sql-language-structure/string-literals), [charset introducers](https://mariadb.com/docs/server/reference/data-types/string-data-types/character-sets/setting-character-sets-and-collations), and [supported collations](https://mariadb.com/docs/server/reference/data-types/string-data-types/character-sets/supported-character-sets-and-collations)
- [CAST](https://mariadb.com/docs/server/reference/sql-functions/string-functions/cast), [temporal literals](https://mariadb.com/docs/server/reference/sql-structure/sql-language-structure/date-and-time-literals), and [LIKE](https://mariadb.com/docs/server/reference/sql-functions/string-functions/like)
- [Operator precedence](https://mariadb.com/docs/server/reference/sql-structure/operators/operator-precedence), [SQL modes](https://mariadb.com/docs/server/server-management/variables-and-modes/sql_mode), and [executable comments](https://mariadb.com/docs/server/reference/sql-statements/comment-syntax)
- [MariaDB 11.4 incompatibilities](https://mariadb.com/docs/release-notes/community-server/about/compatibility-and-differences/incompatibilities-and-feature-differences-between-mariadb-11-4-and-mysql-8), including unsupported MySQL JSON arrows

- [CREATE TABLE syntax, columns, keys and table options](https://mariadb.com/docs/server/server-usage/tables/create-table), [numeric data types](https://mariadb.com/docs/server/reference/data-types/numeric-data-types), and [CURRENT_TIMESTAMP](https://mariadb.com/docs/server/reference/sql-functions/date-time-functions/current_timestamp)
