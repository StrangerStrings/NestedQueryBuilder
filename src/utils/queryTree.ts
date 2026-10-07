import type { QueryGroup } from '../types/query'

// Find a group in the current tree, including the root itself.
export function findGroupById(group: QueryGroup, groupId: string): QueryGroup | undefined {
  if (group.id === groupId) return group

  for (const child of group.children) {
    if (child.kind === 'group') {
      const found = findGroupById(child, groupId)
      if (found) return found
    }
  }
}
