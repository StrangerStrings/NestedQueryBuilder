/** Dedicated purple styling shared by raw condition cards and their editor panel. */
export const rawConditionColour = {
  background: '#f3e8ff',
  accent: '#c084fc',
} as const

/** Dedicated purple appearance for raw expressions on dark surfaces. */
const darkRawConditionColour = {
  background: 'oklch(0.32 0.07 305)',
  accent: 'oklch(0.74 0.13 305)',
} as const

/** Base hues for the nine Soft Pastel colour families. */
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

/** Dark tinted backgrounds corresponding to the four stable variant IDs. */
const darkConditionColourVariants = {
  1: { lightness: 0.32, chroma: 0.055 },
  2: { lightness: 0.36, chroma: 0.065 },
  3: { lightness: 0.4, chroma: 0.085 },
  4: { lightness: 0.28, chroma: 0.025 },
} as const

export type ConditionColourFamily = (typeof conditionColourFamilies)[number]
export type ConditionColourVariant = (typeof conditionColourVariants)[number]
export type ConditionColourId = `${ConditionColourFamily['id']}-${ConditionColourVariant['id']}`
export type OklchColourToken = `oklch(${number} ${number} ${number})`

type ConditionColourAppearance = Readonly<{
  background: string
  accent: string
}>

export type ConditionColour = Readonly<{
  id: ConditionColourId
  family: ConditionColourFamily['name']
  variant: ConditionColourVariant['id']
  background: OklchColourToken
  accent: OklchColourToken
  dark: ConditionColourAppearance
}>

/** Format OKLCH tokens without floating-point arithmetic artefacts. */
function oklch(lightness: number, chroma: number, hue: number): OklchColourToken {
  return `oklch(${Number(lightness.toFixed(3))} ${Number(chroma.toFixed(3))} ${hue})`
}

/** Preserve each light shade and add its dark tint and contrasting accent at the same hue. */
function createConditionColour(
  family: ConditionColourFamily,
  variant: ConditionColourVariant,
): ConditionColour {
  const hue = (family.hue + variant.hueOffset + 360) % 360
  const darkVariant = darkConditionColourVariants[variant.id]

  return {
    id: `${family.id}-${variant.id}`,
    family: family.name,
    variant: variant.id,
    background: oklch(variant.lightness, variant.chroma, hue),
    // Keep accents distinct while using a lighter, less saturated pastel treatment.
    accent: oklch(variant.lightness - 0.18, variant.chroma + 0.02, hue),
    dark: {
      background: oklch(darkVariant.lightness, darkVariant.chroma, hue),
      accent: oklch(darkVariant.lightness + 0.4, darkVariant.chroma + 0.04, hue),
    },
  }
}

/** All 36 Soft Pastel colours, ordered by family and then variant. */
export const conditionColourPalette: readonly ConditionColour[] = conditionColourFamilies.flatMap(
  (family) => conditionColourVariants.map((variant) => createConditionColour(family, variant)),
)

/** Resolve raw, invalid, saved, or empty appearances without changing saved colour identities. */
export function resolveConditionColourAppearance(
  colour: ConditionColour | undefined,
  theme: 'light' | 'dark',
  isRaw: boolean,
  isInvalid: boolean,
): ConditionColourAppearance {
  if (isRaw) return theme === 'dark' ? darkRawConditionColour : rawConditionColour
  if (isInvalid) {
    return {
      background: 'var(--condition-invalid-surface)',
      accent: 'var(--condition-invalid-accent)',
    }
  }
  return (theme === 'dark' ? colour?.dark : colour) ?? {
    background: 'var(--condition-empty-surface)',
    accent: 'var(--condition-empty-accent)',
  }
}
