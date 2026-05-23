/**
 * Detects syllable / note attacks for “swara on the beat” feedback.
 * Combines energy rise (RMS), spectral flux, and a **fast-vs-slow envelope** path so
 * softer internal syllables during **legato / continuous** singing still produce hits.
 * Min spacing scales with BPM so faster songs can register roughly one check per beat.
 * Hits may come from **energy / spectrum** (including speaker transients) or voiced syllables;
 * the practice hook scores every declared hit vs the metronome.
 */

function rectifiedSpectralFlux(prev: Uint8Array, cur: Uint8Array): number {
  const n = Math.min(prev.length, cur.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = cur[i] / 255 - prev[i] / 255;
    if (d > 0) sum += d;
  }
  return sum / Math.sqrt(n);
}

export type VocalBeatAttackTick = {
  rms: number;
  byteFreq: Uint8Array;
  wallMs: number;
  /** When true, attack is more likely to be a sung syllable (not only room noise). */
  voiced: boolean;
  /** Session metronome — used to cap how often we can declare a new attack. */
  bpm: number;
};

export class VocalBeatAttackDetector {
  private prevByte: Uint8Array | null = null;
  private prevRmsSmoothed = 0;
  private prevFluxSmoothed = 0;
  private lastOnset = 0;
  private fastEnv = 0;
  private slowEnv = 0;
  private prevFastPeak = 0;
  private readonly riseRatio: number;
  private readonly floor: number;
  private readonly fluxRatio: number;
  private readonly fluxFloor: number;

  constructor(
    options?: {
      riseRatio?: number;
      floor?: number;
      fluxRatio?: number;
      fluxFloor?: number;
    },
  ) {
    this.riseRatio = options?.riseRatio ?? 1.32;
    this.floor = options?.floor ?? 0.016;
    this.fluxRatio = options?.fluxRatio ?? 1.42;
    this.fluxFloor = options?.fluxFloor ?? 0.014;
  }

  /** Min ms between attacks: ~fraction of one beat, bounded (legato needs tighter spacing than 82ms at fast BPM). */
  private minGapMs(bpm: number): number {
    const beatMs = 60000 / Math.max(40, bpm);
    return Math.max(38, Math.min(105, beatMs * 0.24));
  }

  /** True when a new attack (syllable onset) is declared at this frame. */
  tick({ rms, byteFreq, wallMs, voiced, bpm }: VocalBeatAttackTick): boolean {
    const minGap = this.minGapMs(bpm);

    if (!this.prevByte || this.prevByte.length !== byteFreq.length) {
      this.prevByte = new Uint8Array(byteFreq);
      this.prevRmsSmoothed = rms;
      this.prevFluxSmoothed = 0;
      this.fastEnv = rms;
      this.slowEnv = rms;
      this.prevFastPeak = rms;
      return false;
    }

    const flux = rectifiedSpectralFlux(this.prevByte, byteFreq);
    this.prevByte.set(byteFreq);

    const effFluxFloor = voiced ? this.fluxFloor * 0.48 : this.fluxFloor;
    const effRise = voiced ? this.riseRatio * 0.9 : this.riseRatio;
    const effFloor = voiced ? this.floor * 0.72 : this.floor;

    const rmsRising = rms > this.prevRmsSmoothed * effRise && rms > effFloor;
    const fluxRising = flux > this.prevFluxSmoothed * this.fluxRatio && flux > effFluxFloor;

    this.fastEnv = 0.24 * rms + 0.76 * this.fastEnv;
    this.slowEnv = 0.032 * rms + 0.968 * this.slowEnv;
    const delicate =
      voiced &&
      rms > effFloor * 0.88 &&
      this.fastEnv > this.slowEnv * 1.07 &&
      this.fastEnv > this.prevFastPeak * 1.028;
    this.prevFastPeak = this.fastEnv;

    const voiceOrStrong = voiced || rms > 0.022;
    const hit = voiceOrStrong && (rmsRising || fluxRising || delicate);

    this.prevRmsSmoothed = rms * 0.92 + this.prevRmsSmoothed * 0.08;
    this.prevFluxSmoothed = flux * 0.88 + this.prevFluxSmoothed * 0.12;

    if (!hit) return false;
    if (wallMs - this.lastOnset < minGap) return false;
    this.lastOnset = wallMs;
    return true;
  }

  reset() {
    this.prevByte = null;
    this.prevRmsSmoothed = 0;
    this.prevFluxSmoothed = 0;
    this.lastOnset = 0;
    this.fastEnv = 0;
    this.slowEnv = 0;
    this.prevFastPeak = 0;
  }
}
