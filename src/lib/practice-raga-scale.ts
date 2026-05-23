import { parseSwaraTokens } from "@/lib/carnatic-scale-synth";
import {
  canonicalWarmupSwaraToken,
  hzForSwaraAtSa,
  WARMUP_SWARA_ORDER,
} from "@/lib/audio/swara-ratio-chart";
import { SCALE_QUIZ_RAGAS, type ScaleQuizRaga } from "@/lib/scale-quiz-ragas";

export type PracticeSwaraStep = {
  token: string;
  hz: number;
};

export type PracticeRagaTargets = {
  raga: ScaleQuizRaga;
  saHz: number;
  arohanamSteps: PracticeSwaraStep[];
  avarohanamSteps: PracticeSwaraStep[];
  /** Unique swaras for pitch matching (order: arohanam then new from avarohanam). */
  meterTargets: PracticeSwaraStep[];
};

export function practiceRagaById(id: string): ScaleQuizRaga | undefined {
  return SCALE_QUIZ_RAGAS.find((r) => r.id === id);
}

function stepsFromScaleLine(line: string, saHz: number): PracticeSwaraStep[] {
  const out: PracticeSwaraStep[] = [];
  for (const token of parseSwaraTokens(line)) {
    const hz = hzForSwaraAtSa(token, saHz);
    if (hz != null) out.push({ token, hz });
  }
  return out;
}

function uniqueMeterTargets(
  arohanamSteps: PracticeSwaraStep[],
  avarohanamSteps: PracticeSwaraStep[],
  saHz: number,
): PracticeSwaraStep[] {
  const seen = new Set<string>();
  const out: PracticeSwaraStep[] = [];
  for (const s of [...arohanamSteps, ...avarohanamSteps]) {
    const token = canonicalWarmupSwaraToken(s.token);
    if (seen.has(token)) continue;
    seen.add(token);
    const hz = hzForSwaraAtSa(token, saHz) ?? s.hz;
    out.push({ token, hz });
  }
  return out;
}

/** Twelve swarasthanas + Ṡ at `saHz` (warmup chart; omits duplicate-frequency variants). */
export function buildAllRatioSwaraSteps(saHz: number): PracticeSwaraStep[] {
  const out: PracticeSwaraStep[] = [];
  for (const token of WARMUP_SWARA_ORDER) {
    const hz = hzForSwaraAtSa(token, saHz);
    if (hz != null) out.push({ token, hz });
  }
  return out;
}

export function buildPracticeRagaTargets(raga: ScaleQuizRaga, saHz: number): PracticeRagaTargets {
  const arohanamSteps = stepsFromScaleLine(raga.arohanam, saHz);
  const avarohanamSteps = stepsFromScaleLine(raga.avarohanam, saHz);
  return {
    raga,
    saHz,
    arohanamSteps,
    avarohanamSteps,
    meterTargets: uniqueMeterTargets(arohanamSteps, avarohanamSteps, saHz),
  };
}

/** Signed cents from detected Hz to target, choosing the best octave match (±2 octaves). */
export function centsToPracticeSwaraTarget(detectedHz: number, targetHz: number): number {
  if (!(detectedHz > 0) || !(targetHz > 0)) return 0;
  let bestCents = 1200 * Math.log2(detectedHz / targetHz);
  let bestAbs = Math.abs(bestCents);
  for (let oct = -2; oct <= 2; oct++) {
    if (oct === 0) continue;
    const shifted = targetHz * 2 ** oct;
    const cents = 1200 * Math.log2(detectedHz / shifted);
    const ab = Math.abs(cents);
    if (ab < bestAbs) {
      bestAbs = ab;
      bestCents = cents;
    }
  }
  return bestCents;
}

export function nearestPracticeSwara(
  hz: number,
  targets: readonly PracticeSwaraStep[],
): { index: number; cents: number; target: PracticeSwaraStep } {
  let best = 0;
  let bestAbs = Infinity;
  let bestCents = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]!;
    const cents = centsToPracticeSwaraTarget(hz, t.hz);
    const ab = Math.abs(cents);
    if (ab < bestAbs) {
      bestAbs = ab;
      best = i;
      bestCents = cents;
    }
  }

  return { index: best, cents: bestCents, target: targets[best]! };
}
