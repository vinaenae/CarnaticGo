/**
 * Kāla (speed): subdivisions per tāla beat (akṣara) while avartanam tempo stays fixed.
 * Prathama = 1, Dwitiya = 2, Tritiya = 4 notes/syllables per beat.
 */

export type KaalaId = "prathama" | "dwitiya" | "tritiya";

export type KaalaDefinition = {
  id: KaalaId;
  name: string;
  shortLabel: string;
  alternateName?: string;
  subdivisionsPerBeat: number;
  description: string;
};

export const CARNATIC_KAALAS: readonly KaalaDefinition[] = [
  {
    id: "prathama",
    name: "Prathama kāla",
    shortLabel: "1st speed",
    alternateName: "Sama kāla",
    subdivisionsPerBeat: 1,
    description: "",
  },
  {
    id: "dwitiya",
    name: "Dwitiya kāla",
    shortLabel: "2nd speed",
    alternateName: "Dwitiya kāla",
    subdivisionsPerBeat: 2,
    description: "",
  },
  {
    id: "tritiya",
    name: "Tritiya kāla",
    shortLabel: "3rd speed",
    alternateName: "Tritiya kāla",
    subdivisionsPerBeat: 4,
    description: "Four notes or syllables per beat — four times the density of first speed.",
  },
] as const;

export function kaalaById(id: KaalaId): KaalaDefinition {
  return CARNATIC_KAALAS.find((k) => k.id === id) ?? CARNATIC_KAALAS[0]!;
}

export function subdivisionsForKaala(id: KaalaId): number {
  return kaalaById(id).subdivisionsPerBeat;
}
