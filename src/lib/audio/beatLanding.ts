/**
 * Classify each vocal attack vs the metronome grid (one pulse per beat at session BPM).
 *
 * Onset detectors fire **after** the true transient; we shift the clock slightly earlier so
 * “on the click” singing still reads as on beat. The tolerance is beat-relative so faster
 * BPM stays fair without demanding sub‑20 ms precision from the mic path.
 */

import { continuousBeatOffsetMs } from "@/lib/audio/tempo";

export type BeatLandingVerdict = "on_beat" | "early" | "late";

export type BeatAttackEvent = {
  offsetMs: number;
  verdict: BeatLandingVerdict;
  /** 1–22 when pitch matched a chart row at landing; absent for energy-only hits. */
  shruti22Index?: number | null;
  /** Sa / Ri / Ga / Ma / Pa / Dha / Ni / Sa when `shruti22Index` is set. */
  svaraShort?: string;
};

/**
 * Audio-time shift (seconds) applied only when scoring an **attack** vs the grid.
 * Typical stack: buffer + analyser + energy/flux rise (order ~25–55 ms).
 */
export const ONSET_BEAT_LATENCY_COMPENSATION_SEC = 0.044;

/** Signed ms vs nearest click for a note attack (latency-compensated). */
export function onsetTimingOffsetMs(params: {
  audioTimeSeconds: number;
  sessionStartAudioSeconds: number;
  bpm: number;
}): number {
  return continuousBeatOffsetMs({
    audioTimeSeconds: params.audioTimeSeconds - ONSET_BEAT_LATENCY_COMPENSATION_SEC,
    sessionStartAudioSeconds: params.sessionStartAudioSeconds,
    bpm: params.bpm,
  });
}

/**
 * Half-width of the “on the beat” window (± this many ms from the nearest click still counts as perfect).
 * Scales with beat length so one **musical** beat is the reference, not a fixed tiny ms window.
 */
export function beatLandingToleranceMs(bpm: number): number {
  const beatMs = 60000 / Math.max(1, bpm);
  return Math.min(105, Math.max(58, beatMs * 0.2));
}

/** +offsetMs = after the click (late); − = early. */
export function verdictForOnsetVsBeat(offsetMs: number, bpm: number): BeatLandingVerdict {
  const tol = beatLandingToleranceMs(bpm);
  if (Math.abs(offsetMs) <= tol) return "on_beat";
  return offsetMs > 0 ? "late" : "early";
}
