/**
 * Live shruti feedback: nearest chart target + signed cents vs detected pitch.
 */

import { hzFoldedToChartOctave, nearestPrintedShruti22 } from "@/lib/audio/shrutiRowBand";

/** In-shruti band for live feedback (user request: ±10–15¢). */
export const LIVE_SHRUTI_TOLERANCE_CENTS = 12;

export type ShrutiFeedbackStatus = "idle" | "in_shruti" | "above" | "below";

export function centsDeviationFromTarget(detectedHz: number, targetHz: number): number {
  if (!(detectedHz > 0) || !(targetHz > 0)) return 0;
  return 1200 * Math.log2(detectedHz / targetHz);
}

export function shrutiFeedbackStatus(cents: number, voiced: boolean): ShrutiFeedbackStatus {
  if (!voiced) return "idle";
  if (Math.abs(cents) <= LIVE_SHRUTI_TOLERANCE_CENTS) return "in_shruti";
  return cents > 0 ? "above" : "below";
}

export function shrutiFeedbackLabel(status: ShrutiFeedbackStatus): string {
  switch (status) {
    case "in_shruti":
      return "In shruti";
    case "above":
      return "Singing above shruti";
    case "below":
      return "Singing below shruti";
    default:
      return "Listening…";
  }
}

export type LiveShrutiMatch = {
  detectedHz: number;
  targetHz: number;
  cents: number;
  shruti22Index: number;
  status: ShrutiFeedbackStatus;
};

/** Match folded detected Hz to nearest of 22 chart targets in `tanpuraKey` column. */
export function matchLiveShruti(
  detectedHz: number,
  sessionSaHz: number,
  tanpuraKey: string,
  voiced: boolean,
): LiveShrutiMatch | null {
  if (!voiced || !Number.isFinite(detectedHz)) return null;
  const hit = nearestPrintedShruti22(detectedHz, sessionSaHz, tanpuraKey);
  const folded = hzFoldedToChartOctave(detectedHz, sessionSaHz);
  const cents = centsDeviationFromTarget(folded, hit.idealHz);
  return {
    detectedHz: folded,
    targetHz: hit.idealHz,
    cents,
    shruti22Index: hit.index22,
    status: shrutiFeedbackStatus(cents, true),
  };
}
