import { TANPURA_SAMPLE_MANIFEST, nominalHzForTanpuraKey } from "@/lib/audio/tanpura-manifest";

const ASSET_PREFIX = "/assets/tanpura/";

type Tracked = { src: AudioScheduledSourceNode; gain: GainNode };

/** Pa a perfect fifth above Sa — matches pa–SA–SA–sa preview colour. */
const PA_RATIO = 1.5;

/** Warm low-pass on the whole tanpura bus (reduces “clinical” edge of pure tones / bright loops). */
const TONE_LP_HZ = 2400;
const TONE_LP_Q = 0.62;

/**
 * Prefer royalty-free WAV loops (crossfaded). If a file is missing, uses a
 * short Sa+Pa sine **preview** on button tap and a simple Sa+Pa **drone** for hold-loop
 * so the UI is never silent during development.
 */
export class TanpuraService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private toneLowpass: BiquadFilterNode | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private tracked: Tracked[] = [];
  private playingKey: string | null = null;
  private refillTimer: ReturnType<typeof setTimeout> | null = null;
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private chainEndAudioTime = 0;
  private readonly crossfadeSec: number;

  constructor(crossfadeSec = 0.22) {
    this.crossfadeSec = crossfadeSec;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 0.52;

      this.toneLowpass = ctx.createBiquadFilter();
      this.toneLowpass.type = "lowpass";
      this.toneLowpass.frequency.value = TONE_LP_HZ;
      this.toneLowpass.Q.value = TONE_LP_Q;

      this.masterGain.connect(this.toneLowpass);
      this.toneLowpass.connect(ctx.destination);
    }
    return this.ctx;
  }

  async preload(): Promise<void> {
    const ctx = this.ensureContext();
    for (const entry of TANPURA_SAMPLE_MANIFEST) {
      if (this.buffers.has(entry.key)) continue;
      const url = `${ASSET_PREFIX}${entry.file}`;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const raw = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(raw.slice(0));
        this.buffers.set(entry.key, buf);
      } catch {
        /* missing file or decode error */
      }
    }
  }

  setVolume(level: number): void {
    const g = this.masterGain;
    if (!g || !this.ctx) return;
    const v = Math.max(0, Math.min(1, level));
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(v, t + 0.05);
  }

  stop(): void {
    this.playingKey = null;
    if (this.refillTimer != null) {
      clearTimeout(this.refillTimer);
      this.refillTimer = null;
    }
    if (this.previewTimer != null) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    for (const { src, gain } of this.tracked) {
      try {
        src.stop();
      } catch {
        /* */
      }
      try {
        gain.disconnect();
      } catch {
        /* */
      }
    }
    this.tracked = [];
  }

  /** Short audition of a preset (does not start crossfade loop refill). */
  playPreview(shruti: string, durationMs = 2000): void {
    this.stop();
    const buf = this.buffers.get(shruti);
    const ctx = this.ensureContext();
    void ctx.resume();
    const master = this.masterGain!;

    if (buf) {
      const g = ctx.createGain();
      g.connect(master);
      const t0 = ctx.currentTime;
      const playDur = Math.min(buf.duration, durationMs / 1000);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.48, t0 + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + playDur);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(g);
      src.addEventListener("ended", () => {
        this.tracked = this.tracked.filter((x) => x.src !== src);
      });
      src.start(t0, 0, playDur);
      this.tracked.push({ src, gain: g });
      this.previewTimer = setTimeout(() => this.stop(), durationMs + 80);
      return;
    }

    const saHz = nominalHzForTanpuraKey(shruti);
    this.playSyntheticShrutiPreview(master, saHz, durationMs / 1000);
  }

  /** Sa + Pa sine chime when WAV is not installed yet. */
  private playSyntheticShrutiPreview(master: GainNode, saHz: number, durationSec: number): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const end = t0 + durationSec;

    const addVoice = (freq: number, peak: number) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0);
      const g = ctx.createGain();
      g.connect(master);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.06);
      g.gain.setValueAtTime(peak, end - 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(g);
      osc.addEventListener("ended", () => {
        this.tracked = this.tracked.filter((x) => x.src !== osc);
      });
      osc.start(t0);
      osc.stop(end + 0.02);
      this.tracked.push({ src: osc, gain: g });
    };

    addVoice(saHz, 0.065);
    addVoice(saHz * PA_RATIO, 0.042);

    this.previewTimer = setTimeout(() => this.stop(), durationSec * 1000 + 150);
  }

  /** Simple sustained Sa+Pa when no WAV loop is available. */
  private startSyntheticDrone(shruti: string, saHz: number): void {
    const ctx = this.ensureContext();
    void ctx.resume();
    const master = this.masterGain!;
    this.playingKey = shruti;

    const addOsc = (freq: number, level: number) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g);
      g.connect(master);
      osc.start();
      this.tracked.push({ src: osc, gain: g });
    };

    addOsc(saHz, 0.055);
    addOsc(saHz * PA_RATIO, 0.034);
  }

  /** Seamless-ish loop using overlapping segment crossfades. */
  play(shruti: string): void {
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    this.stop();
    const buf = this.buffers.get(shruti);
    if (!buf) {
      const saHz = nominalHzForTanpuraKey(shruti);
      this.startSyntheticDrone(shruti, saHz);
      return;
    }
    const D = buf.duration;
    const X = Math.min(this.crossfadeSec, D * 0.12);
    if (D < X * 2.5) return;

    this.playingKey = shruti;
    const ctx = this.ensureContext();
    void ctx.resume();
    const now = ctx.currentTime + 0.02;
    this.chainEndAudioTime = now;
    this.scheduleSegments(buf, D, X, now, 28);
    this.armRefill(buf, D, X);
  }

  private armRefill(buf: AudioBuffer, D: number, X: number) {
    if (this.refillTimer != null) clearTimeout(this.refillTimer);
    const ctx = this.ctx!;
    const lead = 2.5;
    const ms = Math.max(350, (this.chainEndAudioTime - ctx.currentTime - lead) * 1000);
    this.refillTimer = setTimeout(() => {
      if (this.playingKey == null) return;
      const t = this.chainEndAudioTime;
      this.scheduleSegments(buf, D, X, t, 18);
      this.armRefill(buf, D, X);
    }, ms);
  }

  private scheduleSegments(
    buf: AudioBuffer,
    D: number,
    X: number,
    firstStart: number,
    count: number,
  ) {
    const ctx = this.ctx!;
    const master = this.masterGain!;
    let startT = firstStart;
    for (let i = 0; i < count; i++) {
      const g = ctx.createGain();
      g.connect(master);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(g);

      const segPeak = 0.82;
      if (i === 0) {
        g.gain.setValueAtTime(segPeak, startT);
      } else {
        g.gain.setValueAtTime(0, startT);
        g.gain.linearRampToValueAtTime(segPeak, startT + X);
      }
      g.gain.setValueAtTime(segPeak, startT + D - X);
      g.gain.linearRampToValueAtTime(0, startT + D);

      src.addEventListener("ended", () => {
        this.tracked = this.tracked.filter((x) => x.src !== src);
      });
      src.start(startT, 0, D);
      this.tracked.push({ src, gain: g });
      startT += D - X;
    }
    this.chainEndAudioTime = startT;
  }

  dispose(): void {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
    this.toneLowpass = null;
    this.buffers.clear();
  }
}

let singleton: TanpuraService | null = null;

export function getTanpuraService(): TanpuraService {
  if (!singleton) singleton = new TanpuraService();
  return singleton;
}
