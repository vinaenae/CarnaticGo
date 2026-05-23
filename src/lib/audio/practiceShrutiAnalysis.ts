/**
 * Offline CREPE/YIN contour → 22-shruti chart column alignment summary.
 */

import type { RawPitchContour } from "@/lib/audio/pitchContour";
import {
  CREPE_DISPLAY_HIT_CENTS,
  hzFoldedToChartOctave,
  nearestPrintedShruti22,
} from "@/lib/audio/shrutiRowBand";
import { svaraShortFromShruti22Row } from "@/lib/audio/svaraFromShruti22Row";
import { pitchAccuracyFromCents } from "@/lib/scoring";

/** Noticeably off a printed shruti dot (summary regions). */
const OFF_SHRUTI_CENTS = 50;
const REGION_MIN_SEC = 0.5;
const REGION_MERGE_GAP_SEC = 0.35;

export type PracticeShrutiOffRegion = {
  startSec: number;
  endSec: number;
  meanAbsCents: number;
  maxAbsCents: number;
  /** Dominant nearest shruti row in this span. */
  shruti22Index: number;
  svaraShort: string;
};

export type PracticeShrutiVerdict = "mostly_on" | "mixed" | "often_off";

export type PracticeShrutiAnalysis = {
  durationSec: number;
  voicedSec: number;
  onShrutiPct: number;
  meanAbsCents: number;
  medianAbsCents: number;
  pitchAccuracyScore: number;
  verdict: PracticeShrutiVerdict;
  verdictLabel: string;
  offRegions: PracticeShrutiOffRegion[];
};

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function mergeOffRegions(
  points: { t: number; absCents: number; index22: number }[],
): PracticeShrutiOffRegion[] {
  if (points.length === 0) return [];
  const out: PracticeShrutiOffRegion[] = [];
  let start = points[0]!.t;
  let end = points[0]!.t;
  let sum = points[0]!.absCents;
  let max = points[0]!.absCents;
  let count = 1;
  const rowCounts = new Map<number, number>();
  rowCounts.set(points[0]!.index22, 1);

  const flush = () => {
    const dur = end - start;
    if (dur >= REGION_MIN_SEC) {
      let bestRow = 1;
      let bestN = 0;
      for (const [row, n] of rowCounts) {
        if (n > bestN) {
          bestN = n;
          bestRow = row;
        }
      }
      out.push({
        startSec: start,
        endSec: end,
        meanAbsCents: sum / count,
        maxAbsCents: max,
        shruti22Index: bestRow,
        svaraShort: svaraShortFromShruti22Row(bestRow),
      });
    }
    rowCounts.clear();
  };

  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    if (p.t - end <= REGION_MERGE_GAP_SEC) {
      end = p.t;
      sum += p.absCents;
      max = Math.max(max, p.absCents);
      count += 1;
      rowCounts.set(p.index22, (rowCounts.get(p.index22) ?? 0) + 1);
    } else {
      flush();
      start = p.t;
      end = p.t;
      sum = p.absCents;
      max = p.absCents;
      count = 1;
      rowCounts.set(p.index22, 1);
    }
  }
  flush();
  return out;
}

