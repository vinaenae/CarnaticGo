import {
  contourToChartPoints,
  formatGamakaFlatnessDeviation,
  mapRefAxisTimeToUserRecording,
  mapUserRecordingTimeToRefAxis,
  type DtwChartAlignment,
  type GamakaFlatnessRegion,
  type RawPitchContour,
  type TeacherStudentPitchAnalysis,
} from "@/lib/audio/pitchContour";
import {
  findClosestShiffmanNote,
  practiceStepsToTunerNotes,
} from "@/lib/audio/warmup-crepe-tuner";
import { buildAllRatioSwaraSteps } from "@/lib/practice-raga-scale";
import type { AlignedPitchRow } from "@/lib/singalong/aligned-pitch-rows";

export type ReferenceMismatchClip = {
  id: string;
  refStartSec: number;
  refEndSec: number;
  /** User recording times for Hear you (DTW-mapped). */
  userStartSec?: number;
  userEndSec?: number;
  label: string;
  description: string;
  score: number;
};

export type SingAlongClipSections = {
  stable: ReferenceMismatchClip[];
  contour: ReferenceMismatchClip[];
  flat: ReferenceMismatchClip[];
};

const MIN_CLIP_SEC = 0.9;
const MAX_CLIP_SEC = 7;
const PAD_SEC = 0.2;
const MAX_CLIPS_PER_SECTION = 3;
/** Merge clip ranges when gap on reference timeline is this small (e.g. 8–10s + 11–12s). */
const CLIP_MERGE_GAP_SEC = 2.5;

/** Stable holds — both sides steady; flag when landing cents differ enough. */
const STABLE_WINDOW_SEC = 0.34;
const STABLE_MAX_RANGE_CENTS = 34;
const STABLE_MIN_REGION_SEC = 0.42;
const STABLE_MERGE_GAP_SEC = 0.12;
const STABLE_DIFF_MIN_CENTS = 18;

/** Contour — melodic direction / shape mismatch. */
const CONTOUR_WINDOW_SEC = 0.52;
const CONTOUR_WINDOW_HOP_SEC = 0.24;
const CONTOUR_MIN_REGION_SEC = 0.75;
const CONTOUR_MOVEMENT_DEADZONE_CENTS = 28;
const CONTOUR_MIN_DISAGREE_FRAC = 0.36;
const CONTOUR_MAX_LOCAL_CORR = 0.52;

/** Flat vs moving — one Hz track static, the other moves. */
const FLAT_WINDOW_SEC = 0.55;
const FLAT_WINDOW_HOP_SEC = 0.28;
const FLAT_MIN_ACTIVE_RANGE_CENTS = 95;
const FLAT_MAX_PASSIVE_TO_ACTIVE_RATIO = 0.42;
const FLAT_MIN_RANGE_GAP_CENTS = 85;
const FLAT_MAX_ALIGN_MEDIAN_CENTS = 78;
const FLAT_MIN_REGION_SEC = 0.8;

type ClipCandidate = {
  teacherStartSec: number;
  teacherEndSec: number;
  score: number;
  label: string;
  description: string;
};

function clipWindow(
  start: number,
  end: number,
  refDurationSec: number,
): { start: number; end: number } {
  let s = Math.max(0, start - PAD_SEC);
  let e = Math.min(refDurationSec, end + PAD_SEC);
  const dur = e - s;
  if (dur > MAX_CLIP_SEC) {
    const mid = (s + e) / 2;
    s = Math.max(0, mid - MAX_CLIP_SEC / 2);
    e = Math.min(refDurationSec, s + MAX_CLIP_SEC);
  }
  if (dur < MIN_CLIP_SEC && refDurationSec >= MIN_CLIP_SEC) {
    const mid = (s + e) / 2;
    s = Math.max(0, mid - MIN_CLIP_SEC / 2);
    e = Math.min(refDurationSec, s + MIN_CLIP_SEC);
  }
  return { start: s, end: e };
}

function regionsOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
}

function midiFromHz(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

function pitchRangeCents(hzValues: number[]): number {
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

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m]! : (sorted[m - 1]! + sorted[m]!) / 2;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function medianAbs(values: number[]): number {
  return median(values.map(Math.abs));
}

function swaraLabelForHz(hz: number, saHz: number | null | undefined): string {
  if (!(hz > 0)) return "Swara";
  if (saHz != null && saHz > 0) {
    const notes = practiceStepsToTunerNotes(buildAllRatioSwaraSteps(saHz));
    const match = findClosestShiffmanNote(hz, notes);
    if (match) return match.closestNote.note;
  }
  return "Note";
}

function movementDirection(deltaCents: number): -1 | 0 | 1 {
  if (deltaCents > CONTOUR_MOVEMENT_DEADZONE_CENTS) return 1;
  if (deltaCents < -CONTOUR_MOVEMENT_DEADZONE_CENTS) return -1;
  return 0;
}

function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 4) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a = xs[i]! - mx;
    const b = ys[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  if (den < 1e-9) return null;
  return num / den;
}

function mergeCloseReferenceClips(clips: ReferenceMismatchClip[]): ReferenceMismatchClip[] {
  if (clips.length <= 1) return clips;

  const sorted = [...clips].sort((a, b) => a.refStartSec - b.refStartSec);
  const merged: ReferenceMismatchClip[] = [{ ...sorted[0]! }];

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const prev = merged[merged.length - 1]!;
    if (cur.refStartSec - prev.refEndSec <= CLIP_MERGE_GAP_SEC) {
      prev.refEndSec = Math.max(prev.refEndSec, cur.refEndSec);
      prev.score = Math.max(prev.score, cur.score);
      if (cur.score >= prev.score) {
        prev.label = cur.label;
        prev.description = cur.description;
      }
      if (prev.userStartSec != null && cur.userStartSec != null && prev.userEndSec != null && cur.userEndSec != null) {
        prev.userStartSec = Math.min(prev.userStartSec, cur.userStartSec);
        prev.userEndSec = Math.max(prev.userEndSec, cur.userEndSec);
      }
    } else {
      merged.push({ ...cur });
    }
  }

  return merged;
}

function userTimesForRefClip(
  clip: Pick<ReferenceMismatchClip, "refStartSec" | "refEndSec">,
  alignment: DtwChartAlignment,
  userContour: RawPitchContour,
): { userStartSec: number; userEndSec: number } {
  const userPts = contourToChartPoints(userContour);
  const userDur =
    userPts.length > 0 ? userPts[userPts.length - 1]!.t : Number.POSITIVE_INFINITY;
  const matched: number[] = [];

  for (const p of userPts) {
    if (p.hz == null || !Number.isFinite(p.hz)) continue;
    const refT = mapUserRecordingTimeToRefAxis(p.t, alignment);
    if (refT >= clip.refStartSec - 0.05 && refT <= clip.refEndSec + 0.05) {
      matched.push(p.t);
    }
  }

  let userStart: number;
  let userEnd: number;
  if (matched.length >= 2) {
    userStart = Math.min(...matched);
    userEnd = Math.max(...matched);
  } else {
    userStart = mapRefAxisTimeToUserRecording(clip.refStartSec, alignment);
    userEnd = mapRefAxisTimeToUserRecording(clip.refEndSec, alignment);
  }

  if (userEnd < userStart) {
    const a = userStart;
    userStart = userEnd;
    userEnd = a;
  }

  userStart = Math.max(0, userStart);
  userEnd = Math.min(userDur, Math.max(userEnd, userStart + MIN_CLIP_SEC * 0.5));

  return { userStartSec: userStart, userEndSec: userEnd };
}

