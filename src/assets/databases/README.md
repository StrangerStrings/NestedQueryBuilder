# Database logos

Local SVG brand icons from [Simple Icons](https://github.com/simple-icons/simple-icons), downloaded on 2026-10-07:

- `postgresql.svg`: https://github.com/simple-icons/simple-icons/blob/develop/icons/postgresql.svg
- `mysql.svg`: https://github.com/simple-icons/simple-icons/blob/develop/icons/mysql.svg
- `mariadb.svg`: https://github.com/simple-icons/simple-icons/blob/develop/icons/mariadb.svg

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
