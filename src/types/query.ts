import type { ConditionColourAssignments, FieldColourAssignments } from '../colours/fieldColours'
import type { ValueDataType } from './databaseOperator'

type ValueTypeMap = {
  text: string
  number: number
  boolean: boolean
  /** Local calendar date in YYYY-MM-DD format. */
  date: string
  /** Local time in HH:mm:ss format, with seconds precision. */
  time: string
  /** Local datetime in YYYY-MM-DDTHH:mm:ss format, without a timezone. */
  datetime: string
  duration: string
  /** A column reference, optionally qualified by table or schema. */
  field: string
}

/** A condition's selected value type, input shape, and value. */
export type ConditionValue =
  | { hasValue: false }
  | {
      [T in ValueDataType]: {
        hasValue: true
        dataType: T
      } & (
        | { dataShape: 'single'; value: ValueTypeMap[T] }
        | { dataShape: 'list'; value: ValueTypeMap[T][] }
        | { dataShape: 'range'; value: [ValueTypeMap[T], ValueTypeMap[T]] }
      )
    }[ValueDataType]

/** A single optional transformation of a condition's field. */
export type FieldModifier =
  | 'lower'
  | 'upper'
  | 'trim'
  | 'ltrim'
  | 'rtrim'
  | 'initcap'
  | 'reverse'
  | 'length'
  | 'abs'
  | 'round'
  | 'floor'
  | 'ceil'
  | 'trunc'
  | 'sqrt'

/** A field name with zero or one modifier. */
export type ConditionField = {
  name: string
  modifier: FieldModifier | null
}

/** A configured Elasticsearch parameter; slop strings retain unfinished or invalid editor input. */
export type ElasticsearchConditionParameter =
  | { name: 'operator'; value: 'or' | 'and' }
  | { name: 'fuzziness'; value: 'AUTO' | 0 | 1 | 2 }
  | { name: 'slop'; value: number | string }
  | { name: 'case_insensitive'; value: boolean }

/** A leaf in the query tree that applies an operator to a field. */
export type QueryCondition = {
  kind: 'condition'
  id: string
  /** When present, this raw condition text takes precedence over the structured editor fields. */
  rawSql?: string
  field: ConditionField
  operatorId: string
  value: ConditionValue
  parameters?: ElasticsearchConditionParameter[]
}

/** A group that combines conditions or nested groups. */
export type QueryGroup = {
  kind: 'group'
  id: string
  mode: 'any' | 'all' | 'none'
  children: QueryNode[]
  /** Active field assignments saved with the tree. */
  fieldColours?: FieldColourAssignments
  /** Active condition shades keyed by field and then condition ID. */
  conditionColours?: ConditionColourAssignments
}

/** Any node that can appear inside a query group. */
export type QueryNode = QueryCondition | QueryGroup