function enrichClipsWithUserTimes(
  clips: ReferenceMismatchClip[],
  alignment: DtwChartAlignment | null | undefined,
  userContour: RawPitchContour | null | undefined,
): ReferenceMismatchClip[] {
  if (!alignment || !userContour) return clips;
  return clips.map((clip) => {
    const { userStartSec, userEndSec } = userTimesForRefClip(clip, alignment, userContour);
    return { ...clip, userStartSec, userEndSec };
  });
}

function pickClipsFromCandidates(
  candidates: ClipCandidate[],
  refDurationSec: number,
  idPrefix: string,
  maxClips = MAX_CLIPS_PER_SECTION,
): ReferenceMismatchClip[] {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const picked: ReferenceMismatchClip[] = [];

  for (const c of sorted) {
    const { start, end } = clipWindow(c.teacherStartSec, c.teacherEndSec, refDurationSec);
    if (end - start < MIN_CLIP_SEC * 0.85) continue;
    if (picked.some((p) => regionsOverlap(p.refStartSec, p.refEndSec, start, end))) continue;

    picked.push({
      id: `${idPrefix}-${picked.length}`,
      refStartSec: start,
      refEndSec: end,
      label: c.label,
      description: c.description,
      score: c.score,
    });
  }

  const merged = mergeCloseReferenceClips(picked);
  return merged
    .sort((a, b) => b.score - a.score)
    .slice(0, maxClips)
    .sort((a, b) => a.refStartSec - b.refStartSec)
    .map((clip, i) => ({ ...clip, id: `${idPrefix}-${i}` }));
}

type StableSpan = {
  startIdx: number;
  endIdx: number;
  cents: number[];
  refHz: number[];
};

function detectStableSpans(rows: AlignedPitchRow[]): StableSpan[] {
  const halfWin = STABLE_WINDOW_SEC / 2;
  const stableMask = rows.map((_, i) => {
    const t = rows[i]!.tRefSec;
    const refHz: number[] = [];
    const userHz: number[] = [];
    for (const row of rows) {
      if (Math.abs(row.tRefSec - t) > halfWin) continue;
      if (row.refHz != null && Number.isFinite(row.refHz)) refHz.push(row.refHz);
      if (row.userHzAligned != null && Number.isFinite(row.userHzAligned)) {
        userHz.push(row.userHzAligned);
      }
    }
    if (refHz.length < 2 || userHz.length < 2) return false;
    return (
      pitchRangeCents(refHz) <= STABLE_MAX_RANGE_CENTS &&
      pitchRangeCents(userHz) <= STABLE_MAX_RANGE_CENTS
    );
  });

  const spans: StableSpan[] = [];
  let i = 0;
  while (i < rows.length) {
    if (!stableMask[i]) {
      i += 1;
      continue;
    }
    const startIdx = i;
    while (i < rows.length && stableMask[i]) i += 1;
    const endIdx = i - 1;
    if (rows[endIdx]!.tRefSec - rows[startIdx]!.tRefSec < STABLE_MIN_REGION_SEC) continue;

    const cents: number[] = [];
    const refHz: number[] = [];
    for (let j = startIdx; j <= endIdx; j++) {
      const row = rows[j]!;
      if (row.cents != null && Number.isFinite(row.cents)) cents.push(row.cents);
      if (row.refHz != null && Number.isFinite(row.refHz)) refHz.push(row.refHz);
    }
    if (cents.length < 3) continue;
    spans.push({ startIdx, endIdx, cents, refHz });
  }

  if (spans.length <= 1) return spans;
  const sorted = [...spans].sort((a, b) => rows[a.startIdx]!.tRefSec - rows[b.startIdx]!.tRefSec);
  const out: StableSpan[] = [{ ...sorted[0]! }];
  for (let k = 1; k < sorted.length; k++) {
    const cur = sorted[k]!;
    const prev = out[out.length - 1]!;
    if (rows[cur.startIdx]!.tRefSec - rows[prev.endIdx]!.tRefSec <= STABLE_MERGE_GAP_SEC) {
      prev.endIdx = cur.endIdx;
      prev.cents = [...prev.cents, ...cur.cents];
      prev.refHz = [...prev.refHz, ...cur.refHz];
    } else {
      out.push({ ...cur });
    }
  }
  return out.filter((s) => rows[s.endIdx]!.tRefSec - rows[s.startIdx]!.tRefSec >= STABLE_MIN_REGION_SEC);
}

