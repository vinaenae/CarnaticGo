import type { ShrutiFftFrameResult } from "@/types/shruti-fft";

export async function analyzeShrutiFftFrame(
  samples: Float32Array,
  sampleRate: number,
  options: { ragaId?: string | null; saHz?: number } = {},
): Promise<ShrutiFftFrameResult> {
  const res = await fetch("/api/shruti-fft/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      samples: Array.from(samples),
      sample_rate: sampleRate,
      raga_id: options.ragaId ?? null,
      sa_hz: options.saHz ?? 240,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `shruti_fft_failed:${res.status}`);
  }
  const raw = (await res.json()) as Record<string, unknown>;
  return {
    voiced: Boolean(raw.voiced),
    confidence: typeof raw.confidence === "number" ? raw.confidence : undefined,
    hz: typeof raw.hz === "number" ? raw.hz : undefined,
    hzFolded: typeof raw.hzFolded === "number" ? raw.hzFolded : undefined,
    token: typeof raw.token === "string" ? raw.token : raw.token === null ? null : undefined,
    chartHz: typeof raw.chartHz === "number" ? raw.chartHz : undefined,
    centsOff: typeof raw.centsOff === "number" ? raw.centsOff : undefined,
    inRaga: typeof raw.inRaga === "boolean" ? raw.inRaga : undefined,
    ragaId: typeof raw.ragaId === "string" ? raw.ragaId : null,
  };
}
