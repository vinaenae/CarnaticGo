/**
 * Offline pitch contours (YIN) + downsampling + constrained DTW for teacher vs student vocal match.
 */

import { createYinFrameDetector } from "@/lib/audio/yinFrame";
import { MedianRing, OctaveJumpGate } from "@/lib/audio/pitchSmooth";
import { computeRms } from "@/lib/audio/volume";
import { resampleLinear } from "@/lib/audio/recordingToWav";

export const TEACHER_COMPARE_FRAME_SIZE = 4096;
export const TEACHER_COMPARE_HOP = 2048;
/** After analysis gain boost, allow slightly quieter frames to count as voiced. */
const RMS_GATE = 0.0012;
export const ANALYSIS_SAMPLE_RATE = 44100;
/** Min / max nodes for DTW (higher → tighter chart + playback alignment). */
const DTW_TARGET_LEN_MIN = 520;
const DTW_TARGET_LEN_MAX = 1100;
/** ~55 DTW nodes per second of reference audio. */
const DTW_NODES_PER_SEC = 55;
/** When syncing “play both”, seek user audio if drift exceeds this (seconds). */
export const PLAYBACK_SYNC_THRESHOLD_SEC = 0.04;
/** @deprecated Use {@link SIGNIFICANT_PITCH_CENTS} — kept for any legacy imports. */
export const MATCH_MISTAKE_CENTS = 200;
/** Sustained offset ≥ this (~1.7 semitones) — pitch is not close; critical mistake, not gamaka. */
export const SIGNIFICANT_PITCH_CENTS = 200;
/** Reference-axis span shorter than this is treated as tracker jitter / gamaka wiggle. */
const SIGNIFICANT_MIN_DURATION_SEC = 0.75;
/** Merge adjacent flagged regions closer than this on the reference timeline. */
const SIGNIFICANT_MERGE_GAP_SEC = 0.4;
/** Within a flagged run, at least this fraction of frames must exceed the pitch threshold. */
const SIGNIFICANT_MIN_HIGH_FRAME_FRAC = 0.6;
/** Once in a run, keep counting frames until |cents| drops below this (hysteresis). */
const SIGNIFICANT_STAY_CENTS = SIGNIFICANT_PITCH_CENTS * 0.82;
/** Sliding window for comparing local pitch movement (gamakas vs flat singing). */
const GAMAKA_WINDOW_SEC = 0.55;
const GAMAKA_WINDOW_HOP_SEC = 0.28;
/** Gamaka checks only when median |cents| in the window is below this (curves align in height). */
const GAMAKA_MAX_ALIGN_MEDIAN_CENTS = 72;
/** Per-frame |cents| must be below this for “aligned” frames when measuring alignment fraction. */
const GAMAKA_ALIGN_FRAME_CENTS = 88;
/** At least this fraction of voiced pairs in the window must be pitch-aligned. */
const GAMAKA_MIN_ALIGNED_FRAME_FRAC = 0.68;
/** The richer curve must move at least this much within a window to count as ornamented. */
const GAMAKA_MIN_ACTIVE_RANGE_CENTS = 135;
/** Richer side range must exceed passive range by this factor. */
const GAMAKA_RANGE_RATIO = 2.75;
/** Minimum gap in within-window pitch range (cents) between richer and flatter side. */
const GAMAKA_MIN_RANGE_GAP_CENTS = 100;
/** After merge, span must still exceed this |ref−user| range gap (cents). */
const GAMAKA_MIN_MERGED_RANGE_GAP_CENTS = 110;
const GAMAKA_MIN_REGION_SEC = 0.85;
/** Bridge consecutive hop windows into one span for the summary (≈ hop + window). */
const GAMAKA_MERGE_GAP_SEC = GAMAKA_WINDOW_HOP_SEC + GAMAKA_WINDOW_SEC;
const GAMAKA_MAX_REGIONS = 3;
/** User-flat vs reference: stricter bar — only when the chart clearly shows a flat orange line. */
const USER_FLAT_WINDOW_SEC = 0.6;
const USER_FLAT_WINDOW_HOP_SEC = 0.26;
const USER_FLAT_MAX_ALIGN_MEDIAN_CENTS = 78;
const USER_FLAT_ALIGN_FRAME_CENTS = 92;
const USER_FLAT_MIN_ALIGNED_FRAME_FRAC = 0.65;
const USER_FLAT_MIN_REF_RANGE_CENTS = 145;
const USER_FLAT_MAX_USER_TO_REF_RANGE = 0.4;
const USER_FLAT_MIN_RANGE_GAP_CENTS = 115;
const USER_FLAT_MIN_MERGED_RANGE_GAP_CENTS = 125;
const USER_FLAT_MIN_REGION_SEC = 1.0;
const USER_FLAT_MAX_REGIONS = 4;
const UNVOICED_PAIR_COST = 0.35;
const MIXED_VOICE_COST = 1.85;

export type RawPitchContour = {
  timesSec: Float32Array;
  hz: Float32Array;
  voiced: Uint8Array;
};

export type PitchChartPoint = {
  t: number;
  hz: number | null;
};

export type MergedPitchChartRow = {
  t: number;
  refHz: number | null;
  userHz: number | null;
};

/** Highlighted span on the reference timeline (seconds). */
export type ChartTimeRange = {
  startSec: number;
  endSec: number;
};

/** How much the user curve is shifted on the reference time axis (s). */
export type UserChartTiming = {
  /** Median user−ref offset on DTW matches (for labels / fallback). */
  shiftSec: number;
  label: string;
};

/** DTW warp paths between downsampled reference and user contours. */
export type DtwChartAlignment = {
  refDown: RawPitchContour;
  userDown: RawPitchContour;
  /** Reference time (s) for each user downsample frame. */
  refTimeByUserDownIdx: Float32Array;
  /** User recording time (s) for each reference downsample frame. */
  userTimeByRefDownIdx: Float32Array;
  medianLateSec: number;
};

function dtwTargetLenForDuration(durationSec: number): number {
  const scaled = Math.round(durationSec * DTW_NODES_PER_SEC);
  return Math.min(DTW_TARGET_LEN_MAX, Math.max(DTW_TARGET_LEN_MIN, scaled));
}

export type PitchMatchMistake = {
  teacherStartSec: number;
  teacherEndSec: number;
  avgCentsOff: number;
  tendsSharp: boolean;
};

/** One side shows clearly richer local pitch movement (gamakas) than the other in this span. */
export type GamakaFlatnessRegion = {
  teacherStartSec: number;
  teacherEndSec: number;
  refRangeCents: number;
  userRangeCents: number;
  richerSide: "reference" | "user";
};

