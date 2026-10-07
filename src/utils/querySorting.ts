import type { InjectionKey, Ref, ShallowRef } from 'vue'
import type { QueryGroup, QueryNode } from '../types/query'

export type QueryDrag = {
  root: QueryGroup
  source: QueryGroup
  sourceGroupId: string
  node: QueryNode
  nodeId: string
  item: HTMLElement
  from: HTMLElement
  proposal?: { group: QueryGroup; children: QueryNode[] }
}

// Share transient drag data across recursive groups independently of the source's lifetime.
export const querySortingKey: InjectionKey<{
  drag: ShallowRef<QueryDrag | null>
  feedback: ShallowRef<{ group: QueryGroup; top: number } | null>
  version: Ref<number>
  blockClick: Ref<boolean>
}> = Symbol('querySorting')
