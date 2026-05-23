/**
 * Coarse saptaka label from a **printed 22-shruti chart row** (1 = Sa … 22 ≈ upper Sa).
 * Rows are ordered by pitch through the octave; this maps the index into Sa–Ni–Sa for display
 * (not a full rāga-specific swara name — those depend on the column’s gamaka set).
 */

const SARGAM_SHORT = ["Sa", "Ri", "Ga", "Ma", "Pa", "Dha", "Ni", "Sa"] as const;

/** Short label: Sa, Ri, Ga, Ma, Pa, Dha, Ni, or upper Sa. */
export function svaraShortFromShruti22Row(row1To22: number): string {
  const r = Math.max(1, Math.min(22, Math.round(row1To22)));
  const d = Math.min(7, Math.floor(((r - 1) * 8) / 22));
  return SARGAM_SHORT[d] ?? "Sa";
}