function stableClipCandidates(
  rows: AlignedPitchRow[],
  saHz: number | null | undefined,
): ClipCandidate[] {
  const out: ClipCandidate[] = [];
  for (const span of detectStableSpans(rows)) {
    const avgCents = mean(span.cents);
    if (Math.abs(avgCents) < STABLE_DIFF_MIN_CENTS) continue;

    const startSec = rows[span.startIdx]!.tRefSec;
    const endSec = rows[span.endIdx]!.tRefSec;
    const swara = swaraLabelForHz(median(span.refHz), saHz);
    const dir = avgCents > 0 ? "sharp" : "flat";
    const amount =
      Math.abs(avgCents) < 25
        ? `${Math.round(Math.abs(avgCents))} cents`
        : `about ${(Math.abs(avgCents) / 100).toFixed(1)} semitones`;

    out.push({
      teacherStartSec: startSec,
      teacherEndSec: endSec,
      score: Math.abs(avgCents),
      label: `${swara} hold — you were ${dir}`,
      description: `Both held a steady ${swara}; on this landing you were ${amount} ${dir} vs the teacher (gamakas excluded).`,
    });
  }
  return out;
}

type ContourFlag = {
  teacherStartSec: number;
  teacherEndSec: number;
  score: number;
  disagreeFrac: number;
};

function detectContourMismatchWindows(rows: AlignedPitchRow[]): ContourFlag[] {
  if (rows.length < 8) return [];
  const endT = rows[rows.length - 1]?.tRefSec ?? 0;
  const flagged: ContourFlag[] = [];

  for (let winStart = 0; winStart < endT; winStart += CONTOUR_WINDOW_HOP_SEC) {
    const winEnd = winStart + CONTOUR_WINDOW_SEC;
    const refMidi: number[] = [];
    const userMidi: number[] = [];

    for (const row of rows) {
      if (row.tRefSec < winStart || row.tRefSec > winEnd) continue;
      if (row.refHz == null || row.userHzAligned == null) continue;
      if (!Number.isFinite(row.refHz) || !Number.isFinite(row.userHzAligned)) continue;
      refMidi.push(midiFromHz(row.refHz));
      userMidi.push(midiFromHz(row.userHzAligned));
    }

    if (refMidi.length < 5) continue;

    let disagree = 0;
    let movePairs = 0;
    for (let i = 1; i < refMidi.length; i++) {
      const refDelta = (refMidi[i]! - refMidi[i - 1]!) * 100;
      const userDelta = (userMidi[i]! - userMidi[i - 1]!) * 100;
      const rd = movementDirection(refDelta);
      const ud = movementDirection(userDelta);
      if (rd === 0 && ud === 0) {
        movePairs += 1;
        continue;
      }
      movePairs += 1;
      if (rd !== ud) disagree += 1;
    }

    const disagreeFrac = movePairs > 0 ? disagree / movePairs : 0;
    const corr = pearson(refMidi, userMidi);
    const corrBad = corr == null || corr < CONTOUR_MAX_LOCAL_CORR;
    if (disagreeFrac < CONTOUR_MIN_DISAGREE_FRAC && !corrBad) continue;

    const score =
      disagreeFrac * 120 + (corr == null ? 60 : Math.max(0, (CONTOUR_MAX_LOCAL_CORR - corr) * 80));

    flagged.push({
      teacherStartSec: winStart,
      teacherEndSec: Math.min(winEnd, endT),
      score,
      disagreeFrac,
    });
  }

  if (flagged.length === 0) return [];

  const sorted = [...flagged].sort((a, b) => a.teacherStartSec - b.teacherStartSec);
  const merged: ContourFlag[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const prev = merged[merged.length - 1]!;
    if (cur.teacherStartSec - prev.teacherEndSec <= CONTOUR_WINDOW_HOP_SEC + 0.12) {
      prev.teacherEndSec = Math.max(prev.teacherEndSec, cur.teacherEndSec);
      prev.score = Math.max(prev.score, cur.score);
      prev.disagreeFrac = Math.max(prev.disagreeFrac, cur.disagreeFrac);
    } else {
      merged.push({ ...cur });
    }
  }

  return merged.filter((r) => r.teacherEndSec - r.teacherStartSec >= CONTOUR_MIN_REGION_SEC);
}

