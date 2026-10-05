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

/** A leaf in the query tree that applies an operator to a field. */
export type QueryCondition = {
  kind: 'condition'
  id: string
  field: string
  operatorId: string
  value: ConditionValue
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
