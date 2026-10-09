# queryBuilder

A visual query builder built with Vue 3, Vite, TypeScript, and Pinia.

## Database targets

PostgreSQL retains visual filter building, WHERE SQL export, SQL filter import (including raw expressions), and CREATE TABLE schema import. MySQL 8.4 supports visual filter building, WHERE SQL export, SQL filter import with validated opaque raw expressions, and CREATE TABLE schema import for field suggestions. MariaDB 11.4 LTS supports the same workflows within its documented compatible syntax subset. Elasticsearch supports visual filter building, Query DSL JSON export and import, mapping import for field suggestions, and Raw JSON conditions; see [Elasticsearch capabilities](docs/elasticsearch-capabilities.md) for boundaries.

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
