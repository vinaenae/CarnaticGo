import type { SessionScores } from "@/types";
import { shrutiDeviationCents } from "@/lib/audio/shrutiAlign";

/** @deprecated Prefer `shrutiDeviationCents` — kept for call sites; Sa-only log cents. */
export function hzToCents(frequency: number, referenceHz: number): number {
  return shrutiDeviationCents(frequency, referenceHz);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Map mean absolute cent deviation to 0–100 (≈0 cents → 100, ≥50 cents → 0). */
export function pitchAccuracyFromCents(centsAbs: number[]): number {
  if (centsAbs.length === 0) return 0;
  const mean = centsAbs.reduce((a, b) => a + b, 0) / centsAbs.length;
  return clamp(100 - mean * 2.2, 0, 100);
}

/** Map mean absolute beat offset (ms) to 0–100 (0 ms → 100, ≥120 ms → 0). */
export function tempoStabilityFromOffsets(offsetMsAbs: number[]): number {
  if (offsetMsAbs.length === 0) return 50;
  const mean = offsetMsAbs.reduce((a, b) => a + b, 0) / offsetMsAbs.length;
  return clamp(100 - mean * 0.85, 0, 100);
}

export function computeSessionScores(input: {
  centsAbsWhenVoiced: number[];
  tempoOffsetMsAbs: number[];
}): SessionScores {
  return {
    pitchAccuracy: pitchAccuracyFromCents(input.centsAbsWhenVoiced),
    tempoStability: tempoStabilityFromOffsets(input.tempoOffsetMsAbs),
  };
}
