import type { TonicDetectResponse } from "@/types/tonic-detector";

/**
 * Upload audio for shruti (tonic) detection via Next.js proxy.
 * Model: KritiSamhita-trained CNN (F#, G, G#, A).
 */
export async function detectTonicFromBlob(audio: Blob): Promise<TonicDetectResponse> {
  const form = new FormData();
  form.append("file", audio, "clip.wav");

  const res = await fetch("/api/tonic/detect", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const j = JSON.parse(text) as { error?: string; detail?: string };
      detail = j.error ?? j.detail ?? text;
    } catch {
      /* raw text */
    }
    if (res.status === 503 && detail.toLowerCase().includes("tonic")) {
      throw new Error(detail);
    }
    throw new Error(detail || `tonic_detect_failed:${res.status}`);
  }

  return (await res.json()) as TonicDetectResponse;
}
