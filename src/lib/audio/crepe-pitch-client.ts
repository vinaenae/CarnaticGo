/**
 * CREPE pitch service client (sing-with-teacher charts).
 */

import { float32ToWavBlob, MODEL_SAMPLE_RATE, resampleLinear } from "@/lib/audio/recordingToWav";
import { enqueueCrepePitchContour } from "@/lib/audio/crepe-batch-queue";
import {
  ANALYSIS_SAMPLE_RATE,
  buildPitchContourForChart,
  compareTeacherStudentPitchContours,
  normalizeRateForContour,
  type RawPitchContour,
  type TeacherStudentPitchAnalysis,
} from "@/lib/audio/pitchContour";

export {
  contourFromCrepeResponse,
  CrepePitchError,
  type CrepePitchResponse,
} from "@/lib/audio/crepe-pitch-shared";
import {
  contourFromCrepeResponse,
  CrepePitchError,
  type CrepePitchResponse,
} from "@/lib/audio/crepe-pitch-shared";

/** Upload mono WAV to CREPE service and return a pitch contour. */
export async function fetchCrepePitchContour(
  samples: Float32Array,
  sampleRate: number,
): Promise<RawPitchContour> {
  const ws = normalizeRateForContour(samples, sampleRate);
  // CREPE is trained at 16 kHz; smaller WAV avoids Next.js ~1 MB proxy limits.
  const forCrepe = resampleLinear(ws, ANALYSIS_SAMPLE_RATE, MODEL_SAMPLE_RATE);
  const wav = float32ToWavBlob(forCrepe, MODEL_SAMPLE_RATE);
  const form = new FormData();
  form.append("file", wav, "clip.wav");

  const direct = process.env.NEXT_PUBLIC_CREPE_PITCH_URL?.replace(/\/$/, "");
  const analyzeUrl = direct ? `${direct}/analyze` : "/api/crepe-pitch/analyze";

  const res = await fetch(analyzeUrl, {
    method: "POST",
    body: form,
  });

  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text) as { error?: string; detail?: string };
      detail = j.error ?? j.detail ?? text;
    } catch {
      /* raw text */
    }
    if (res.status === 413) {
      throw new CrepePitchError(
        "Audio upload too large for the server proxy. Add NEXT_PUBLIC_CREPE_PITCH_URL=http://127.0.0.1:8003 to .env.local and restart dev.",
        res.status,
      );
    }
    if (res.status === 503) {
      throw new CrepePitchError(
        "CREPE pitch service is not running. Use npm run dev (includes crepe-pitch) and set CREPE_PITCH_URL in .env.local.",
        res.status,
      );
    }
    throw new CrepePitchError(detail || `CREPE request failed (${res.status})`, res.status);
  }

  const data = JSON.parse(text) as CrepePitchResponse;
  if (data.engine !== "crepe") {
    console.warn("[sing-along] Unexpected pitch engine:", data.engine);
  }
  return contourFromCrepeResponse(data);
}

export type SingAlongPitchEngine = "crepe" | "ml5-crepe" | "yin";

/** Returns contour and which engine produced it. */
export async function buildPitchContourForSingAlongWithEngine(
  samples: Float32Array,
  sampleRate: number,
): Promise<{ contour: RawPitchContour; engine: SingAlongPitchEngine }> {
  try {
    const contour = await fetchCrepePitchContour(samples, sampleRate);
    return { contour, engine: "crepe" };
  } catch (e) {
    if (e instanceof CrepePitchError) {
      console.warn("[sing-along] CREPE unavailable, using YIN fallback:", e.message);
      return {
        contour: buildPitchContourForChart(samples, sampleRate),
        engine: "yin",
      };
    }
    throw e;
  }
}

export async function buildPitchContourForSingAlong(
  samples: Float32Array,
  sampleRate: number,
): Promise<RawPitchContour> {
  const { contour } = await buildPitchContourForSingAlongWithEngine(samples, sampleRate);
  return contour;
}

export async function compareTeacherStudentPitchCrepe(
  teacherSamples: Float32Array,
  teacherSr: number,
  studentSamples: Float32Array,
  studentSr: number,
): Promise<TeacherStudentPitchAnalysis> {
  const ts = normalizeRateForContour(teacherSamples, teacherSr);
  const ss = normalizeRateForContour(studentSamples, studentSr);
  const [rawT, rawS] = await Promise.all([
    enqueueCrepePitchContour("ref", ts, ANALYSIS_SAMPLE_RATE),
    enqueueCrepePitchContour("user", ss, ANALYSIS_SAMPLE_RATE),
  ]);
  return compareTeacherStudentPitchContours(
    rawT,
    rawS,
    ts.length / ANALYSIS_SAMPLE_RATE,
    ss.length / ANALYSIS_SAMPLE_RATE,
  );
}

export async function isCrepePitchAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/crepe-pitch/health", { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
