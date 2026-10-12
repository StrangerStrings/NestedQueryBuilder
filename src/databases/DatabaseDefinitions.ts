import postgresqlIcon from '../assets/databases/postgresql.svg'
import mysqlIcon from '../assets/databases/mysql.svg'
import mariadbIcon from '../assets/databases/mariadb.svg'
import sqliteIcon from '../assets/databases/sqlite.svg'
import elasticsearchIcon from '../assets/databases/elasticsearch.svg'
import mongodbIcon from '../assets/databases/mongodb.svg'
import type { DatabaseAdapter } from '../types/databaseAdapter'

export const databaseDefinitions = {
  postgresql: {
    label: 'PostgreSQL',
    version: '18',
    icon: postgresqlIcon,
    // Load PostgreSQL parsing and generation only when selected.
    async load() {
      return (await import('./postgresql/adapter')).postgresqlAdapter
    },
  },
  mysql: {
    label: 'MySQL',
    version: '8.4',
    icon: mysqlIcon,
    // Load MySQL and its shared parser only when selected.
    async load() {
      return (await import('./mysql/adapter')).mysqlAdapter
    },
  },
  mariadb: {
    label: 'MariaDB',
    version: '11.4 LTS',
    icon: mariadbIcon,
    // Load MariaDB and its shared parser only when selected.
    async load() {
      return (await import('./mariadb/adapter')).mariadbAdapter
    },
  },
  sqlite: {
    label: 'SQLite',
    version: '3.37+ subset',
    icon: sqliteIcon,
    // Load SQLite parsing and generation only when selected.
    async load() {
      return (await import('./sqlite/adapter')).sqliteAdapter
    },
  },
  elasticsearch: {
    label: 'Elasticsearch',
    version: '7.14+',
    icon: elasticsearchIcon,
    // Load Elasticsearch parsing and generation only when selected.
    async load() {
      return (await import('./elasticsearch/adapter')).elasticsearchAdapter
    },
  },
  mongodb: {
    label: 'MongoDB',
    version: '3.6+',
    icon: mongodbIcon,
    // Load MongoDB parsing and generation only when selected.
    async load() {
      return (await import('./mongodb/adapter')).mongodbAdapter
    },
  },
} satisfies Record<
  string,
  Pick<DatabaseAdapter, 'label' | 'version' | 'icon'> & {
    load: () => Promise<DatabaseAdapter>
  }
>

export type DatabaseId = keyof typeof databaseDefinitions
