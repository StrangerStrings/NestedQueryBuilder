import {
  conditionColourPalette,
  conditionColourVariants,
  type ConditionColour,
  type ConditionColourId,
} from './palette'

export type FieldColourAssignments = Partial<Record<string, ConditionColourId>>
export type ConditionColourAssignments = Partial<Record<string, FieldColourAssignments>>

type FieldCondition = { id: string; field: string }

// Visit every family before advancing to another shade when allocating new fields.
const allocationPalette = conditionColourVariants.flatMap((variant) =>
  conditionColourPalette.filter((colour) => colour.variant === variant.id),
)

// Keep active field colours and transfer unused colours when a condition renames its field.
export function assignFieldColours(
  conditions: readonly FieldCondition[],
  existingAssignments: FieldColourAssignments = {},
  previousConditions: readonly FieldCondition[] = [],
): FieldColourAssignments {
  const fields = new Set(conditions.map((condition) => condition.field.trim()).filter(Boolean))
  let assignments = { ...existingAssignments }
  const transferredFields = new Set<string>()

  for (const field of Object.keys(assignments)) {
    if (!fields.has(field)) delete assignments[field]
  }

  for (const condition of conditions) {
    const name = condition.field.trim()
    if (!name || Object.prototype.hasOwnProperty.call(assignments, name)) continue

    const previousField = previousConditions.find((item) => item.id === condition.id)?.field.trim()
    const previousColour =
      previousField && !fields.has(previousField) && !transferredFields.has(previousField)
        ? getFieldColour(previousField, existingAssignments)
        : undefined
    const usedColours = new Set(Object.values(assignments))
    const usedFamilies = new Set(
      conditionColourPalette
        .filter((colour) => usedColours.has(colour.id))
        .map((colour) => colour.family),
    )
    const colour =
      previousColour ??
      allocationPalette.find((candidate) => !usedFamilies.has(candidate.family)) ??
      allocationPalette.find((candidate) => !usedColours.has(candidate.id)) ??
      allocationPalette[Object.keys(assignments).length % allocationPalette.length]

    if (colour) {
      // Computed keys also safely support field names such as "__proto__".
      assignments = { ...assignments, [name]: colour.id }
      if (previousColour && previousField) transferredFields.add(previousField)
    }
  }

  return assignments
}

// Resolve a field's saved appearance; unset fields retain neutral styling.
export function getFieldColour(
  field: string,
  assignments: FieldColourAssignments | undefined,
): ConditionColour | undefined {
  const name = field.trim()
  if (!name || !assignments || !Object.prototype.hasOwnProperty.call(assignments, name)) return

  return conditionColourPalette.find((colour) => colour.id === assignments[name])
}

// Keep active condition shades, transferring a renamed shade and preferring free shades.
export function assignConditionColours(
  conditions: readonly FieldCondition[],
  fieldAssignments: FieldColourAssignments,
  existingAssignments: ConditionColourAssignments = {},
  previousConditions: readonly FieldCondition[] = [],
): ConditionColourAssignments {
  let assignments: ConditionColourAssignments = {}
  const fields = new Set(conditions.map((condition) => condition.field.trim()).filter(Boolean))

  // Preserve every unchanged condition before allocating shades to new or renamed ones.
  for (const condition of conditions) {
    const field = condition.field.trim()
    const colour = getConditionColour(condition, existingAssignments)
    const baseColour = getFieldColour(field, fieldAssignments)
    if (!colour || colour.family !== baseColour?.family) continue

    const fieldColours = Object.prototype.hasOwnProperty.call(assignments, field)
      ? (assignments[field] ?? {})
      : {}
    assignments = { ...assignments, [field]: { ...fieldColours, [condition.id]: colour.id } }
  }

  for (const condition of conditions) {
    const field = condition.field.trim()
    const baseColour = getFieldColour(field, fieldAssignments)
    if (!baseColour) continue

    const fieldColours = Object.prototype.hasOwnProperty.call(assignments, field)
      ? (assignments[field] ?? {})
      : {}
    if (Object.prototype.hasOwnProperty.call(fieldColours, condition.id)) continue

    const familyColours = conditionColourPalette.filter(
      (colour) => colour.family === baseColour.family,
    )
    const usedColours = new Set(
      conditions
        .filter(
          (item) =>
            item.field.trim() === field &&
            Object.prototype.hasOwnProperty.call(fieldColours, item.id),
        )
        .map((item) => fieldColours[item.id]),
    )
    const start = (baseColour.variant - 1 + Object.keys(fieldColours).length) % familyColours.length
    // Rotate predictably, using a free shade first and cycling once all four are used.
    const candidates = familyColours.slice(start).concat(familyColours.slice(0, start))
    const previousCondition = previousConditions.find((item) => item.id === condition.id)
    const previousColour =
      previousCondition && !fields.has(previousCondition.field.trim())
        ? getConditionColour(previousCondition, existingAssignments)
        : undefined
    const transferredColour =
      previousColour?.family === baseColour.family && !usedColours.has(previousColour.id)
        ? previousColour
        : undefined
    const colour =
      transferredColour ??
      candidates.find((candidate) => !usedColours.has(candidate.id)) ??
      candidates[0]

    if (colour) {
      assignments = {
        ...assignments,
        [field]: { ...fieldColours, [condition.id]: colour.id },
      }
    }
  }

  return assignments
}

// Resolve the saved shade for this condition within its field's colour family.
export function getConditionColour(
  condition: FieldCondition,
  assignments: ConditionColourAssignments | undefined,
): ConditionColour | undefined {
  const field = condition.field.trim()
  if (!field || !assignments || !Object.prototype.hasOwnProperty.call(assignments, field)) return

  const fieldColours = assignments[field]
  if (!fieldColours || !Object.prototype.hasOwnProperty.call(fieldColours, condition.id)) return

  return conditionColourPalette.find((colour) => colour.id === fieldColours[condition.id])
}