export function analyzePracticeShrutiFromContour(
  contour: RawPitchContour,
  sessionSaHz: number,
  tanpuraKey: string,
): PracticeShrutiAnalysis {
  const n = contour.timesSec.length;
  const durationSec =
    n > 0 ? contour.timesSec[n - 1]! - contour.timesSec[0]! : 0;

  const centsAbs: number[] = [];
  const offPoints: { t: number; absCents: number; index22: number }[] = [];
  let voicedFrames = 0;
  let onShrutiFrames = 0;
  let lastVoicedT = 0;
  let firstVoicedT = 0;

  for (let i = 0; i < n; i++) {
    if (!contour.voiced[i]) continue;
    const hz = contour.hz[i];
    if (!Number.isFinite(hz)) continue;
    voicedFrames += 1;
    const t = contour.timesSec[i]!;
    if (voicedFrames === 1) firstVoicedT = t;
    lastVoicedT = t;

    const hit = nearestPrintedShruti22(hz, sessionSaHz, tanpuraKey);
    const ab = Math.abs(hit.centsFromNearest);
    centsAbs.push(ab);
    if (Math.abs(hit.centsFromNearest) <= CREPE_DISPLAY_HIT_CENTS) onShrutiFrames += 1;
    if (ab > OFF_SHRUTI_CENTS) {
      offPoints.push({ t, absCents: ab, index22: hit.index22 });
    }
  }

  const voicedSec = voicedFrames > 1 ? Math.max(0, lastVoicedT - firstVoicedT) : 0;
  const onShrutiPct = voicedFrames > 0 ? (100 * onShrutiFrames) / voicedFrames : 0;
  const meanAbsCents =
    centsAbs.length > 0 ? centsAbs.reduce((a, b) => a + b, 0) / centsAbs.length : 0;
  const medianAbsCents = median(centsAbs);
  const pitchAccuracyScore = pitchAccuracyFromCents(centsAbs);

  let verdict: PracticeShrutiVerdict;
  let verdictLabel: string;
  if (voicedFrames < 8) {
    verdict = "often_off";
    verdictLabel = "Not enough voiced audio to judge shruti — try singing louder or longer.";
  } else if (onShrutiPct >= 68) {
    verdict = "mostly_on";
    verdictLabel = `Mostly on shruti — about ${onShrutiPct.toFixed(0)}% of frames within ±${CREPE_DISPLAY_HIT_CENTS}¢ of a chart dot (CREPE).`;
  } else if (onShrutiPct >= 40) {
    verdict = "mixed";
    verdictLabel = `Mixed shruti — about ${onShrutiPct.toFixed(0)}% within ±${CREPE_DISPLAY_HIT_CENTS}¢; see the cents chart below.`;
  } else {
    verdict = "often_off";
    verdictLabel = `Often off shruti — only about ${onShrutiPct.toFixed(0)}% within ±${CREPE_DISPLAY_HIT_CENTS}¢ of your column’s 22 frequencies.`;
  }

  return {
    durationSec,
    voicedSec,
    onShrutiPct,
    meanAbsCents,
    medianAbsCents,
    pitchAccuracyScore,
    verdict,
    verdictLabel,
    offRegions: mergeOffRegions(offPoints),
  };
}

export type PracticePitchDot = {
  t: number;
  /** Folded into session Sa octave for plotting vs chart column. */
  hz: number;
  shruti22: number;
  cents: number;
  onShruti: boolean;
  svaraShort: string;
};

/** Light median smooth on voiced CREPE frames before shruti comparison. */
export function smoothVoicedContourForPractice(
  contour: RawPitchContour,
  window = 5,
): RawPitchContour {
  const n = contour.timesSec.length;
  const hz = new Float32Array(contour.hz);
  const half = Math.floor(window / 2);
  for (let i = 0; i < n; i++) {
    if (!contour.voiced[i]) continue;
    const buf: number[] = [];
    for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
      if (contour.voiced[j] && Number.isFinite(hz[j])) buf.push(hz[j]!);
    }
    if (buf.length > 0) {
      buf.sort((a, b) => a - b);
      hz[i] = buf[Math.floor(buf.length / 2)]!;
    }
  }
  return { timesSec: contour.timesSec, hz, voiced: contour.voiced };
}

/** Voiced CREPE frames as scatter points (downsampled for chart performance). */
export function contourToPracticePitchDots(
  contour: RawPitchContour,
  sessionSaHz: number,
  tanpuraKey: string,
  maxDots = 900,
): PracticePitchDot[] {
  const n = contour.timesSec.length;
  const step = n > maxDots ? Math.ceil(n / maxDots) : 1;
  const dots: PracticePitchDot[] = [];
  for (let i = 0; i < n; i += step) {
    if (!contour.voiced[i]) continue;
    const hz = contour.hz[i];
    if (!Number.isFinite(hz)) continue;
    const hzPlot = hzFoldedToChartOctave(hz, sessionSaHz);
    const hit = nearestPrintedShruti22(hz, sessionSaHz, tanpuraKey);
    const ab = Math.abs(hit.centsFromNearest);
    dots.push({
      t: contour.timesSec[i]!,
      hz: hzPlot,
      shruti22: hit.index22,
      cents: hit.centsFromNearest,
      onShruti: ab <= CREPE_DISPLAY_HIT_CENTS,
      svaraShort: svaraShortFromShruti22Row(hit.index22),
    });
  }
  return dots;
}

export function formatPracticeShrutiTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${s.toFixed(1).padStart(s < 10 ? 4 : 3, "0")}` : `${s.toFixed(1)}s`;
}
