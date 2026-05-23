export type CrepeLiveFrameResult = {
  voiced: boolean;
  hz?: number;
  confidence?: number;
  engine?: string;
};

const MAX_LIVE_SAMPLES = 2048;

/** Trim payload for live frames (less JSON + faster CREPE). */
export function downsampleForLiveCrepe(buffer: Float32Array): Float32Array {
  if (buffer.length <= MAX_LIVE_SAMPLES) return buffer;
  const out = new Float32Array(MAX_LIVE_SAMPLES);
  const step = buffer.length / MAX_LIVE_SAMPLES;
  for (let i = 0; i < MAX_LIVE_SAMPLES; i++) {
    out[i] = buffer[Math.floor(i * step)] ?? 0;
  }
  return out;
}

export async function analyzeCrepePitchFrame(
  samples: Float32Array,
  sampleRate: number,
  signal?: AbortSignal,
): Promise<CrepeLiveFrameResult> {
  const compact = downsampleForLiveCrepe(samples);
  const res = await fetch("/api/crepe-pitch/analyze-frame", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      samples: Array.from(compact),
      sample_rate: sampleRate,
    }),
    signal,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `crepe_frame_failed:${res.status}`);
  }

  const raw = JSON.parse(text) as Record<string, unknown>;
  return {
    voiced: Boolean(raw.voiced),
    hz: typeof raw.hz === "number" ? raw.hz : undefined,
    confidence: typeof raw.confidence === "number" ? raw.confidence : undefined,
    engine: typeof raw.engine === "string" ? raw.engine : undefined,
  };
}

export async function isCrepePitchLiveAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/crepe-pitch/health", { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
