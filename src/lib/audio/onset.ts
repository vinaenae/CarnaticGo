/** Naive spectral flux / energy-rise onset detector. */
export class OnsetDetector {
  private prev = 0;
  private lastOnset = 0;
  private readonly minIntervalMs: number;
  private readonly riseRatio: number;
  private readonly floor: number;

  constructor(options?: { minIntervalMs?: number; riseRatio?: number; floor?: number }) {
    this.minIntervalMs = options?.minIntervalMs ?? 110;
    this.riseRatio = options?.riseRatio ?? 1.35;
    this.floor = options?.floor ?? 0.018;
  }

  /** Pass current RMS energy; returns true if onset at this instant. */
  tick(rms: number, nowMs: number): boolean {
    const rising = rms > this.prev * this.riseRatio && rms > this.floor;
    this.prev = rms * 0.92 + this.prev * 0.08;
    if (!rising) return false;
    if (nowMs - this.lastOnset < this.minIntervalMs) return false;
    this.lastOnset = nowMs;
    return true;
  }

  reset() {
    this.prev = 0;
    this.lastOnset = 0;
  }
}
