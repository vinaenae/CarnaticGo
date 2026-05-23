import { ACCOMPANIMENT_ASSET_PREFIX, ACCOMPANIMENT_LOOPS } from "@/lib/audio/accompaniment-manifest";
import { computeRms } from "@/lib/audio/volume";
import { DEFAULT_TANPURA_KEY, TANPURA_SAMPLE_MANIFEST } from "@/lib/audio/tanpura-manifest";

export const MODEL_SAMPLE_RATE = 16000;
const TANPURA_ASSET_PREFIX = "/assets/tanpura/";
/** Gains tuned so vocal stays dominant (sam-carnatic clips have drone + light percussion). */
const DEFAULT_TANPURA_MIX_GAIN = 0.22;
const DEFAULT_MRIDANGAM_MIX_GAIN = 0.14;
const DEFAULT_TABLA_MIX_GAIN = 0.11;

export type AccompanimentMixReport = {
  tanpura: boolean;
  mridangam: boolean;
  tabla: boolean;
};

const accompanimentCache = new Map<string, Float32Array>();

export type RecordingDiagnostics = {
  durationSec: number;
  sampleRate: number;
  peak: number;
  rms: number;
  level: "too_soft" | "good" | "too_loud";
};

function mixToMono(buffer: AudioBuffer): Float32Array {
  const { length, numberOfChannels } = buffer;
  const out = new Float32Array(length);
  if (numberOfChannels === 1) {
    out.set(buffer.getChannelData(0));
    return out;
  }
  for (let c = 0; c < numberOfChannels; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) out[i] += ch[i]! / numberOfChannels;
  }
  return out;
}

export function mergeFloat32Chunks(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Linear resample to target rate (good enough for vocal classification). */
export function resampleLinear(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate || samples.length === 0) return samples;
  const outLen = Math.max(1, Math.round((samples.length * toRate) / fromRate));
  const out = new Float32Array(outLen);
  const ratio = fromRate / toRate;
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const t = src - i0;
    out[i] = samples[i0]! * (1 - t) + samples[i1]! * t;
  }
  return out;
}

export function computePeak(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]!));
  return peak;
}

export function analyzeSamples(samples: Float32Array, sampleRate: number): RecordingDiagnostics {
  const peak = computePeak(samples);
  const rms = computeRms(samples);
  return {
    durationSec: samples.length / sampleRate,
    sampleRate,
    peak,
    rms,
    level: volumeLevelFromRms(rms),
  };
}

function volumeLevelFromRms(rms: number): RecordingDiagnostics["level"] {
  if (rms < 0.008) return "too_soft";
  if (rms > 0.35) return "too_loud";
  return "good";
}

/** Gentle peak normalize so quiet mic recordings still register in the model. */
export function normalizePeak(samples: Float32Array, targetPeak = 0.85): Float32Array {
  const peak = computePeak(samples);
  if (peak < 1e-5) return samples;
  const gain = Math.min(targetPeak / peak, 8);
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i]! * gain;
  return out;
}

/** Encode mono 16-bit PCM WAV. */
export function float32ToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const n = samples.length;
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, n * 2, true);

  let offset = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/** Trigger a browser download for a WAV (or other) blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function loadAssetLoop16k(assetPrefix: string, filename: string): Promise<Float32Array | null> {
  const cacheKey = `${assetPrefix}${filename}`;
  const cached = accompanimentCache.get(cacheKey);
  if (cached) return cached;
  try {
    const res = await fetch(`${assetPrefix}${filename}`);
    if (!res.ok) return null;
    const raw = await res.arrayBuffer();
    const ctx = new AudioContext();
    try {
      const decoded = await ctx.decodeAudioData(raw.slice(0));
      const mono = mixToMono(decoded);
      const loop = resampleLinear(mono, decoded.sampleRate, MODEL_SAMPLE_RATE);
      accompanimentCache.set(cacheKey, loop);
      return loop;
    } finally {
      await ctx.close();
    }
  } catch {
    return null;
  }
}

async function loadTanpuraLoop16k(tanpuraKey: string): Promise<Float32Array | null> {
  const entry = TANPURA_SAMPLE_MANIFEST.find((e) => e.key === tanpuraKey);
  if (!entry) return null;
  return loadAssetLoop16k(TANPURA_ASSET_PREFIX, entry.file);
}

function loopToLength(loop: Float32Array, length: number): Float32Array {
  if (loop.length === 0) return new Float32Array(length);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = loop[i % loop.length]!;
  return out;
}

function mixVocalWithLayers(
  vocal: Float32Array,
  layers: { loop: Float32Array; gain: number }[],
): Float32Array {
  const out = new Float32Array(vocal.length);
  for (let i = 0; i < vocal.length; i++) {
    let sum = vocal[i]!;
    for (const { loop, gain } of layers) {
      sum += loop[i]! * gain;
    }
    out[i] = sum;
  }
  return normalizePeak(out, 0.85);
}

export type ModelWavOptions = {
  /**
   * Mix tanpura + light mridangam/tabla (sam-carnatic-style). Default true for quiz recording.
   * Set false for raw voice-only clips.
   */
  mixDatasetAccompaniment?: boolean;
  mixTanpura?: boolean;
  mixMridangam?: boolean;
  mixTabla?: boolean;
  tanpuraKey?: string;
  tanpuraGain?: number;
  mridangamGain?: number;
  tablaGain?: number;
};

