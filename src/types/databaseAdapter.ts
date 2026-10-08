import type { DatabaseOperator } from './databaseOperator'
import type { FieldModifier, QueryCondition, QueryGroup } from './query'

export type SqlResult =
  | { success: true; sql: string }
  | { success: false; error: string; nodeId?: string }

export type FilterImportResult =
  | { success: true; tree: QueryGroup }
  | { success: false; error: { kind: 'syntax' | 'unsupported-expression' | 'unsupported-operator' | 'unsupported-value'; message: string; fragment?: string } }

export type SchemaImportResult =
  | {
      success: true
      fields: string[]
      /** Describe excluded schema paths and the reasons for their exclusion. */
      warnings?: string[]
    }
  | { success: false; error: string }

export interface DatabaseAdapter {
  id: string
  label: string
  version: string
  icon: string
  queryFormat: {
    /** Null bypasses SQL formatting for generated output such as JSON. */
    formatterDialect: 'postgresql' | 'mysql' | 'mariadb' | 'sqlite' | null
    highlightLanguage: 'sql' | 'json'
  }
  /** Absent metadata retains the existing SQL wording. */
  presentation?: {
    outputLabel: string
    queryImportLabel: string
    schemaImportLabel: string
  }
  helpText?: {
    schemaHelp: string
    schemaPlaceholder: string
    queryHelp: string
    queryPlaceholder: string
  }
  /** Keep the existing unavailable-feature views for placeholder targets. */
  placeholder?: boolean
  operators: readonly DatabaseOperator[]
  fieldModifiers?: readonly FieldModifier[]
  generateWhereSql: (tree: QueryGroup) => SqlResult
  generateConditionSql: (condition: QueryCondition) => SqlResult
  importSqlFilter?: (sql: string) => FilterImportResult
  importSchemaSql?: (sql: string) => SchemaImportResult
  parseRawCondition?: (sql: string) =>
    | { success: true; condition: QueryCondition }
    | { success: false; error: string }
}
