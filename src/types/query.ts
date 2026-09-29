/** A leaf in the query tree that applies an operator to a field. */
export type QueryCondition = {
  kind: 'condition'
  id: string
  field: string
  operatorId: string
}

/** A group that combines conditions or nested groups. */
export type QueryGroup = {
  kind: 'group'
  id: string
  mode: 'any' | 'all' | 'none'
  children: QueryNode[]
}

/** Any node that can appear inside a query group. */
export type QueryNode = QueryCondition | QueryGroup
