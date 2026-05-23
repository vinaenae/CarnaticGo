/**
 * Twelve melakarta chakras (Venkatamakhin / Govindaacharya scheme).
 */

export type MelakartaChakraDetail = {
  index: number;
  name: string;
  /** What the chakra name refers to (3–7 words). */
  etymology: string;
  /** How the six ragas in this group differ (3–7 words). */
  grouping: string;
};

export const MELAKARTA_CHAKRA_DETAILS: readonly MelakartaChakraDetail[] = [
  { index: 0, name: "Indu", etymology: "Moon — one", grouping: "Lowest Ri and Ga" },
  { index: 1, name: "Netra", etymology: "Eyes — two", grouping: "Ri with softer Ga" },
  { index: 2, name: "Agni", etymology: "Fire — three", grouping: "Ri with highest Ga" },
  { index: 3, name: "Veda", etymology: "Four Vedas", grouping: "Mid Ri and Ga" },
  { index: 4, name: "Bana", etymology: "Five love arrows", grouping: "Mid Ri, bright Ga" },
  { index: 5, name: "Rutu", etymology: "Six seasons", grouping: "Highest Ri and Ga" },
  { index: 6, name: "Rishi", etymology: "Seven sages", grouping: "Prati Ma, low Ga" },
  { index: 7, name: "Vasu", etymology: "Eight vasus", grouping: "Prati Ma, mild Ga" },
  { index: 8, name: "Brahma", etymology: "Nine Brahma forms", grouping: "Prati Ma, high Ga" },
  { index: 9, name: "Disi", etymology: "Ten directions", grouping: "Prati Ma, mid Ga" },
  { index: 10, name: "Rudra", etymology: "Eleven Rudras", grouping: "Prati Ma, tense Ga" },
  { index: 11, name: "Adi", etymology: "Twelve sun gods", grouping: "Prati Ma, full Ga" },
] as const;

/** Default feeling per chakra when no raga override (3–7 words). */
export const CHAKRA_DEFAULT_MOOD: readonly string[] = [
  "Sparse, rare in concert",
  "Deep pathos, devotional",
  "Clear, good for study",
  "Serious, many janya ragas",
  "Sweet, lyrical character",
  "Bold, chromatic tension",
  "Bright, sharper madhyama",
  "Warm, gentle character",
  "Rich, heavy devotion",
  "Balanced, concert friendly",
  "Intense, dramatic turns",
  "Full scale, last group",
];

export function chakraDetailForIndex(chakra: number): MelakartaChakraDetail {
  return MELAKARTA_CHAKRA_DETAILS[chakra] ?? MELAKARTA_CHAKRA_DETAILS[0]!;
}
