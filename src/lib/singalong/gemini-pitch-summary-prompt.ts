import { formatChartBlockForPrompt } from "@/lib/singalong/gemini-chart-payload";
import type { GeminiChartSample } from "@/lib/singalong/ai-pitch-summary-types";
import {
  GAMAKA_CLASSIFIER_EXAMPLE,
  GAMAKA_CLASSIFIER_RULES,
  PRIME_GAMAKA_VARIATION_EXAMPLE,
} from "@/lib/singalong/ai-pitch-summary-prompt-context";

export function buildGeminiPitchSummaryPrompt(input: {
  chart: GeminiChartSample[];
  durationSec: number;
  algorithmicHints?: string;
}): string {
  const chartBlock = formatChartBlockForPrompt(input.chart);
  const hints = input.algorithmicHints?.trim()
    ? `\nAlgorithmic gamaka classifier (pre-computed from the same chart — verify and cite timestamps from the samples below):\n${input.algorithmicHints}\n`
    : "";

  return `${GAMAKA_CLASSIFIER_RULES}

${GAMAKA_CLASSIFIER_EXAMPLE}

Chart layout (one plot, same reference time axis):
- UPPER band = YOUR SINGING — orange line (userShape 0.0–1.0, normalized contour, not Hz)
- LOWER band = REFERENCE (teacher) — blue line directly underneath (refShape 0.0–1.0, DTW-aligned to reference time)
- At each time_sec, compare refShape vs userShape — shapes should look parallel when the student matches well
- Empty cells = no voiced pitch at that sample

Recording duration (reference axis): about ${input.durationSec.toFixed(1)} seconds.

Your tasks:
1. Scan for the PRIME gamaka-variation pattern: refShape oscillates richly but userShape is flat/simple in the same window → [Gamaka/flat] with timestamps; tell the student to sing more gamaka, re-listen to the teacher, and re-sing that line while matching the blue contour.
2. Scan for windows where userShape diverges strongly from refShape in level (sustained gap or sharp spike) → report as significant deviation / critical pitch mistakes.
3. Cross-check algorithmic hints when provided; do not invent issues without support in the chart data.
4. Prefer the teacher-richer gamaka cases (reference moves more) over nitpicking minor wiggles.

Tone: Supportive, encouraging, technically precise. Use Carnatic terms (gamaka, kampita, spurita) where helpful.

Output: Return ONLY a JSON object (no markdown) with this exact shape:
{
  "summary": "2-4 sentences: overall pitch match + gamaka/ornamentation vs reference",
  "mistakes": [
    {
      "timestamp": "M:SS – M:SS (reference timeline)",
      "issue": "Start with [Gamaka/flat] or [Significant deviation]: …",
      "fix": "actionable practice tip"
    }
  ]
}

Limit mistakes to the 3–6 most important items (gamaka deficits and significant deviations).

If there is no noticeable difference between reference and student (contours track well, no meaningful gamaka gaps or pitch deviations): return mistakes: [] and summary exactly "You are on point!" — no other explanation.

Pitch samples (downsampled, reference time_sec):
${chartBlock}
${hints}`;
}