export type TeacherStudentPitchAnalysis = {
  teacherDurationSec: number;
  studentDurationSec: number;
  framesCompared: number;
  /** Robust centre: median |cents| over aligned voiced pairs. */
  medianAbsCents: number;
  voicedPairFraction: number;
  mistakeRegions: PitchMatchMistake[];
  gamakaFlatnessRegions: GamakaFlatnessRegion[];
  summaryHint: string;
};

function midiFromHz(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

function centsBetween(hzTeacher: number, hzStudent: number): number {
  return 1200 * Math.log2(hzStudent / hzTeacher);
}

export function extractPitchContour(
  samples: Float32Array,
  sampleRate: number,
  frameSize = TEACHER_COMPARE_FRAME_SIZE,
  hopSize = TEACHER_COMPARE_HOP,
): RawPitchContour {
  const detect = createYinFrameDetector({
    sampleRate,
    threshold: 0.13,
    probabilityThreshold: 0.1,
  });

  let n = Math.max(0, Math.floor((samples.length - frameSize) / hopSize) + 1);
  if (samples.length < frameSize) n = 0;

  const timesSec = new Float32Array(n);
  const hz = new Float32Array(n);
  const voiced = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    const start = i * hopSize;
    const frame = samples.subarray(start, start + frameSize);
    const t = (start + frameSize * 0.5) / sampleRate;
    timesSec[i] = t;

    let h = NaN;
    let v = 0;
    if (computeRms(frame) >= RMS_GATE) {
      const y = detect(frame);
      if (y && y.hz > 55 && y.hz < 2000) {
        h = y.hz;
        v = 1;
      }
    }
    hz[i] = h;
    voiced[i] = v;
  }

  return { timesSec, hz, voiced };
}

/** Resample waveform for stable frame/hop sizing before contour extraction. */
export function normalizeRateForContour(samples: Float32Array, sampleRate: number): Float32Array {
  if (sampleRate === ANALYSIS_SAMPLE_RATE) return samples;
  return resampleLinear(samples, sampleRate, ANALYSIS_SAMPLE_RATE);
}

function clampContourLength(raw: RawPitchContour): RawPitchContour {
  /** Drop tail partial frame noise when buffer is tiny. */
  const maxDur = 8 * 60;
  let n = raw.timesSec.length;
  while (n > 0 && raw.timesSec[n - 1]! > maxDur) n--;
  if (n === raw.timesSec.length) return raw;
  const timesSec = raw.timesSec.subarray(0, n);
  const hz = raw.hz.subarray(0, n);
  const voiced = raw.voiced.subarray(0, n);
  return { timesSec, hz, voiced };
}

function downsampleContour(raw: RawPitchContour, targetLen: number): RawPitchContour {
  const rawClean = clampContourLength(raw);
  const n = rawClean.timesSec.length;
  if (n <= targetLen) return rawClean;

  const timesSec = new Float32Array(targetLen);
  const hz = new Float32Array(targetLen);
  const voiced = new Uint8Array(targetLen);

  for (let b = 0; b < targetLen; b++) {
    const t0 = (b / targetLen) * n;
    const t1 = ((b + 1) / targetLen) * n;
    let i0 = Math.floor(t0);
    let i1 = Math.ceil(t1);
    i0 = Math.max(0, Math.min(n - 1, i0));
    i1 = Math.max(i0 + 1, Math.min(n, i1));

    let sumHz = 0;
    let vox = 0;
    let tSum = 0;
    let count = 0;
    for (let i = i0; i < i1; i++) {
      if (rawClean.voiced[i]) {
        sumHz += rawClean.hz[i]!;
        vox += 1;
      }
      tSum += rawClean.timesSec[i]!;
      count += 1;
    }

    timesSec[b] = count > 0 ? tSum / count : rawClean.timesSec[i0]!;
    voiced[b] = vox >= count * 0.35 ? 1 : 0;
    hz[b] = vox > 0 ? sumHz / vox : NaN;
  }

  return { timesSec, hz, voiced };
}

function midiCarried(hzArr: Float32Array, voiced: Uint8Array): Float32Array {
  const n = hzArr.length;
  const midi = new Float32Array(n);
  let last = NaN;
  for (let i = 0; i < n; i++) {
    if (voiced[i] && Number.isFinite(hzArr[i]) && hzArr[i]! > 0) {
      last = midiFromHz(hzArr[i]!);
    }
    midi[i] = last;
  }
  if (!Number.isFinite(last)) {
    midi.fill(midiFromHz(200));
  }
  return midi;
}

function localCost(ma: number, mb: number, va: number, vb: number): number {
  if (!va && !vb) return UNVOICED_PAIR_COST * 0.2;
  if (!va || !vb) return MIXED_VOICE_COST;
  return Math.min(6, Math.abs(ma - mb));
}

/**
 * Classic DTW on downsampled MIDI tracks (~400 nodes — full grid is fine).
 * `back`: 2 = diagonal, 0 = vertical (consume teacher note), 1 = horizontal.
 */
function dtwPath(ma: Float32Array, mb: Float32Array, va: Uint8Array, vb: Uint8Array): [number, number][] {
  const n = ma.length;
  const m = mb.length;
  const cols = m + 1;
  const INF = 1e18;
  const dp = new Float64Array((n + 1) * (m + 1)).fill(INF);
  const back = new Uint8Array((n + 1) * (m + 1));
  const IX = (i: number, j: number) => i * cols + j;
  dp[IX(0, 0)] = 0;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const c = localCost(ma[i - 1]!, mb[j - 1]!, va[i - 1]!, vb[j - 1]!);
      let best = dp[IX(i - 1, j - 1)] + c;
      let bp = 2;
      const up = dp[IX(i - 1, j)] + c;
      if (up < best) {
        best = up;
        bp = 0;
      }
      const left = dp[IX(i, j - 1)] + c;
      if (left < best) {
        best = left;
        bp = 1;
      }
      dp[IX(i, j)] = best;
      back[IX(i, j)] = bp;
    }
  }

  const pathRev: [number, number][] = [];
  let i = n;
  let j = m;
  while (i >= 1 && j >= 1) {
    pathRev.unshift([i - 1, j - 1]);
    const b = back[IX(i, j)]!;
    if (b === 2) {
      i -= 1;
      j -= 1;
    } else if (b === 0) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return pathRev;
}

