/**
 * Shruti alignment: single fixed Sa reference (`shrutiHz`).
 * Log-frequency cents only — no Western notes, no semitone grid, no swara mapping.
 */
export function shrutiDeviationCents(pitchHz: number, shrutiHz: number): number {
  return 1200 * Math.log2(pitchHz / shrutiHz);
}
