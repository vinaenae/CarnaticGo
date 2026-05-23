import type { RhythmAnalyzeParams, RhythmAnalyzeResponse } from "@/types/rhythm-analysis";

/**
 * Upload a short audio segment for librosa onset + beat-grid alignment.
 * Calls the Next.js proxy route (same origin); configure `RHYTHM_ANALYSIS_URL` on the server.
 */
export async function analyzeRhythmFromBlob(
  audio: Blob,
  params: RhythmAnalyzeParams,
): Promise<RhythmAnalyzeResponse> {
  const form = new FormData();
  form.append("file", audio, "segment.webm");
  form.append("bpm", String(params.bpm));
  form.append("tala", params.tala ?? "adi");

  const res = await fetch("/api/rhythm/analyze", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`rhythm_analyze_failed:${res.status}:${text}`);
  }

  return (await res.json()) as RhythmAnalyzeResponse;
}