function chartHzNear(points: PitchChartPoint[], t: number, windowSec: number): number | null {
  if (points.length === 0) return null;
  const inWindow: { dt: number; hz: number }[] = [];
  for (const p of points) {
    if (p.hz == null || !Number.isFinite(p.hz)) continue;
    const dt = Math.abs(p.t - t);
    if (dt <= windowSec) inWindow.push({ dt, hz: p.hz });
  }
  if (inWindow.length === 0) return null;
  inWindow.sort((a, b) => a.dt - b.dt);
  return inWindow[0]!.hz;
}

function pitchRangeCentsInWindow(hzValues: number[]): number {
  if (hzValues.length < 2) return 0;
  let minMidi = Infinity;
  let maxMidi = -Infinity;
  for (const hz of hzValues) {
    if (!Number.isFinite(hz) || hz <= 0) continue;
    const m = midiFromHz(hz);
    minMidi = Math.min(minMidi, m);
    maxMidi = Math.max(maxMidi, m);
  }
  if (!Number.isFinite(minMidi)) return 0;
  return (maxMidi - minMidi) * 100;
}

function medianOfSorted(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function medianAbsCents(values: number[]): number {
  if (values.length === 0) return 0;
  const abs = values.map((v) => Math.abs(v)).sort((a, b) => a - b);
  return medianOfSorted(abs);
}

function regionsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function gamakaMismatch(
  activeRange: number,
  passiveRange: number,
): boolean {
  if (activeRange < GAMAKA_MIN_ACTIVE_RANGE_CENTS) return false;
  if (activeRange < passiveRange * GAMAKA_RANGE_RATIO) return false;
  if (activeRange - passiveRange < GAMAKA_MIN_RANGE_GAP_CENTS) return false;
  return true;
}

/** Reference shows clear pitch movement; user line is substantially flatter on the chart. */
function userIsSignificantlyFlatterThanReference(
  refRangeCents: number,
  userRangeCents: number,
): boolean {
  if (refRangeCents < USER_FLAT_MIN_REF_RANGE_CENTS) return false;
  if (userRangeCents > refRangeCents * USER_FLAT_MAX_USER_TO_REF_RANGE) return false;
  if (refRangeCents - userRangeCents < USER_FLAT_MIN_RANGE_GAP_CENTS) return false;
  return true;
}

function mergeAdjacentGamakaRegions(regions: GamakaFlatnessRegion[]): GamakaFlatnessRegion[] {
  if (regions.length <= 1) return regions;

  let sorted = [...regions].sort((a, b) => a.teacherStartSec - b.teacherStartSec);
  let changed = true;

  while (changed) {
    changed = false;
    const out: GamakaFlatnessRegion[] = [{ ...sorted[0]! }];
    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i]!;
      const prev = out[out.length - 1]!;
      const gap = cur.teacherStartSec - prev.teacherEndSec;
      if (cur.richerSide === prev.richerSide && gap <= GAMAKA_MERGE_GAP_SEC) {
        prev.teacherEndSec = Math.max(prev.teacherEndSec, cur.teacherEndSec);
        prev.refRangeCents = Math.max(prev.refRangeCents, cur.refRangeCents);
        prev.userRangeCents = Math.max(prev.userRangeCents, cur.userRangeCents);
        changed = true;
      } else {
        out.push({ ...cur });
      }
    }
    sorted = out;
  }

  return sorted;
}

/** Display-friendly reference span (avoids “29s – 29s” for sub-second hops). */
export function formatPitchSpanSec(startSec: number, endSec: number): string {
  const a = Math.floor(startSec);
  let b = Math.ceil(endSec);
  if (b <= a) b = a + 1;
  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
  };
  return `${fmt(a)} – ${fmt(b)}`;
}

/**
 * Windows where one side has much more local pitch movement (gamakas) than the other — either direction.
 */
export function detectGamakaFlatnessRegions(
  ref: PitchChartPoint[],
  userWarped: PitchChartPoint[],
): GamakaFlatnessRegion[] {
  if (ref.length === 0 || ref.length !== userWarped.length) return [];

  const endT = ref[ref.length - 1]?.t ?? 0;
  const flagged: GamakaFlatnessRegion[] = [];

  for (let winStart = 0; winStart < endT; winStart += GAMAKA_WINDOW_HOP_SEC) {
    const winEnd = winStart + GAMAKA_WINDOW_SEC;
    const refHz: number[] = [];
    const userHz: number[] = [];
    const centsOff: number[] = [];

    for (let i = 0; i < ref.length; i++) {
      const t = ref[i]!.t;
      if (t < winStart || t > winEnd) continue;
      const rh = ref[i]!.hz;
      const uh = userWarped[i]?.hz ?? null;
      if (rh != null && Number.isFinite(rh)) refHz.push(rh);
      if (uh != null && Number.isFinite(uh)) userHz.push(uh);
      if (
        rh != null &&
        uh != null &&
        Number.isFinite(rh) &&
        Number.isFinite(uh) &&
        rh > 0 &&
        uh > 0
      ) {
        centsOff.push(centsBetween(rh, uh));
      }
    }

    if (refHz.length < 3 || userHz.length < 3 || centsOff.length < 3) continue;

    const alignMedian = medianAbsCents(centsOff);
    if (alignMedian > GAMAKA_MAX_ALIGN_MEDIAN_CENTS) continue;

    const alignedFrac =
      centsOff.filter((c) => Math.abs(c) <= GAMAKA_ALIGN_FRAME_CENTS).length / centsOff.length;
    if (alignedFrac < GAMAKA_MIN_ALIGNED_FRAME_FRAC) continue;

    const refRange = pitchRangeCentsInWindow(refHz);
    const userRange = pitchRangeCentsInWindow(userHz);

    let richerSide: GamakaFlatnessRegion["richerSide"] | null = null;
    if (gamakaMismatch(refRange, userRange)) {
      richerSide = "reference";
    } else if (gamakaMismatch(userRange, refRange)) {
      richerSide = "user";
    }
    if (!richerSide) continue;

    flagged.push({
      teacherStartSec: winStart,
      teacherEndSec: Math.min(winEnd, endT),
      refRangeCents: refRange,
      userRangeCents: userRange,
      richerSide,
    });
  }

  const merged = mergeAdjacentGamakaRegions(flagged).filter((r) => {
    const span = r.teacherEndSec - r.teacherStartSec;
    if (span < GAMAKA_MIN_REGION_SEC) return false;
    const gap = Math.abs(r.refRangeCents - r.userRangeCents);
    if (gap < GAMAKA_MIN_MERGED_RANGE_GAP_CENTS) return false;
    const active = Math.max(r.refRangeCents, r.userRangeCents);
    const passive = Math.min(r.refRangeCents, r.userRangeCents);
    return gamakaMismatch(active, passive);
  });

  const strongest = [...merged].sort(
    (a, b) =>
      Math.abs(b.refRangeCents - b.userRangeCents) -
      Math.abs(a.refRangeCents - a.userRangeCents),
  );

  return strongest
    .slice(0, GAMAKA_MAX_REGIONS)
    .sort((a, b) => a.teacherStartSec - b.teacherStartSec);
}

