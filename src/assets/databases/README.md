# Database logos

Local SVG brand icons from [Simple Icons](https://github.com/simple-icons/simple-icons), downloaded on 2026-10-07:

- `postgresql.svg`: https://github.com/simple-icons/simple-icons/blob/develop/icons/postgresql.svg
- `mysql.svg`: https://github.com/simple-icons/simple-icons/blob/develop/icons/mysql.svg
- `mariadb.svg`: https://github.com/simple-icons/simple-icons/blob/develop/icons/mariadb.svg

`sqlite.svg` was downloaded unchanged on 2026-10-08 from the [Simple Icons SQLite SVG source](https://github.com/simple-icons/simple-icons/blob/develop/icons/sqlite.svg), using [the raw develop URL](https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/sqlite.svg). It is served locally, with no runtime external image request. Simple Icons publishes these assets under [CC0 1.0 Universal](https://raw.githubusercontent.com/simple-icons/simple-icons/develop/LICENSE.md); the existing notice in `LICENSE.md` applies to this asset too.

The Simple Icons license is included in `LICENSE.md`. Brand names and logos remain trademarks of their respective owners.

Import an asset in Vue and provide alternative text when displaying it:

```vue
<script setup lang="ts">
import postgresqlLogo from './assets/databases/postgresql.svg'
</script>

<template>
  <img :src="postgresqlLogo" alt="PostgreSQL" width="24" height="24" />
</template>
```

When the database name is already displayed beside a logo, use `alt=""` to avoid repeating it for screen readers.
