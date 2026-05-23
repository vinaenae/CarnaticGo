/**
 * Coalesce near-simultaneous CREPE requests (e.g. ref + user uploads) into one
 * /analyze/batch call. While a batch runs, additional jobs queue for the next batch.
 */

import {
  float32ToWavBlob,
  MODEL_SAMPLE_RATE,
  resampleLinear,
} from "@/lib/audio/recordingToWav";
import {
  ANALYSIS_SAMPLE_RATE,
  buildPitchContourForChart,
  normalizeRateForContour,
  type RawPitchContour,
} from "@/lib/audio/pitchContour";
import {
  contourFromCrepeResponse,
  CrepePitchError,
  type CrepePitchResponse,
} from "@/lib/audio/crepe-pitch-shared";

export type CrepeBatchClipKey = "ref" | "user";

const BATCH_COALESCE_MS = 80;

type PendingJob = {
  samples: Float32Array;
  sampleRate: number;
  resolve: (contour: RawPitchContour) => void;
  reject: (err: Error) => void;
};

type CrepeBatchResponse = {
  engine: string;
  results: Record<string, CrepePitchResponse>;
};

function crepeAnalyzeUrls() {
  const direct = process.env.NEXT_PUBLIC_CREPE_PITCH_URL?.replace(/\/$/, "");
  return direct ? `${direct}/analyze/batch` : "/api/crepe-pitch/analyze-batch";
}

function samplesToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const ws = normalizeRateForContour(samples, sampleRate);
  const forCrepe = resampleLinear(ws, ANALYSIS_SAMPLE_RATE, MODEL_SAMPLE_RATE);
  return float32ToWavBlob(forCrepe, MODEL_SAMPLE_RATE);
}

async function fetchCrepeBatch(
  jobs: { key: CrepeBatchClipKey; samples: Float32Array; sampleRate: number }[],
): Promise<Record<CrepeBatchClipKey, RawPitchContour>> {
  const form = new FormData();
  for (const job of jobs) {
    form.append(job.key, samplesToWavBlob(job.samples, job.sampleRate), `${job.key}.wav`);
  }

  const res = await fetch(crepeAnalyzeUrls(), { method: "POST", body: form });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text) as { error?: string; detail?: string };
      detail = j.error ?? j.detail ?? text;
    } catch {
      /* raw */
    }
    if (res.status === 413) {
      throw new CrepePitchError(
        "Audio upload too large for the server proxy. Add NEXT_PUBLIC_CREPE_PITCH_URL=http://127.0.0.1:8003 to .env.local and restart dev.",
        res.status,
      );
    }
    if (res.status === 503) {
      throw new CrepePitchError(
        "CREPE pitch service is not running. Use npm run dev (includes crepe-pitch).",
        res.status,
      );
    }
    throw new CrepePitchError(detail || `CREPE batch failed (${res.status})`, res.status);
  }

  const data = JSON.parse(text) as CrepeBatchResponse;
  const out: Partial<Record<CrepeBatchClipKey, RawPitchContour>> = {};
  for (const job of jobs) {
    const item = data.results?.[job.key];
    if (!item) {
      throw new CrepePitchError(`CREPE batch missing result for "${job.key}"`);
    }
    out[job.key] = contourFromCrepeResponse(item);
  }
  return out as Record<CrepeBatchClipKey, RawPitchContour>;
}

function yinFallback(samples: Float32Array, sampleRate: number): RawPitchContour {
  return buildPitchContourForChart(samples, sampleRate);
}

class CrepeBatchQueue {
  private pending = new Map<CrepeBatchClipKey, PendingJob>();
  private coalesceTimer: ReturnType<typeof setTimeout> | null = null;
  private flushPromise: Promise<void> | null = null;

  enqueue(
    key: CrepeBatchClipKey,
    samples: Float32Array,
    sampleRate: number,
  ): Promise<RawPitchContour> {
    const prior = this.pending.get(key);
    if (prior) {
      prior.reject(new Error("Superseded by a newer upload on this track."));
    }

    return new Promise<RawPitchContour>((resolve, reject) => {
      this.pending.set(key, { samples, sampleRate, resolve, reject });
      this.scheduleFlush();
    });
  }

  private scheduleFlush() {
    if (this.coalesceTimer != null) clearTimeout(this.coalesceTimer);
    this.coalesceTimer = setTimeout(() => {
      this.coalesceTimer = null;
      void this.runFlush();
    }, BATCH_COALESCE_MS);
  }

  private async runFlush() {
    if (this.flushPromise) {
      await this.flushPromise;
      if (this.pending.size > 0) this.scheduleFlush();
      return;
    }

    if (this.pending.size === 0) return;

    const jobs = [...this.pending.entries()].map(([key, job]) => ({
      key,
      samples: job.samples,
      sampleRate: job.sampleRate,
      job,
    }));
    this.pending.clear();

    this.flushPromise = (async () => {
      try {
        const contours = await fetchCrepeBatch(
          jobs.map((j) => ({ key: j.key, samples: j.samples, sampleRate: j.sampleRate })),
        );
        for (const j of jobs) {
          j.job.resolve(contours[j.key]!);
        }
      } catch (batchErr) {
        for (const j of jobs) {
          try {
            if (batchErr instanceof CrepePitchError) {
              console.warn(
                `[sing-along] CREPE batch unavailable (${j.key}), YIN fallback:`,
                batchErr.message,
              );
            }
            j.job.resolve(yinFallback(j.samples, j.sampleRate));
          } catch (yinErr) {
            j.job.reject(
              yinErr instanceof Error ? yinErr : new Error(String(yinErr)),
            );
          }
        }
      }
    })();

    try {
      await this.flushPromise;
    } finally {
      this.flushPromise = null;
      if (this.pending.size > 0) this.scheduleFlush();
    }
  }
}

const queue = new CrepeBatchQueue();

/** Queue CREPE analysis; batches ref+user when uploaded close together. */
export function enqueueCrepePitchContour(
  key: CrepeBatchClipKey,
  samples: Float32Array,
  sampleRate: number,
): Promise<RawPitchContour> {
  return queue.enqueue(key, samples, sampleRate);
}
