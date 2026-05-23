/**
 * Live pitch vs the **printed 22-shruti chart** (`shruti22-chart.ts`): fold into session octave, then
 * compare to the 22 listed Hz for that column. The meter rests when within **±3 cents** of a printed
 * target (`PRINTED_HZ_RELEASE_CENTS` + latch in `pitchPipeline` for hysteresis).
 */

import { shruti22AnchorsScaled } from "@/lib/audio/shruti22-chart";

/** Enter “on printed Hz” when |cents from nearest| ≤ this. */
export const PRINTED_HZ_HIT_CENTS = 3;

/**
 * After latched on-dot, stay on until |cents| exceeds this (wider than HIT) so vibrato / YIN jitter
 * does not flicker off-target every frame.
 */
export const PRINTED_HZ_RELEASE_CENTS = 8;

/** Offline CREPE charts — same in-shruti band as live (±12¢). */
export const CREPE_DISPLAY_HIT_CENTS = 12;

/** Fold `hz` into one octave above `saHz`: ratio in `[1, 2)`. */
export function hzFoldedToChartOctave(hz: number, saHz: number): number {
  if (!(saHz > 0) || !Number.isFinite(hz) || !Number.isFinite(saHz)) return saHz;
  let r = hz / saHz;
  if (r <= 0) return saHz;
  const hi = 2 - 1e-9;
  while (r >= hi) r /= 2;
  while (r < 1) r *= 2;
  return r * saHz;
}

export type NearestPrintedShruti22 = {
  /** 1–22 */
  index22: number;
  idealHz: number;
  /** Signed cents from nearest printed Hz. */
  centsFromNearest: number;
  /** True when folded pitch is within `PRINTED_HZ_HIT_CENTS` of that printed Hz. */
  onPrintedHz: boolean;
};

/**
 * Nearest of the 22 chart Hz for this `tanpuraKey` column (after folding). `onPrintedHz` is true only
 * within `PRINTED_HZ_HIT_CENTS` of that anchor — intended so the UI meter stays centered on-target.
 */
export function nearestPrintedShruti22(
  hz: number,
  sessionSaHz: number,
  tanpuraKey: string,
): NearestPrintedShruti22 {
  const anchors = shruti22AnchorsScaled(sessionSaHz, tanpuraKey);
  const hzF = hzFoldedToChartOctave(hz, sessionSaHz);
  let bestK = 0;
  let bestCents = 0;
  let bestAbs = Infinity;
  for (let k = 0; k < 22; k++) {
    const ideal = anchors[k]!;
    const cents = 1200 * Math.log2(hzF / ideal);
    const ab = Math.abs(cents);
    if (ab < bestAbs || (ab === bestAbs && k < bestK)) {
      bestAbs = ab;
      bestK = k;
      bestCents = cents;
    }
  }
  const onPrintedHz = bestAbs <= PRINTED_HZ_HIT_CENTS; // raw instant; pipeline may latch for stability
  return {
    index22: bestK + 1,
    idealHz: anchors[bestK]!,
    centsFromNearest: bestCents,
    onPrintedHz,
  };
}
