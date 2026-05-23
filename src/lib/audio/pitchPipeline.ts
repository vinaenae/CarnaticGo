/**
 * Live shruti pipeline: CREPE (preferred) or YIN Hz → smooth → nearest chart target → cents feedback.
 */

import { matchLiveShruti, shrutiFeedbackStatus } from "@/lib/audio/liveShrutiFeedback";
import { createYinFrameDetector } from "@/lib/audio/yinFrame";
import {
  DampedFollower,
  EmaScalar,
  MedianRing,
  OctaveJumpGate,
  TimedMovingAverage,
} from "@/lib/audio/pitchSmooth";
import type { ShrutiFeedbackStatus } from "@/lib/audio/liveShrutiFeedback";

const RMS_GATE = 0.0035;
const YIN_PROB_VOICED = 0.125;
const CREPE_CONF_VOICED = 0.35;
const SILENT_RESET_FRAMES = 28;
const MA_WINDOW_MS = 520;
const HZ_EMA_ALPHA = 0.12;
/** EMA on cents deviation — stable during gamakas. */
const CENTS_EMA_ALPHA = 0.14;
const METER_STIFFNESS = 48;
const METER_DAMPING = 24;

export type ExternalPitchReading = {
  hz: number;
  probability: number;
};

export type VocalPitchFrame = {
  deviationCents: number;
  smoothedDeviation: number;
  confidence: number;
  voiced: boolean;
  shruti22Index: number | null;
  targetShrutiHz: number | null;
  /** Folded Hz for shruti chart feedback. */
  detectedHz: number | null;
  /** Smoothed detected Hz before shruti folding (for raga swara matching). */
  smoothedHz: number | null;
  feedbackStatus: ShrutiFeedbackStatus;
};

function shrutiConfidence(probability: number, deviationCents: number): number {
  const tune = Math.max(0, 1 - Math.min(1, Math.abs(deviationCents) / 90));
  const bounded = Math.max(0, Math.min(1, probability));
  return Math.max(0, Math.min(1, bounded * (0.35 + 0.65 * tune)));
}

export class VocalPitchProcessor {
  private detectFrame: ReturnType<typeof createYinFrameDetector>;
  private readonly octave = new OctaveJumpGate({ maxSemitoneJump: 9, confirmFrames: 7 });
  private readonly median = new MedianRing(7);
  private readonly ma = new TimedMovingAverage(MA_WINDOW_MS);
  private readonly hzEma = new EmaScalar(HZ_EMA_ALPHA);
  private readonly centsEma = new EmaScalar(CENTS_EMA_ALPHA);
  private readonly needle = new DampedFollower(METER_STIFFNESS, METER_DAMPING);
  private lastWallMs = 0;
  private silentFrames = 0;

  constructor(sampleRate: number) {
    this.detectFrame = createYinFrameDetector({
      sampleRate,
      threshold: 0.13,
      probabilityThreshold: 0.1,
    });
  }

  reset() {
    this.octave.reset();
    this.median.reset();
    this.ma.reset();
    this.hzEma.reset();
    this.centsEma.reset();
    this.needle.reset();
    this.lastWallMs = 0;
    this.silentFrames = 0;
  }

  process(
    wallMs: number,
    buffer: Float32Array,
    rms: number,
    saHz: number,
    tanpuraKey: string,
    external?: ExternalPitchReading | null,
  ): VocalPitchFrame {
    const dt =
      this.lastWallMs > 0
        ? Math.min(0.045, Math.max(0.008, (wallMs - this.lastWallMs) / 1000))
        : 1 / 60;
    this.lastWallMs = wallMs;

    const yin = this.detectFrame(buffer);
    const useCrepe = external != null && Number.isFinite(external.hz);
    const rawHz = useCrepe ? external!.hz : yin?.hz ?? null;
    const rawProbability = useCrepe ? external!.probability : yin?.probability ?? 0;
    const probGate = useCrepe ? CREPE_CONF_VOICED : YIN_PROB_VOICED;

    const voiced =
      rawHz != null && rms >= RMS_GATE && rawProbability >= probGate && rawHz > 65 && rawHz < 2200;

    if (!voiced) {
      this.silentFrames += 1;
      this.octave.feed(null);
      if (this.silentFrames >= SILENT_RESET_FRAMES) {
        this.median.reset();
        this.ma.reset();
        this.hzEma.reset();
        this.centsEma.reset();
        this.needle.reset();
      }
      const smoothedDeviation = this.needle.step(0, dt);
      return {
        deviationCents: 0,
        smoothedDeviation,
        confidence: 0,
        voiced: false,
        shruti22Index: null,
        targetShrutiHz: null,
        detectedHz: null,
        smoothedHz: null,
        feedbackStatus: "idle",
      };
    }

    this.silentFrames = 0;
    const gated = this.octave.feed(rawHz)!;
    const med = this.median.push(gated);
    const avg = this.ma.push(wallMs, med);
    const smoothHz = this.hzEma.push(avg);

    const match = matchLiveShruti(smoothHz, saHz, tanpuraKey, true);
    if (!match) {
      const smoothedDeviation = this.needle.step(0, dt);
      return {
        deviationCents: 0,
        smoothedDeviation,
        confidence: shrutiConfidence(rawProbability, 0),
        voiced: true,
        shruti22Index: null,
        targetShrutiHz: null,
        detectedHz: null,
        smoothedHz: smoothHz,
        feedbackStatus: "idle",
      };
    }

    const deviationCents = match.cents;
    const smoothedCents = this.centsEma.push(deviationCents);
    const smoothedDeviation = this.needle.step(smoothedCents, dt);
    const status = shrutiFeedbackStatus(smoothedCents, true);

    return {
      deviationCents,
      smoothedDeviation,
      confidence: shrutiConfidence(rawProbability, smoothedCents),
      voiced: true,
      shruti22Index: match.shruti22Index,
      targetShrutiHz: match.targetHz,
      detectedHz: match.detectedHz,
      smoothedHz: smoothHz,
      feedbackStatus: status,
    };
  }
}
