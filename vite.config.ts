import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // Share the SQL parser and its runtime between the lazy MySQL and MariaDB adapters.
              name: 'mysql-mariadb-parser',
              test: /node_modules[\\/](?:dt-sql-parser|antlr4ng|antlr4-c3)[\\/]/,
            },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
