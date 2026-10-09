# queryBuilder

A visual query builder built with Vue 3, Vite, TypeScript, and Pinia.

## Database targets

PostgreSQL retains visual filter building, WHERE SQL export, SQL filter import (including raw expressions), and CREATE TABLE schema import. MySQL 8.4 supports visual filter building, WHERE SQL export, SQL filter import with validated opaque raw expressions, and CREATE TABLE schema import for field suggestions. MariaDB 11.4 LTS supports the same workflows within its documented compatible syntax subset. Elasticsearch supports visual filter building, Query DSL JSON export and import, mapping import for field suggestions, and Raw JSON conditions; see [Elasticsearch capabilities](docs/elasticsearch-capabilities.md) for boundaries.

MongoDB supports visual filter building, filter JSON export, whole-filter import within a supported subset, JSON Schema import for field suggestions, and condition-level Raw JSON. Raw accepts a filter object containing multiple predicates or a complete logical subtree, including explicit `{}`; empty text is invalid. Each Raw document stays together as one child at its existing position in all/any/none groups (`$and`/`$or`/`$nor`), alongside visual conditions. Explicit Raw `{}` children are preserved, including in any/none groups. Returning to the visual editor clears the condition while preserving its identity and group position.

MongoDB Raw validation checks JSON syntax and an object root only, rejecting arrays, primitives and null at the root. It does not validate MongoDB operators, operands, placement, schema compatibility, server versions or execution validity. Ordinary JSON parsing and serialization apply, including formatting changes and numeric precision loss. Raw is filter-only: commands, complete requests, shell expressions (such as `ObjectId(...)`, `ISODate(...)`, regex literals or `db.collection.find(...)`), aggregation pipelines, sorting, pagination and projection are outside this feature. Extended JSON objects such as `{"$oid":"..."}` and `{"$date":"..."}` are preserved as ordinary JSON objects without interpretation or validation. Typed BSON values require Extended JSON decoding by the consuming tool; ordinary parsed JSON performs no BSON conversion.

The MongoDB visual editor and whole-filter importer retain their supported primitive filter subset: operands use strings, finite numbers and booleans, lists must be nonempty and homogeneous, and integers must be safe JavaScript integers. Imports reject overflow and nonzero underflow; decimals retain ordinary floating-point rounding. These visual/import workflows do not support typed BSON or Extended JSON values, embedded-document/array equality, regex `$options`, or `$elemMatch`; Raw can preserve these JSON structures. Whole-filter import does not automatically fall back to Raw, and arbitrary Raw output is not guaranteed importable. Import accepts root `{}` but rejects nested empty filters; generation prunes empty visual groups, while preserving explicit Raw `{}` children.

The query tree and grouping UI are shared. Database adapters supply operators, WHERE and condition SQL generation, and optional filter/schema import and raw-condition parsing capabilities. The store and previews use the selected adapter.

MySQL initially supports comparisons, IN/NOT IN, BETWEEN/NOT BETWEEN, LIKE/NOT LIKE, null checks, with text, finite numbers, booleans, local date/time/datetime values, and column references. LIKE case sensitivity follows the column collation. PostgreSQL ILIKE and durations are unavailable in the MySQL visual editor. Dates use years 1000–9999; temporal values have seconds precision and no timezone. Identifiers use escaped backticks. Strings containing backslashes, control characters, or non-ASCII characters use UTF-8 hex literals to avoid SQL-mode-dependent escaping. See the [MySQL 8.4 literal rules](https://dev.mysql.com/doc/refman/8.4/en/string-literals.html).

MySQL import uses a separate MySQL-aware parser, assuming ANSI_QUOTES, NO_BACKSLASH_ESCAPES, HIGH_NOT_PRECEDENCE, and PIPES_AS_CONCAT are disabled. Failed imports preserve the current query and submitted SQL. Structured export stays independent of string-escaping modes; raw expressions that depend on those modes are rejected.

Schema import accepts explicit CREATE TABLE definitions, extracts only column names, and replaces suggestions only after the whole schema succeeds. One distinct table yields plain column suggestions; multiple tables yield qualified suggestions. MySQL stores raw identifier names and quotes them on SQL export. Schema imports leave the current query intact.

The explicit MySQL operator and modifier capabilities are documented in [MySQL capabilities](docs/mysql-capabilities.md). MariaDB syntax boundaries, SQL-mode assumptions and schema options are documented in [MariaDB capabilities](docs/mariadb-capabilities.md).

Choose the target in Databases; switching resets the query and schema suggestions.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
