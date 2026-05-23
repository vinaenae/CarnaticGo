/**
 * Smoothing layer: spike rejection, median, moving average (~300–600 ms), light EMA.
 * Kept separate from YIN and from shruti deviation mapping.
 */

function medianSorted(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export type OctaveRejectConfig = {
  /** Single-frame jump vs last accepted (semitones) above this is treated as suspicious. */
  maxSemitoneJump: number;
  /** Consecutive agreeing frames required before accepting a large jump. */
  confirmFrames: number;
};

const DEFAULT_OCT: OctaveRejectConfig = {
  maxSemitoneJump: 9,
  confirmFrames: 7,
};

/** Rejects sudden octave-like jumps unless the new region is sustained. */
export class OctaveJumpGate {
  private lastAccepted: number | null = null;
  private pendingHz: number | null = null;
  private streak = 0;
  private readonly cfg: OctaveRejectConfig;

  constructor(cfg: Partial<OctaveRejectConfig> = {}) {
    this.cfg = { ...DEFAULT_OCT, ...cfg };
  }

  reset() {
    this.lastAccepted = null;
    this.pendingHz = null;
    this.streak = 0;
  }

  /** Pass accepted Hz from YIN+confidence, or null to reset streak. */
  feed(hz: number | null): number | null {
    if (hz == null) {
      this.streak = 0;
      this.pendingHz = null;
      return null;
    }
    if (this.lastAccepted == null) {
      this.lastAccepted = hz;
      return hz;
    }
    const jumpSemis = Math.abs(12 * Math.log2(hz / this.lastAccepted));
    if (jumpSemis <= this.cfg.maxSemitoneJump) {
      this.pendingHz = null;
      this.streak = 0;
      this.lastAccepted = hz;
      return hz;
    }
    if (this.pendingHz != null && Math.abs(12 * Math.log2(hz / this.pendingHz)) < 2) {
      this.streak += 1;
    } else {
      this.pendingHz = hz;
      this.streak = 1;
    }
    if (this.streak >= this.cfg.confirmFrames) {
      this.lastAccepted = this.pendingHz;
      this.pendingHz = null;
      this.streak = 0;
      return this.lastAccepted;
    }
    return this.lastAccepted;
  }
}

export class MedianRing {
  private readonly buf: number[] = [];
  constructor(private readonly size: number) {}

  reset() {
    this.buf.length = 0;
  }

  push(v: number): number {
    this.buf.push(v);
    while (this.buf.length > this.size) this.buf.shift();
    return medianSorted(this.buf);
  }
}

export class TimedMovingAverage {
  private readonly samples: { t: number; v: number }[] = [];
  constructor(private readonly windowMs: number) {}

  reset() {
    this.samples.length = 0;
  }

  push(nowMs: number, v: number): number {
    this.samples.push({ t: nowMs, v });
    const cut = nowMs - this.windowMs;
    while (this.samples.length > 0 && this.samples[0].t < cut) this.samples.shift();
    if (this.samples.length === 0) return v;
    let s = 0;
    for (const x of this.samples) s += x.v;
    return s / this.samples.length;
  }
}

export class EmaScalar {
  private v: number | null = null;
  constructor(private readonly alpha: number) {}

  reset() {
    this.v = null;
  }

  push(x: number): number {
    if (this.v == null) {
      this.v = x;
      return x;
    }
    this.v = this.v * (1 - this.alpha) + x * this.alpha;
    return this.v;
  }

  get(): number | null {
    return this.v;
  }
}

/** Second-order low-pass for meter / needle (critically damped-ish two-pole). */
export class DampedFollower {
  private x = 0;
  private v = 0;
  constructor(
    private readonly stiffness: number,
    private readonly damping: number,
  ) {}

  reset() {
    this.x = 0;
    this.v = 0;
  }

  /** Step toward target (same units, e.g. cents). dtSeconds ~ 1/60 for RAF. */
  step(target: number, dtSeconds: number): number {
    const k = this.stiffness;
    const c = this.damping;
    const accel = k * (target - this.x) - c * this.v;
    this.v += accel * dtSeconds;
    this.x += this.v * dtSeconds;
    return this.x;
  }

  snapTo(x: number) {
    this.x = x;
    this.v = 0;
  }

  get(): number {
    return this.x;
  }
}
