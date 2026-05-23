/**
 * Decode an audio file Blob (wav/mp3/ogg…) to mono PCM for offline analysis.
 * Use {@link boostSamplesForPitchAnalysis} on decoded PCM for YIN/DTW only — not for `<audio>` playback.
 */

import { computePeak } from "@/lib/audio/recordingToWav";

function mixAudioBufferToMono(buffer: AudioBuffer): Float32Array {
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

export type DecodedMonoPcm = {
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
};

export async function decodeAudioBlob(blob: Blob): Promise<DecodedMonoPcm> {
  const raw = await blob.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(raw.slice(0));
    const samples = mixAudioBufferToMono(decoded);
    return {
      samples,
      sampleRate: decoded.sampleRate,
      durationSec: decoded.duration,
    };
  } finally {
    await ctx.close();
  }
}

/**
 * Louder copy for pitch tracking only (quiet uploads / phone recordings).
 * Playback should still use the original blob URL — do not pass this to `<audio>`.
 */
export function boostSamplesForPitchAnalysis(
  samples: Float32Array,
  targetPeak = 0.92,
  maxGain = 14,
): Float32Array {
  const peak = computePeak(samples);
  if (peak < 1e-5) return samples;
  const gain = Math.min(targetPeak / peak, maxGain);
  if (gain <= 1.02) return samples;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i]! * gain;
    out[i] = Math.max(-1, Math.min(1, v));
  }
  return out;
}

export function decodeAudioBlobForPitchAnalysis(blob: Blob): Promise<DecodedMonoPcm> {
  return decodeAudioBlob(blob).then((dec) => ({
    ...dec,
    samples: boostSamplesForPitchAnalysis(dec.samples),
  }));
}