/**
 * Passages where pitch height matches the reference but the user's curve is clearly flatter
 * (reference has much more local pitch movement on the chart).
 */
export function detectSignificantUserFlatnessRegions(
  ref: PitchChartPoint[],
  userWarped: PitchChartPoint[],
): GamakaFlatnessRegion[] {
  if (ref.length === 0 || ref.length !== userWarped.length) return [];

  const endT = ref[ref.length - 1]?.t ?? 0;
  const flagged: GamakaFlatnessRegion[] = [];

  for (let winStart = 0; winStart < endT; winStart += USER_FLAT_WINDOW_HOP_SEC) {
    const winEnd = winStart + USER_FLAT_WINDOW_SEC;
    const refHz: number[] = [];
    const userHz: number[] = [];
    const centsOff: number[] = [];

    for (let i = 0; i < ref.length; i++) {
      const t = ref[i]!.t;
      if (t < winStart || t > winEnd) continue;
      const rh = ref[i]!.hz;
      const uh = userWarped[i]?.hz ?? null;
      if (rh != null && Number.isFinite(rh)) refHz.push(rh);
      if (uh != null && Number.isFinite(uh)) userHz.push(uh);
      if (
        rh != null &&
        uh != null &&
        Number.isFinite(rh) &&
        Number.isFinite(uh) &&
        rh > 0 &&
        uh > 0
      ) {
        centsOff.push(centsBetween(rh, uh));
      }
    }

    if (refHz.length < 4 || userHz.length < 4 || centsOff.length < 4) continue;

    const alignMedian = medianAbsCents(centsOff);
    if (alignMedian > USER_FLAT_MAX_ALIGN_MEDIAN_CENTS) continue;

    const alignedFrac =
      centsOff.filter((c) => Math.abs(c) <= USER_FLAT_ALIGN_FRAME_CENTS).length /
      centsOff.length;
    if (alignedFrac < USER_FLAT_MIN_ALIGNED_FRAME_FRAC) continue;

    const refRange = pitchRangeCentsInWindow(refHz);
    const userRange = pitchRangeCentsInWindow(userHz);
    if (!userIsSignificantlyFlatterThanReference(refRange, userRange)) continue;

    flagged.push({
      teacherStartSec: winStart,
      teacherEndSec: Math.min(winEnd, endT),
      refRangeCents: refRange,
      userRangeCents: userRange,
      richerSide: "reference",
    });
  }

  const merged = mergeAdjacentGamakaRegions(flagged).filter((r) => {
    const span = r.teacherEndSec - r.teacherStartSec;
    if (span < USER_FLAT_MIN_REGION_SEC) return false;
    const gap = r.refRangeCents - r.userRangeCents;
    if (gap < USER_FLAT_MIN_MERGED_RANGE_GAP_CENTS) return false;
    return userIsSignificantlyFlatterThanReference(r.refRangeCents, r.userRangeCents);
  });

  const strongest = [...merged].sort(
    (a, b) => b.refRangeCents - b.userRangeCents - (a.refRangeCents - a.userRangeCents),
  );

  return strongest
    .slice(0, USER_FLAT_MAX_REGIONS)
    .sort((a, b) => a.teacherStartSec - b.teacherStartSec);
}

function gamakaRegionGap(r: GamakaFlatnessRegion): number {
  return Math.abs(r.refRangeCents - r.userRangeCents);
}

/** Prefer user-flat spans, then other gamaka; dedupe overlaps keeping the stronger gap. */
function mergeGamakaRegionsForSummary(
  userFlat: GamakaFlatnessRegion[],
  general: GamakaFlatnessRegion[],
): GamakaFlatnessRegion[] {
  const userRicher = general.filter((g) => g.richerSide === "user");
  const refRicher = general.filter((g) => g.richerSide === "reference");
  const candidates = [...userFlat, ...userRicher, ...refRicher];
  const kept: GamakaFlatnessRegion[] = [];

  for (const r of candidates) {
    const overlapIdx = kept.findIndex((k) =>
      regionsOverlap(
        k.teacherStartSec,
        k.teacherEndSec,
        r.teacherStartSec,
        r.teacherEndSec,
      ),
    );
    if (overlapIdx < 0) {
      kept.push({ ...r });
      continue;
    }
    if (gamakaRegionGap(r) > gamakaRegionGap(kept[overlapIdx]!)) {
      kept[overlapIdx] = { ...r };
    }
  }

  return kept
    .sort((a, b) => gamakaRegionGap(b) - gamakaRegionGap(a))
    .slice(0, 5)
    .sort((a, b) => a.teacherStartSec - b.teacherStartSec);
}

function buildSummaryHint(
  mistakeCount: number,
  gamakaRegions: GamakaFlatnessRegion[],
): string {
  const refRicher = gamakaRegions.filter((g) => g.richerSide === "reference");
  const userRicher = gamakaRegions.filter((g) => g.richerSide === "user");
  const gamakaCount = gamakaRegions.length;

  if (mistakeCount === 0 && gamakaCount === 0) {
    return "No significant pitch deviations — your take matches the reference well. Small wiggles on the chart are normal tracking noise.";
  }

  const parts: string[] = [];

  if (mistakeCount > 0) {
    parts.push(
      `Found ${mistakeCount} section${mistakeCount === 1 ? "" : "s"} where your pitch was not close to the reference (large sustained gap — not a small gamaka wiggle). Review these first.`,
    );
  } else if (gamakaCount > 0) {
    parts.push(
      "Overall pitch height is reasonably close, but some passages differ in how much the pitch moves.",
    );
  } else {
    parts.push(
      "No large sustained pitch gaps were flagged — still worth scanning the chart and listening back.",
    );
  }

  if (refRicher.length > 0) {
    parts.push(
      `In ${refRicher.length} section${refRicher.length === 1 ? "" : "s"}, pitch height is close but your line is significantly flatter than the reference (the teacher clip moves much more on the chart).`,
    );
  }
  if (userRicher.length > 0) {
    parts.push(
      `In ${userRicher.length} section${userRicher.length === 1 ? "" : "s"}, pitch height matches reasonably well but your line shows clearly more pitch movement than the reference.`,
    );
  }

  return parts.join(" ");
}

