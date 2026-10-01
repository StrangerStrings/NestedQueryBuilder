import type { ConditionColourAssignments, FieldColourAssignments } from '../colours/fieldColours'

/** A leaf in the query tree that applies an operator to a field. */
export type QueryCondition = {
  kind: 'condition'
  id: string
  field: string
  operatorId: string
  value: string
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
