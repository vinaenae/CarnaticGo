/**
 * Unique swara tokens + Hz per rāga (from scale-quiz pool / overrides).
 * Used by the FFT swara detector UI and `scripts/generate-raga-swara-notes.mjs`.
 */

import { canonicalizeSwaraToken, hzForSwaraToken, parseSwaraTokens } from "@/lib/carnatic-scale-synth";
import { SCALE_QUIZ_RAGAS } from "@/lib/scale-quiz-ragas";

export type RagaSwaraNote = {
  token: string;
  hz: number;
};

export type RagaSwaraProfile = {
  id: string;
  name: string;
  swaras: RagaSwaraNote[];
};

function uniqueSwarasFromScaleLines(arohanam: string, avarohanam: string): RagaSwaraNote[] {
  const tokens = [...parseSwaraTokens(arohanam), ...parseSwaraTokens(avarohanam)];
  const seen = new Set<string>();
  const out: RagaSwaraNote[] = [];
  for (const raw of tokens) {
    const token = canonicalizeSwaraToken(raw) ?? raw;
    if (seen.has(token)) continue;
    const hz = hzForSwaraToken(token);
    if (hz == null) continue;
    seen.add(token);
    out.push({ token, hz });
  }
  out.sort((a, b) => a.hz - b.hz);
  return out;
}

export const RAGA_SWARA_PROFILES: readonly RagaSwaraProfile[] = SCALE_QUIZ_RAGAS.map((r) => ({
  id: r.id,
  name: r.name,
  swaras: uniqueSwarasFromScaleLines(r.arohanam, r.avarohanam),
})).filter((p) => p.swaras.length > 0);

export function ragaSwaraProfileById(id: string): RagaSwaraProfile | undefined {
  return RAGA_SWARA_PROFILES.find((p) => p.id === id);
}

/** All chart tokens (for “any swara” mode without a rāga filter). */
export const CHART_SWARA_NOTES: readonly RagaSwaraNote[] = (() => {
  const seen = new Set<string>();
  const out: RagaSwaraNote[] = [];
  for (const p of RAGA_SWARA_PROFILES) {
    for (const s of p.swaras) {
      if (seen.has(s.token)) continue;
      seen.add(s.token);
      out.push(s);
    }
  }
  out.sort((a, b) => a.hz - b.hz);
  return out;
})();
