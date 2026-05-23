/**
 * Warmup for your song — Daniel Shiffman’s ukulele CREPE pattern applied to Carnatic swara targets.
 *
 * Shiffman stores `notes: { note, freq }[]`, reads live `freq` from CREPE, picks the entry with
 * smallest |freq − note.freq|, then uses signed `recordDiff` for the meter (`200 + diff/2` in p5).
 *
 * Our swara frequencies come from `hzForSwaraAtSa` / `buildAllRatioSwaraSteps` (ratios × mandra Sa).
 *
 * @see https://thecodingtrain.com/CodingChallenges/151-ukulele-tuner.html
 * @see https://youtu.be/F1OkDTUkKFo
 * @see https://editor.p5js.org/codingtrain/sketches/8io2zvT03
 */

import type { PracticeSwaraStep } from "@/lib/practice-raga-scale";

/** Same as Shiffman’s `{ note, freq }`. */
export type TunerTargetNote = {
  note: string;
  freq: number;
};

export type ShiffmanTunerMatch = {
  closestNote: TunerTargetNote;
  index: number;
  /** Signed Hz offset: `freq − alignedTarget` (Shiffman’s `recordDiff`). */
  recordDiff: number;
  alignedTargetHz: number;
};

/** Shiffman: `threshold = 1` (Hz) on ukulele; slightly wider for voice. */
export const SHIFFMAN_IN_TUNE_HZ = 3;

/**
 * Shiffman maps `recordDiff` to needle X as `200 + diff/2` on a 400px-wide sketch (center 200).
 * Equivalent: 50% + (diff / 4) of track width, or ±`SHIFFMAN_METER_RANGE_HZ` → track edges.
 */
export const SHIFFMAN_METER_RANGE_HZ = 40;

export function practiceStepsToTunerNotes(
  steps: readonly PracticeSwaraStep[],
): TunerTargetNote[] {
  return steps.map((s) => ({ note: s.token, freq: s.hz }));
}

/**
 * Closest swara — Shiffman `draw()` loop:
 * `diff = freq - notes[i].freq`; keep note with smallest `abs(diff)`.
 * We compare each swara in ±2 octaves so vocal pitch matches the chart.
 */
export function findClosestShiffmanNote(
  freq: number,
  notes: readonly TunerTargetNote[],
): ShiffmanTunerMatch | null {
  if (!(freq > 0) || notes.length === 0) return null;

  let closestNote = notes[0]!;
  let bestIndex = 0;
  let alignedTargetHz = closestNote.freq;
  let recordDiff = freq - alignedTargetHz;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i]!;
    for (let oct = -2; oct <= 2; oct++) {
      const aligned = note.freq * 2 ** oct;
      const diff = freq - aligned;
      if (Math.abs(diff) < Math.abs(recordDiff)) {
        closestNote = note;
        bestIndex = i;
        recordDiff = diff;
        alignedTargetHz = aligned;
      }
    }
  }

  return { closestNote, index: bestIndex, recordDiff, alignedTargetHz };
}

export function isShiffmanInTune(
  recordDiffHz: number,
  thresholdHz = SHIFFMAN_IN_TUNE_HZ,
): boolean {
  return Math.abs(recordDiffHz) <= thresholdHz;
}

/** Needle position 0–100% (center = in tune). Mirrors `200 + recordDiff/2` on a 400px track. */
export function shiffmanNeedlePercent(
  recordDiffHz: number,
  halfRangeHz = SHIFFMAN_METER_RANGE_HZ,
): number {
  const span = halfRangeHz > 0 ? halfRangeHz : 1;
  return Math.max(0, Math.min(100, 50 + (recordDiffHz / span) * 50));
}