function mergeAdjacentMistakes(mistakes: PitchMatchMistake[]): PitchMatchMistake[] {
  if (mistakes.length <= 1) return mistakes;
  const sorted = [...mistakes].sort((a, b) => a.teacherStartSec - b.teacherStartSec);
  const out: PitchMatchMistake[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const prev = out[out.length - 1]!;
    if (cur.teacherStartSec - prev.teacherEndSec <= SIGNIFICANT_MERGE_GAP_SEC) {
      const span = cur.teacherEndSec - prev.teacherStartSec;
      const w0 = Math.max(0.001, prev.teacherEndSec - prev.teacherStartSec);
      const w1 = Math.max(0.001, cur.teacherEndSec - cur.teacherStartSec);
      const avg = (prev.avgCentsOff * w0 + cur.avgCentsOff * w1) / (w0 + w1);
      prev.teacherEndSec = Math.max(prev.teacherEndSec, cur.teacherEndSec);
      prev.avgCentsOff = avg;
      prev.tendsSharp = avg > 0;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

function detectSignificantMistakes(
  centsList: number[],
  teacherT: number[],
): PitchMatchMistake[] {
  const mistakes: PitchMatchMistake[] = [];
  let runStart = -1;
  let runCents: number[] = [];

  const flushRun = (endIdx: number) => {
    if (runStart < 0 || runCents.length === 0) return;
    const absCents = runCents.map((c) => Math.abs(c));
    const medianAbs = medianAbsCents(runCents);
    const highFrac =
      absCents.filter((c) => c >= SIGNIFICANT_PITCH_CENTS).length / absCents.length;
    const avg = runCents.reduce((a, b) => a + b, 0) / runCents.length;
    const t0 = teacherT[runStart] ?? 0;
    const t1 = teacherT[endIdx] ?? t0;
    const duration = Math.max(t1, t0) - Math.min(t0, t1);
    if (duration < SIGNIFICANT_MIN_DURATION_SEC) {
      runStart = -1;
      runCents = [];
      return;
    }
    if (medianAbs < SIGNIFICANT_PITCH_CENTS) {
      runStart = -1;
      runCents = [];
      return;
    }
    if (highFrac < SIGNIFICANT_MIN_HIGH_FRAME_FRAC) {
      runStart = -1;
      runCents = [];
      return;
    }
    mistakes.push({
      teacherStartSec: Math.min(t0, t1),
      teacherEndSec: Math.max(t0, t1),
      avgCentsOff: avg,
      tendsSharp: avg > 0,
    });
    runStart = -1;
    runCents = [];
  };

  for (let i = 0; i < centsList.length; i++) {
    const c = centsList[i]!;
    if (Math.abs(c) >= SIGNIFICANT_PITCH_CENTS) {
      if (runStart < 0) runStart = i;
      runCents.push(c);
    } else {
      flushRun(i - 1);
    }
  }
  flushRun(centsList.length - 1);

  return mergeAdjacentMistakes(mistakes).sort(
    (a, b) => Math.abs(b.avgCentsOff) - Math.abs(a.avgCentsOff),
  );
}

function dropGamakaOverlappingMistakes(
  mistakes: PitchMatchMistake[],
  gamaka: GamakaFlatnessRegion[],
): GamakaFlatnessRegion[] {
  if (mistakes.length === 0) return gamaka;
  return gamaka.filter(
    (g) =>
      !mistakes.some((m) =>
        regionsOverlap(
          g.teacherStartSec,
          g.teacherEndSec,
          m.teacherStartSec,
          m.teacherEndSec,
        ),
      ),
  );
}

function buildPitchAnalysis(
  centsList: number[],
  teacherT: number[],
  voicedPairs: number,
  pathFrames: number,
  teacherDurSec: number,
  studentDurSec: number,
  gamakaFlatnessRegions: GamakaFlatnessRegion[],
): TeacherStudentPitchAnalysis {
  if (centsList.length === 0) {
    return {
      teacherDurationSec: teacherDurSec,
      studentDurationSec: studentDurSec,
      framesCompared: pathFrames,
      medianAbsCents: 0,
      voicedPairFraction: 0,
      mistakeRegions: [],
      gamakaFlatnessRegions: [],
      summaryHint:
        "Very little voiced overlap detected — sing louder/closer and match the phrase against the reference.",
    };
  }

  const absSorted = [...centsList].map((c) => Math.abs(c)).sort((a, b) => a - b);
  const medianAbsCents = absSorted[Math.floor(absSorted.length / 2)]!;
  const mistakes = detectSignificantMistakes(centsList, teacherT);
  const gamakaFiltered = dropGamakaOverlappingMistakes(mistakes, gamakaFlatnessRegions);
  const voicedFrac = voicedPairs / Math.max(1, pathFrames);

  return {
    teacherDurationSec: teacherDurSec,
    studentDurationSec: studentDurSec,
    framesCompared: pathFrames,
    medianAbsCents,
    voicedPairFraction: voicedFrac,
    mistakeRegions: mistakes.slice(0, 6),
    gamakaFlatnessRegions: gamakaFiltered,
    summaryHint: buildSummaryHint(mistakes.length, gamakaFiltered),
  };
}

function summarizeMistakesFromPath(
  path: [number, number][],
  teacher: RawPitchContour,
  student: RawPitchContour,
): { medianAbsCents: number; voicedFrac: number; mistakes: PitchMatchMistake[] } {
  const centsList: number[] = [];
  const teacherT: number[] = [];
  let voicedPairs = 0;

  for (const [ti, sj] of path) {
    if (
      teacher.voiced[ti] &&
      student.voiced[sj] &&
      Number.isFinite(teacher.hz[ti]) &&
      Number.isFinite(student.hz[sj])
    ) {
      const cents = centsBetween(teacher.hz[ti]!, student.hz[sj]!);
      centsList.push(cents);
      teacherT.push(teacher.timesSec[ti]!);
      voicedPairs += 1;
    }
  }

  if (centsList.length === 0) {
    return {
      medianAbsCents: 0,
      voicedFrac: 0,
      mistakes: [],
    };
  }

  const absSorted = [...centsList].map((c) => Math.abs(c)).sort((a, b) => a - b);
  const medianAbsCents = absSorted[Math.floor(absSorted.length / 2)]!;
  const mistakes = detectSignificantMistakes(centsList, teacherT);
  const voicedFrac =
    voicedPairs / Math.max(1, path.filter(([ti, sj]) => teacher.voiced[ti] || student.voiced[sj]).length);

  return {
    medianAbsCents,
    voicedFrac,
    mistakes,
  };
}

/** Human-readable ornamentation gap for the summary list. */
export function formatGamakaFlatnessDeviation(r: GamakaFlatnessRegion): string {
  if (r.richerSide === "user") {
    return "Pitch height is fairly close here, but your line wiggles more than the reference — check whether the extra gamakas fit the phrase.";
  }
  const gap = Math.round(r.refRangeCents - r.userRangeCents);
  return `Pitch height is fairly close here, but your singing looks significantly flatter on the chart (reference moves about ${gap} cents more in this span — likely missing gamakas or slides).`;
}

/** Human-readable pitch deviation for the summary list. */
export function formatSignificantPitchDeviation(m: PitchMatchMistake): string {
  const abs = Math.abs(m.avgCentsOff);
  const semis = abs / 100;
  const semisLabel =
    semis >= 1.05 ? `about ${semis.toFixed(1)} semitones` : `about ${Math.round(abs)} cents`;
  const dir = m.tendsSharp ? "higher" : "lower";
  return `Pitch is not close here — you sang ${semisLabel} ${dir} than the reference (critical pitch gap, not a small gamaka difference).`;
}

/**
 * Compare pitch on the reference timeline (same DTW warp as the chart).
 * Only sustained, large gaps are reported in {@link TeacherStudentPitchAnalysis.mistakeRegions}.
 */
export function compareTeacherStudentPitchOnRefAxis(
  ref: PitchChartPoint[],
  user: PitchChartPoint[],
  teacherDurSec: number,
  studentDurSec: number,
): TeacherStudentPitchAnalysis {
  const alignment = computeDtwChartAlignment(ref, user);
  if (!alignment) {
    return {
      teacherDurationSec: teacherDurSec,
      studentDurationSec: studentDurSec,
      framesCompared: 0,
      medianAbsCents: 0,
      voicedPairFraction: 0,
      mistakeRegions: [],
      gamakaFlatnessRegions: [],
      summaryHint: "Upload both clips with enough singing to compare.",
    };
  }

  const warpedUser = warpUserChartPointsToReference(ref, user, alignment);
  const userFlatRegions = detectSignificantUserFlatnessRegions(ref, warpedUser);
  const generalGamaka = detectGamakaFlatnessRegions(ref, warpedUser);
  const gamakaFlatnessRegions = mergeGamakaRegionsForSummary(
    userFlatRegions,
    generalGamaka,
  );
  const centsList: number[] = [];
  const teacherT: number[] = [];
  let voicedPairs = 0;

  for (let i = 0; i < ref.length; i++) {
    const p = ref[i]!;
    const uHz = warpedUser[i]?.hz ?? null;
    if (p.hz == null || !Number.isFinite(p.hz) || uHz == null) continue;
    centsList.push(centsBetween(p.hz, uHz));
    teacherT.push(p.t);
    voicedPairs += 1;
  }

  return buildPitchAnalysis(
    centsList,
    teacherT,
    voicedPairs,
    ref.length,
    teacherDurSec,
    studentDurSec,
    gamakaFlatnessRegions,
  );
}

export function compareTeacherStudentPitchContours(
  rawT: RawPitchContour,
  rawS: RawPitchContour,
  teacherDurSec: number,
  studentDurSec: number,
): TeacherStudentPitchAnalysis {
  const ref = contourToChartPoints(rawT);
  const user = contourToChartPoints(rawS);
  return compareTeacherStudentPitchOnRefAxis(ref, user, teacherDurSec, studentDurSec);
}

export function compareTeacherStudentPitch(
  teacherSamples: Float32Array,
  teacherSr: number,
  studentSamples: Float32Array,
  studentSr: number,
): TeacherStudentPitchAnalysis {
  const ts = normalizeRateForContour(teacherSamples, teacherSr);
  const ss = normalizeRateForContour(studentSamples, studentSr);
  const rawT = extractPitchContour(ts, ANALYSIS_SAMPLE_RATE);
  const rawS = extractPitchContour(ss, ANALYSIS_SAMPLE_RATE);
  return compareTeacherStudentPitchContours(
    rawT,
    rawS,
    ts.length / ANALYSIS_SAMPLE_RATE,
    ss.length / ANALYSIS_SAMPLE_RATE,
  );
}

/** Build a pitch contour ready for charting (44.1 kHz analysis grid). */
export function buildPitchContourForChart(
  samples: Float32Array,
  sampleRate: number,
): RawPitchContour {
  const ws = normalizeRateForContour(samples, sampleRate);
  return extractPitchContour(ws, ANALYSIS_SAMPLE_RATE);
}

/**
 * Light offline cleanup for chart display (CREPE glitches on fast gamakas / dense phrases).
 * Comparison DTW still uses the raw contour.
 */
export function smoothPitchContourForChart(raw: RawPitchContour): RawPitchContour {
  const n = raw.timesSec.length;
  const hz = new Float32Array(n);
  const voiced = new Uint8Array(n);
  const gate = new OctaveJumpGate({ maxSemitoneJump: 5, confirmFrames: 3 });
  const med = new MedianRing(5);

  for (let i = 0; i < n; i++) {
    const rawHz = raw.voiced[i] && Number.isFinite(raw.hz[i]) ? raw.hz[i]! : null;
    const gated = gate.feed(rawHz);
    if (gated == null) {
      med.reset();
      hz[i] = NaN;
      voiced[i] = 0;
      continue;
    }
    const sm = med.push(gated);
    hz[i] = sm;
    voiced[i] = 1;
  }

  return { timesSec: raw.timesSec, hz, voiced };
}

export function contourToChartPoints(contour: RawPitchContour): PitchChartPoint[] {
  const smoothed = smoothPitchContourForChart(contour);
  const n = smoothed.timesSec.length;
  const out: PitchChartPoint[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      t: smoothed.timesSec[i]!,
      hz: smoothed.voiced[i] && Number.isFinite(smoothed.hz[i]) ? smoothed.hz[i]! : null,
    });
  }
  return out;
}

function hzAtTime(series: PitchChartPoint[], t: number, windowSec: number): number | null {
  if (series.length === 0) return null;
  const inWindow: number[] = [];
  for (const p of series) {
    if (p.hz == null || !Number.isFinite(p.hz)) continue;
    if (Math.abs(p.t - t) <= windowSec) inWindow.push(p.hz);
  }
  if (inWindow.length === 0) return null;
  const sorted = [...inWindow].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m]! : (sorted[m - 1]! + sorted[m]!) / 2;
}

