/**
 * Derive Carnatic swara labels for a melakarta number (1–72).
 * D/N pairs per chakra position: Kalpana Sangeetha Sabha / Wikipedia melakarta table.
 * @see https://sites.google.com/site/kalpsangeethasabha/ragas/72-melakarta-ragas
 * @see https://en.wikipedia.org/wiki/Melakarta#Table_of_Melakarta_ragas
 */

const DN_BY_POSITION = [
  ["D₁", "N₁"],
  ["D₁", "N₂"],
  ["D₁", "N₃"],
  ["D₂", "N₂"],
  ["D₂", "N₃"],
  ["D₃", "N₃"],
] as const;

const RG_BY_CHAKRA = [
  ["R₁", "G₁"],
  ["R₁", "G₂"],
  ["R₁", "G₃"],
  ["R₂", "G₂"],
  ["R₂", "G₃"],
  ["R₃", "G₃"],
] as const;

export function melakartaSwaraScale(num: number): {
  arohanam: string;
  avarohanam: string;
  madhyama: "Lower Ma (M₁)" | "Higher Ma (M₂)";
} {
  if (num < 1 || num > 72) {
    return { arohanam: "—", avarohanam: "—", madhyama: "Lower Ma (M₁)" };
  }
  const chakra = Math.floor((num - 1) / 6);
  const pos = (num - 1) % 6;
  /** R–G pairs repeat for chakras 7–12 (prati madhyama) same as 1–6. */
  const [r, g] = RG_BY_CHAKRA[chakra % 6]!;
  const [d, n] = DN_BY_POSITION[pos]!;
  const m = num <= 36 ? "M₁" : "M₂";
  const up = `S ${r} ${g} ${m} P ${d} ${n} Ṡ`;
  const down = `Ṡ ${n} ${d} P ${m} ${g} ${r} S`;
  return {
    arohanam: up,
    avarohanam: down,
    madhyama: num <= 36 ? "Lower Ma (M₁)" : "Higher Ma (M₂)",
  };
}
