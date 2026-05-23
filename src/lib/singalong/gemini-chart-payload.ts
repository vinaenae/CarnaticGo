import type { MergedPitchChartRow } from "@/lib/audio/pitchContour";
import type { GeminiChartSample } from "@/lib/singalong/ai-pitch-summary-types";
import { withStackedPitchShapes } from "@/lib/singalong/pitch-shape-normalize";

const DEFAULT_MAX_POINTS = 80;

function roundT(t: number): number {
  return Math.round(t * 10) / 10;
}

/** Downsample merged chart for Gemini — stacked panels, normalized pitch shape 0–1 per track. */
export function downsampleChartForGemini(
  rows: MergedPitchChartRow[],
  maxPoints = DEFAULT_MAX_POINTS,
): GeminiChartSample[] {
  if (rows.length === 0) return [];

  const shaped = withStackedPitchShapes(rows);
  const pick = (list: typeof shaped) => {
    if (list.length <= maxPoints) return list;
    const step = list.length / maxPoints;
    const out: typeof shaped = [];
    for (let i = 0; i < maxPoints; i++) {
      out.push(list[Math.min(list.length - 1, Math.floor(i * step))]!);
    }
    return out;
  };

  return pick(shaped).map((r) => ({
    tSec: roundT(r.t),
    refShape: r.refShape,
    userShape: r.userShape,
    refHz: r.refHz,
    userHz: r.userHz,
  }));
}

/** Compact CSV for the model — refShape (teacher) and userShape (student) per time_sec. */
export function formatChartBlockForPrompt(samples: GeminiChartSample[]): string {
  const refLines = ["reference_panel_time_sec,shape_0_to_1"];
  const userLines = ["user_panel_time_sec,shape_0_to_1"];
  for (const s of samples) {
    refLines.push(`${s.tSec},${s.refShape ?? ""}`);
    userLines.push(`${s.tSec},${s.userShape ?? ""}`);
  }
  return `${refLines.join("\n")}\n\n${userLines.join("\n")}`;
}
