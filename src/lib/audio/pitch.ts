import { YIN } from "pitchfinder";

/**
 * Lightweight `smoothFrequency` helper (used by older call sites / tests).
 *
 * **Production path:** `VocalPitchProcessor` in `pitchPipeline.ts` — YIN (`yinFrame.ts`),
 * octave gate, median, MA, EMA, nearest of 22 printed chart Hz (`nearestPrintedShruti22`), damped needle.
 * Swap `createYinFrameDetector` there for CREPE WASM / server aubio when you add it.
 */
export function createYinDetector(sampleRate: number) {
  return YIN({
    sampleRate,
    /** Lower = more pitch candidates (noisier); higher = stricter. */
    threshold: 0.11,
    /** Minimum clarity for accepting a frame (pitchfinder-specific). */
    probabilityThreshold: 0.09,
  });
}

export function smoothFrequency(
  previous: number | null,
  next: number | null,
  alpha = 0.35,
): number | null {
  if (next == null) return previous;
  if (previous == null) return next;
  return previous * (1 - alpha) + next * alpha;
}