/** Max time gap (s) to draw a connecting line between detected pitch samples. */
export const CHART_PITCH_BRIDGE_SEC = 0.5;

/**
 * Linear Hz between bracketing samples so the chart line stays connected across brief drops.
 */
export function hzAtTimeBridged(
  series: PitchChartPoint[],
  t: number,
  maxBridgeSec = CHART_PITCH_BRIDGE_SEC,
): number | null {
  const voiced = series.filter((p) => p.hz != null && Number.isFinite(p.hz));
  if (voiced.length === 0) return null;

  let hi = 0;
  while (hi < voiced.length && voiced[hi]!.t < t) hi += 1;

  const after = voiced[hi] ?? null;
  const before = hi > 0 ? voiced[hi - 1]! : null;

  if (before && after) {
    const gap = after.t - before.t;
    if (gap <= maxBridgeSec) {
      const f = (t - before.t) / gap;
      return before.hz! + (after.hz! - before.hz!) * f;
    }
    return null;
  }
  if (before && t - before.t <= maxBridgeSec) return before.hz;
  if (after && after.t - t <= maxBridgeSec) return after.hz;
  return null;
}

/** Insert interpolated points across short gaps (live ml5 / sparse CREPE). */
export function bridgePitchChartPoints(
  points: readonly PitchChartPoint[],
  maxGapSec = CHART_PITCH_BRIDGE_SEC,
  stepSec = 0.04,
): PitchChartPoint[] {
  const voiced = points.filter((p) => p.hz != null && Number.isFinite(p.hz));
  if (voiced.length < 2) return [...voiced];

  const out: PitchChartPoint[] = [];
  for (let i = 0; i < voiced.length; i += 1) {
    const a = voiced[i]!;
    out.push(a);
    if (i + 1 >= voiced.length) break;
    const b = voiced[i + 1]!;
    const gap = b.t - a.t;
    if (gap > stepSec && gap <= maxGapSec) {
      const n = Math.max(1, Math.ceil(gap / stepSec) - 1);
      for (let k = 1; k <= n; k += 1) {
        const f = k / (n + 1);
        out.push({
          t: a.t + gap * f,
          hz: a.hz! + (b.hz! - a.hz!) * f,
        });
      }
    }
  }
  return out.sort((x, y) => x.t - y.t);
}