function contourClipCandidates(rows: AlignedPitchRow[]): ClipCandidate[] {
  return detectContourMismatchWindows(rows).map((r) => ({
    teacherStartSec: r.teacherStartSec,
    teacherEndSec: r.teacherEndSec,
    score: r.score,
    label: "Melody moved differently",
    description: `Your pitch contour diverged from the teacher here (direction/shape mismatch ~${Math.round(r.disagreeFrac * 100)}% of moves). Hear how the reference phrases it.`,
  }));
}

function oneSideMuchFlatter(active: number, passive: number): boolean {
  if (active < FLAT_MIN_ACTIVE_RANGE_CENTS) return false;
  if (passive > active * FLAT_MAX_PASSIVE_TO_ACTIVE_RATIO) return false;
  if (active - passive < FLAT_MIN_RANGE_GAP_CENTS) return false;
  return true;
}

function gamakaGap(r: GamakaFlatnessRegion): number {
  return Math.abs(r.refRangeCents - r.userRangeCents);
}

export function detectFlatContrastFromAlignedRows(
  rows: AlignedPitchRow[],
): GamakaFlatnessRegion[] {
  if (rows.length < 6) return [];

  const endT = rows[rows.length - 1]?.tRefSec ?? 0;
  const flagged: GamakaFlatnessRegion[] = [];

  for (let winStart = 0; winStart < endT; winStart += FLAT_WINDOW_HOP_SEC) {
    const winEnd = winStart + FLAT_WINDOW_SEC;
    const refHz: number[] = [];
    const userHz: number[] = [];
    const centsOff: number[] = [];

    for (const row of rows) {
      if (row.tRefSec < winStart || row.tRefSec > winEnd) continue;
      if (row.refHz != null && Number.isFinite(row.refHz)) refHz.push(row.refHz);
      if (row.userHzAligned != null && Number.isFinite(row.userHzAligned)) {
        userHz.push(row.userHzAligned);
      }
      if (row.cents != null && Number.isFinite(row.cents)) centsOff.push(row.cents);
    }

    if (refHz.length < 3 || userHz.length < 3 || centsOff.length < 3) continue;
    if (medianAbs(centsOff) > FLAT_MAX_ALIGN_MEDIAN_CENTS) continue;

    const refRange = pitchRangeCents(refHz);
    const userRange = pitchRangeCents(userHz);

    let richerSide: GamakaFlatnessRegion["richerSide"] | null = null;
    if (oneSideMuchFlatter(refRange, userRange)) richerSide = "reference";
    else if (oneSideMuchFlatter(userRange, refRange)) richerSide = "user";
    if (!richerSide) continue;

    flagged.push({
      teacherStartSec: winStart,
      teacherEndSec: Math.min(winEnd, endT),
      refRangeCents: refRange,
      userRangeCents: userRange,
      richerSide,
    });
  }

  if (flagged.length === 0) return [];

  const sorted = [...flagged].sort((a, b) => a.teacherStartSec - b.teacherStartSec);
  const merged: GamakaFlatnessRegion[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const prev = merged[merged.length - 1]!;
    if (cur.teacherStartSec - prev.teacherEndSec <= FLAT_WINDOW_HOP_SEC + 0.15) {
      prev.teacherEndSec = Math.max(prev.teacherEndSec, cur.teacherEndSec);
      prev.refRangeCents = Math.max(prev.refRangeCents, cur.refRangeCents);
      prev.userRangeCents = Math.min(prev.userRangeCents, cur.userRangeCents);
      if (cur.richerSide === "reference") prev.richerSide = "reference";
    } else {
      merged.push({ ...cur });
    }
  }

  return merged
    .filter((r) => r.teacherEndSec - r.teacherStartSec >= FLAT_MIN_REGION_SEC)
    .filter((r) => gamakaGap(r) >= FLAT_MIN_RANGE_GAP_CENTS)
    .sort((a, b) => gamakaGap(b) - gamakaGap(a));
}

