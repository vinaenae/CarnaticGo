/**
 * Daniel Shiffman — Ukulele Tuner (Coding Train #151) adapted for Carnatic swara charts.
 *
 * Original uses ml5 CREPE in the browser (`pitch.getPitch(gotPitch)`). Server CREPE cannot
 * match that latency; this module keeps the same variables, closest-note loop, and needle math.
 *
 * @see https://thecodingtrain.com/CodingChallenges/151-ukulele-tuner.html
 * @see https://youtu.be/F1OkDTUkKFo
 * @see https://editor.p5js.org/codingtrain/sketches/8io2zvT03
 */

import {
  findClosestShiffmanNote,
  isShiffmanInTune,
  practiceStepsToTunerNotes,
  shiffmanNeedlePercent,
  SHIFFMAN_IN_TUNE_HZ,
  SHIFFMAN_METER_RANGE_HZ,
  type ShiffmanTunerMatch,
  type TunerTargetNote,
} from "@/lib/audio/warmup-crepe-tuner";

export type ShiffmanNote = TunerTargetNote;

/** Re-export chart → `notes[]` builder. */
export { practiceStepsToTunerNotes, SHIFFMAN_IN_TUNE_HZ };

/** Wider ±Hz band for Hold the swara only (warmup stays at `SHIFFMAN_IN_TUNE_HZ`). */
export const HOLD_SWARA_IN_TUNE_HZ = 7;

export type ShiffmanTunerSnapshot = {
  /** Shiffman `freq`. */
  freq: number;
  notes: readonly ShiffmanNote[];
  closest: ShiffmanTunerMatch | null;
  /** Shiffman `recordDiff` (Hz). */
  recordDiff: number;
  /** Shiffman `threshold` check. */
  inTune: boolean;
  /** Needle % — Shiffman `200 + diff/2` on a 400px-wide sketch. */
  needlePercent: number;
};

/**
 * One `draw()` frame: find closest note (Shiffman for-loop) and meter state.
 */
export function shiffmanTunerDrawFrame(
  freq: number,
  notes: readonly ShiffmanNote[],
  thresholdHz = SHIFFMAN_IN_TUNE_HZ,
): ShiffmanTunerSnapshot {
  if (!(freq > 0) || notes.length === 0) {
    return {
      freq: 0,
      notes,
      closest: null,
      recordDiff: 0,
      inTune: false,
      needlePercent: 50,
    };
  }

  const closest = findClosestShiffmanNote(freq, notes);
  if (!closest) {
    return {
      freq,
      notes,
      closest: null,
      recordDiff: 0,
      inTune: false,
      needlePercent: 50,
    };
  }

  const recordDiff = closest.recordDiff;
  return {
    freq,
    notes,
    closest,
    recordDiff,
    inTune: isShiffmanInTune(recordDiff, thresholdHz),
    needlePercent: shiffmanNeedlePercent(recordDiff),
  };
}

/**
 * Green band on the meter = within ±`thresholdHz` of target (same as `inTune`).
 * Needle uses `shiffmanNeedlePercent` over ±`halfRangeHz`.
 */
export function tunerMeterGreenBandPercent(
  thresholdHz = SHIFFMAN_IN_TUNE_HZ,
  halfRangeHz = SHIFFMAN_METER_RANGE_HZ,
): { start: number; end: number } {
  const span = halfRangeHz > 0 ? halfRangeHz : 1;
  const edge = (thresholdHz / span) * 50;
  return { start: 50 - edge, end: 50 + edge };
}

/** True when the needle is in the on-pitch green band. */
export function isNeedleInMeterGreen(
  needlePercent: number,
  thresholdHz = SHIFFMAN_IN_TUNE_HZ,
  halfRangeHz = SHIFFMAN_METER_RANGE_HZ,
): boolean {
  const { start, end } = tunerMeterGreenBandPercent(thresholdHz, halfRangeHz);
  return needlePercent >= start && needlePercent <= end;
}