function contourFromChartPoints(points: PitchChartPoint[]): RawPitchContour {
  const n = points.length;
  const timesSec = new Float32Array(n);
  const hz = new Float32Array(n);
  const voiced = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    timesSec[i] = points[i]!.t;
    const h = points[i]!.hz;
    if (h != null && Number.isFinite(h)) {
      hz[i] = h;
      voiced[i] = 1;
    } else {
      hz[i] = NaN;
      voiced[i] = 0;
    }
  }
  return { timesSec, hz, voiced };
}

function interpolateNaNSeries(values: Float32Array, fallback: number) {
  const n = values.length;
  let first = -1;
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(values[i])) {
      first = i;
      break;
    }
  }
  if (first < 0) {
    values.fill(fallback);
    return;
  }
  for (let i = 0; i < first; i++) values[i] = values[first]!;
  let last = first;
  for (let i = first + 1; i < n; i++) {
    if (Number.isFinite(values[i])) {
      for (let k = last + 1; k < i; k++) {
        const u = (k - last) / (i - last);
        values[k] = values[last]! * (1 - u) + values[i]! * u;
      }
      last = i;
    }
  }
  for (let i = last + 1; i < n; i++) values[i] = values[last]!;
}

function buildWarpSeriesFromPath(
  path: [number, number][],
  pathIdx: 0 | 1,
  valueContour: RawPitchContour,
  indexLen: number,
  indexIsPathDim: 0 | 1,
  fallback: number,
): Float32Array {
  const sums = new Float64Array(indexLen);
  const counts = new Uint32Array(indexLen);
  for (const pair of path) {
    const idx = pair[indexIsPathDim]!;
    const val = valueContour.timesSec[pair[pathIdx]!]!;
    sums[idx] += val;
    counts[idx] += 1;
  }
  const out = new Float32Array(indexLen);
  for (let i = 0; i < indexLen; i++) {
    out[i] = counts[i]! > 0 ? sums[i]! / counts[i]! : NaN;
  }
  interpolateNaNSeries(out, fallback);
  for (let i = 1; i < indexLen; i++) {
    if (out[i]! < out[i - 1]!) out[i] = out[i - 1]!;
  }
  return out;
}

function buildRefTimeByUserDownIdx(
  path: [number, number][],
  tDown: RawPitchContour,
  sDown: RawPitchContour,
): Float32Array {
  return buildWarpSeriesFromPath(
    path,
    0,
    tDown,
    sDown.timesSec.length,
    1,
    sDown.timesSec[0] ?? 0,
  );
}

function buildUserTimeByRefDownIdx(
  path: [number, number][],
  tDown: RawPitchContour,
  sDown: RawPitchContour,
): Float32Array {
  return buildWarpSeriesFromPath(
    path,
    1,
    sDown,
    tDown.timesSec.length,
    0,
    tDown.timesSec[0] ?? 0,
  );
}

function medianUserLateSec(
  path: [number, number][],
  tDown: RawPitchContour,
  sDown: RawPitchContour,
): number {
  const deltas: number[] = [];
  for (const [ti, sj] of path) {
    if (tDown.voiced[ti] && sDown.voiced[sj]) {
      deltas.push(sDown.timesSec[sj]! - tDown.timesSec[ti]!);
    }
  }
  if (deltas.length === 0) return 0;
  deltas.sort((a, b) => a - b);
  return deltas[Math.floor(deltas.length / 2)]!;
}

function timingLabelFromMedianLate(medianLateSec: number): string {
  const abs = Math.abs(medianLateSec);
  if (abs < 0.12) {
    return "Orange curve aligned to the reference timeline (DTW)";
  }
  const t = abs.toFixed(1);
  return medianLateSec > 0
    ? `About ${t}s late on average — orange warped to match reference throughout`
    : `About ${t}s early on average — orange warped to match reference throughout`;
}

