/** Base hues for the ten Soft Pastel colour families. */
export const conditionColourFamilies = [
  { id: 'coral', name: 'Coral', hue: 25 },
  { id: 'green', name: 'Green', hue: 133 },
  { id: 'amber', name: 'Amber', hue: 61 },
  { id: 'mint', name: 'Mint', hue: 169 },
  { id: 'violet', name: 'Violet', hue: 313 },
  { id: 'sky', name: 'Sky', hue: 241 },
  { id: 'magenta', name: 'Magenta', hue: 349 },
  { id: 'teal', name: 'Teal', hue: 205 },
  { id: 'blue', name: 'Blue', hue: 277 },
] as const

/** Light-theme background variants, in stable identifier order. */
export const conditionColourVariants = [
  { id: 1, lightness: 0.9, chroma: 0.055, hueOffset: 8 },
  { id: 2, lightness: 0.86, chroma: 0.065, hueOffset: 0 },
  { id: 3, lightness: 0.83, chroma: 0.085, hueOffset: -8 },
  { id: 4, lightness: 0.94, chroma: 0.025, hueOffset: 0 },
] as const

export type ConditionColourFamily = (typeof conditionColourFamilies)[number]
export type ConditionColourVariant = (typeof conditionColourVariants)[number]
export type ConditionColourId = `${ConditionColourFamily['id']}-${ConditionColourVariant['id']}`
export type OklchColourToken = `oklch(${number} ${number} ${number})`

export type ConditionColour = Readonly<{
  id: ConditionColourId
  family: ConditionColourFamily['name']
  variant: ConditionColourVariant['id']
  background: OklchColourToken
  accent: OklchColourToken
}>

/** Format OKLCH tokens without floating-point arithmetic artefacts. */
function oklch(lightness: number, chroma: number, hue: number): OklchColourToken {
  return `oklch(${Number(lightness.toFixed(3))} ${Number(chroma.toFixed(3))} ${hue})`
}

/** Generate each variant with a softly contrasting pastel accent at the same hue. */
function createConditionColour(
  family: ConditionColourFamily,
  variant: ConditionColourVariant,
): ConditionColour {
  const hue = (family.hue + variant.hueOffset + 360) % 360

  return {
    id: `${family.id}-${variant.id}`,
    family: family.name,
    variant: variant.id,
    background: oklch(variant.lightness, variant.chroma, hue),
    // Keep accents distinct while using a lighter, less saturated pastel treatment.
    accent: oklch(variant.lightness - 0.18, variant.chroma + 0.02, hue),
  }
}

/** All 40 Soft Pastel colours, ordered by family and then variant. */
export const conditionColourPalette: readonly ConditionColour[] = conditionColourFamilies.flatMap(
  (family) => conditionColourVariants.map((variant) => createConditionColour(family, variant)),
)