function flatClipCandidates(
  analysis: TeacherStudentPitchAnalysis,
  alignedRows: AlignedPitchRow[] | null | undefined,
): ClipCandidate[] {
  const regions = new Map<string, GamakaFlatnessRegion>();
  const add = (r: GamakaFlatnessRegion) => {
    const key = `${r.teacherStartSec.toFixed(2)}-${r.teacherEndSec.toFixed(2)}`;
    const ex = regions.get(key);
    if (!ex || gamakaGap(r) > gamakaGap(ex)) regions.set(key, r);
  };
  for (const g of analysis.gamakaFlatnessRegions) add(g);
  if (alignedRows?.length) {
    for (const g of detectFlatContrastFromAlignedRows(alignedRows)) add(g);
  }

  return [...regions.values()].map((g) => {
    const gap = gamakaGap(g);
    const label =
      g.richerSide === "reference"
        ? "Your pitch barely moved here"
        : "Reference pitch stayed steadier here";
    return {
      teacherStartSec: g.teacherStartSec,
      teacherEndSec: g.teacherEndSec,
      score: gap,
      label,
      description: formatGamakaFlatnessDeviation(g),
    };
  });
}

/**
 * Reference clips grouped by analysis type (0–3 clips each).
 */
export function pickSingAlongClipSections(
  analysis: TeacherStudentPitchAnalysis,
  refDurationSec: number,
  alignedRows: AlignedPitchRow[] | null | undefined,
  saHz?: number | null,
  alignment?: DtwChartAlignment | null,
  userContour?: RawPitchContour | null,
): SingAlongClipSections {
  const rows = alignedRows ?? [];

  const enrich = (clips: ReferenceMismatchClip[]) =>
    enrichClipsWithUserTimes(clips, alignment, userContour);

  return {
    stable:
      rows.length > 0
        ? enrich(
            pickClipsFromCandidates(stableClipCandidates(rows, saHz), refDurationSec, "stable"),
          )
        : [],
    contour:
      rows.length > 0
        ? enrich(
            pickClipsFromCandidates(contourClipCandidates(rows), refDurationSec, "contour"),
          )
        : [],
    flat: enrich(
      pickClipsFromCandidates(
        flatClipCandidates(analysis, alignedRows),
        refDurationSec,
        "flat",
      ),
    ),
  };
}

/** @deprecated Use {@link pickSingAlongClipSections}. */
export function pickReferenceMismatchClips(
  analysis: TeacherStudentPitchAnalysis,
  refDurationSec: number,
  alignedRows?: AlignedPitchRow[] | null,
  saHz?: number | null,
): ReferenceMismatchClip[] {
  const s = pickSingAlongClipSections(analysis, refDurationSec, alignedRows, saHz);
  return [...s.stable, ...s.contour, ...s.flat].sort((a, b) => a.refStartSec - b.refStartSec);
}

export function formatClipRange(startSec: number, endSec: number): string {
  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
  };
  return `${fmt(startSec)} – ${fmt(endSec)}`;
}