/** DTW alignment used to warp the user pitch curve onto the reference time axis. */
export function computeDtwChartAlignment(
  ref: PitchChartPoint[],
  user: PitchChartPoint[],
): DtwChartAlignment | null {
  if (ref.length === 0 || user.length === 0) return null;

  const rawT = contourFromChartPoints(ref);
  const rawS = contourFromChartPoints(user);
  const refEnd = rawT.timesSec.length > 0 ? rawT.timesSec[rawT.timesSec.length - 1]! : 0;
  const targetLen = dtwTargetLenForDuration(Math.max(refEnd, 1));
  const tDown = downsampleContour(rawT, targetLen);
  const sDown = downsampleContour(rawS, targetLen);
  const path = dtwPath(
    midiCarried(tDown.hz, tDown.voiced),
    midiCarried(sDown.hz, sDown.voiced),
    tDown.voiced,
    sDown.voiced,
  );

  return {
    refDown: tDown,
    userDown: sDown,
    refTimeByUserDownIdx: buildRefTimeByUserDownIdx(path, tDown, sDown),
    userTimeByRefDownIdx: buildUserTimeByRefDownIdx(path, tDown, sDown),
    medianLateSec: medianUserLateSec(path, tDown, sDown),
  };
}

/** Map a timestamp in the user recording to the reference chart axis. */
export function mapUserRecordingTimeToRefAxis(
  userTimeSec: number,
  alignment: DtwChartAlignment,
): number {
  const times = alignment.userDown.timesSec;
  const mapped = alignment.refTimeByUserDownIdx;
  if (times.length === 0) return userTimeSec;

  if (userTimeSec <= times[0]!) return mapped[0]!;
  const last = times.length - 1;
  if (userTimeSec >= times[last]!) return mapped[last]!;

  let lo = 0;
  let hi = last;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid]! <= userTimeSec) lo = mid;
    else hi = mid;
  }

  const t0 = times[lo]!;
  const t1 = times[hi]!;
  const u = t1 > t0 ? (userTimeSec - t0) / (t1 - t0) : 0;
  return mapped[lo]! * (1 - u) + mapped[hi]! * u;
}

/** Inverse of {@link mapUserRecordingTimeToRefAxis} for segment playback. */
export function mapRefAxisTimeToUserRecording(
  refTimeSec: number,
  alignment: DtwChartAlignment,
): number {
  const refTimes = alignment.refDown.timesSec;
  const userTimes = alignment.userTimeByRefDownIdx;
  if (refTimes.length === 0) return refTimeSec;

  if (refTimeSec <= refTimes[0]!) return userTimes[0]!;
  const last = refTimes.length - 1;
  if (refTimeSec >= refTimes[last]!) return userTimes[last]!;

  let lo = 0;
  let hi = last;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (refTimes[mid]! <= refTimeSec) lo = mid;
    else hi = mid;
  }

  const r0 = refTimes[lo]!;
  const r1 = refTimes[hi]!;
  const u0 = userTimes[lo]!;
  const u1 = userTimes[hi]!;
  const u = r1 > r0 ? (refTimeSec - r0) / (r1 - r0) : 0;
  return u0 * (1 - u) + u1 * u;
}

/**
 * Resample user pitch onto the reference timeline (ref-master DTW warp).
 * At each reference time, plots the Hz the user was singing at the aligned moment.
 */
export function warpUserChartPointsToReference(
  ref: PitchChartPoint[],
  user: PitchChartPoint[],
  alignment: DtwChartAlignment,
): PitchChartPoint[] {
  const sampleWindow = 0.06;
  const warped: PitchChartPoint[] = [];
  for (const p of ref) {
    const userT = mapRefAxisTimeToUserRecording(p.t, alignment);
    const hz = chartHzNear(user, userT, sampleWindow);
    warped.push({ t: p.t, hz });
  }
  return warped;
}

/** Keep user playback locked to reference time via DTW (for “play both”). */
export function syncUserAudioToRefTime(
  userAudio: HTMLAudioElement,
  refTimeSec: number,
  alignment: DtwChartAlignment,
  thresholdSec = PLAYBACK_SYNC_THRESHOLD_SEC,
): void {
  const target = mapRefAxisTimeToUserRecording(refTimeSec, alignment);
  const maxT = Number.isFinite(userAudio.duration) ? userAudio.duration : target;
  const clamped = Math.max(0, Math.min(target, maxT));
  if (Math.abs(userAudio.currentTime - clamped) > thresholdSec) {
    userAudio.currentTime = clamped;
  }
}

/**
 * Summary timing (median late/early) for labels; chart uses full DTW warp.
 */
export function estimateUserChartTiming(
  ref: PitchChartPoint[],
  user: PitchChartPoint[],
): UserChartTiming {
  const alignment = computeDtwChartAlignment(ref, user);
  if (!alignment) {
    return { shiftSec: 0, label: "" };
  }
  return {
    shiftSec: alignment.medianLateSec,
    label: timingLabelFromMedianLate(alignment.medianLateSec),
  };
}

/** Single constant shift (legacy); prefer {@link warpUserChartPointsToReference}. */
export function shiftUserChartPoints(user: PitchChartPoint[], shiftSec: number): PitchChartPoint[] {
  if (Math.abs(shiftSec) < 1e-6) return user;
  return user.map((p) => ({ t: p.t - shiftSec, hz: p.hz }));
}

/** Reference line unchanged; user times should already be passed through {@link shiftUserChartPoints}. */
export function mergePitchChartSeries(
  ref: PitchChartPoint[],
  user: PitchChartPoint[],
  maxPoints = 900,
): MergedPitchChartRow[] {
  const refEnd = ref.at(-1)?.t ?? 0;
  const userEnd = user.at(-1)?.t ?? 0;
  const maxT = Math.max(refEnd, userEnd, 0.01);
  const hop = Math.max(0.04, maxT / maxPoints);
  const window = hop * 1.35;
  const rows: MergedPitchChartRow[] = [];
  for (let t = 0; t <= maxT + 1e-6; t += hop) {
    const bridgedUser = hzAtTimeBridged(user, t);
    rows.push({
      t: Math.round(t * 100) / 100,
      refHz: hzAtTime(ref, t, window),
      userHz: bridgedUser ?? hzAtTime(user, t, window),
    });
  }
  return rows;
}

/** Quick sanity check after decode that the clip has usable pitched vocals. */
export function contourHasEnoughVoicing(
  samples: Float32Array,
  sampleRate: number,
  minVoicedFrames = 12,
): boolean {
  const ws = normalizeRateForContour(samples, sampleRate);
  const raw = extractPitchContour(ws, ANALYSIS_SAMPLE_RATE);
  let v = 0;
  for (let i = 0; i < raw.voiced.length; i++) if (raw.voiced[i]) v++;
  return v >= minVoicedFrames;
}

export function contourHasEnoughVoicingRaw(
  raw: RawPitchContour,
  minVoicedFrames = 12,
): boolean {
  let v = 0;
  for (let i = 0; i < raw.voiced.length; i++) if (raw.voiced[i]) v++;
  return v >= minVoicedFrames;
}