/** Build model-ready WAV from raw mic samples (16 kHz mono). */
export async function samplesToModelWav(
  samples: Float32Array,
  captureSampleRate: number,
  options: ModelWavOptions = {},
): Promise<{
  blob: Blob;
  diagnostics: RecordingDiagnostics;
  tanpuraMixed: boolean;
  accompaniment: AccompanimentMixReport;
}> {
  let resampled = resampleLinear(samples, captureSampleRate, MODEL_SAMPLE_RATE);
  resampled = normalizePeak(resampled, 0.85);

  const datasetStyle = options.mixDatasetAccompaniment !== false;
  const useTanpura = options.mixTanpura ?? datasetStyle;
  const useMridangam = options.mixMridangam ?? datasetStyle;
  const useTabla = options.mixTabla ?? datasetStyle;

  const report: AccompanimentMixReport = {
    tanpura: false,
    mridangam: false,
    tabla: false,
  };
  const layers: { loop: Float32Array; gain: number }[] = [];

  if (useTanpura) {
    const loop = await loadTanpuraLoop16k(options.tanpuraKey ?? DEFAULT_TANPURA_KEY);
    if (loop) {
      layers.push({ loop: loopToLength(loop, resampled.length), gain: options.tanpuraGain ?? DEFAULT_TANPURA_MIX_GAIN });
      report.tanpura = true;
    }
  }

  const mridangamFile = ACCOMPANIMENT_LOOPS.find((e) => e.id === "mridangam_adi")!.file;
  const tablaFile = ACCOMPANIMENT_LOOPS.find((e) => e.id === "tabla_tintal")!.file;

  if (useMridangam) {
    const loop = await loadAssetLoop16k(ACCOMPANIMENT_ASSET_PREFIX, mridangamFile);
    if (loop) {
      layers.push({
        loop: loopToLength(loop, resampled.length),
        gain: options.mridangamGain ?? DEFAULT_MRIDANGAM_MIX_GAIN,
      });
      report.mridangam = true;
    }
  }

  if (useTabla) {
    const loop = await loadAssetLoop16k(ACCOMPANIMENT_ASSET_PREFIX, tablaFile);
    if (loop) {
      layers.push({
        loop: loopToLength(loop, resampled.length),
        gain: options.tablaGain ?? DEFAULT_TABLA_MIX_GAIN,
      });
      report.tabla = true;
    }
  }

  if (layers.length > 0) {
    resampled = mixVocalWithLayers(resampled, layers);
  }

  const diagnostics = analyzeSamples(resampled, MODEL_SAMPLE_RATE);
  return {
    blob: float32ToWavBlob(resampled, MODEL_SAMPLE_RATE),
    diagnostics,
    tanpuraMixed: report.tanpura,
    accompaniment: report,
  };
}

/** Fallback: decode MediaRecorder webm/opus (lossy — prefer direct PCM capture). */
export async function recordingBlobToWav(blob: Blob, targetSr = MODEL_SAMPLE_RATE): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const mono = mixToMono(decoded);
    const { blob: wav } = await samplesToModelWav(mono, decoded.sampleRate);
    if (targetSr !== MODEL_SAMPLE_RATE) {
      /* samplesToModelWav always outputs MODEL_SAMPLE_RATE */
    }
    return wav;
  } finally {
    await ctx.close();
  }
}

export async function analyzeWavBlob(blob: Blob): Promise<RecordingDiagnostics> {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const mono = mixToMono(decoded);
    return analyzeSamples(mono, decoded.sampleRate);
  } finally {
    await ctx.close();
  }
}
