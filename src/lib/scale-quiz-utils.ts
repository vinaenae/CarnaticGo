import {
  SCALE_QUIZ_RAGAS,
  scalePairKey,
  type ScaleQuizRaga,
} from "@/lib/scale-quiz-ragas";

export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const OPTION_COUNT = 4;

function distractorCount(poolSize: number): number {
  return Math.min(OPTION_COUNT - 1, Math.max(0, poolSize - 1));
}

/** Multiple-choice raga names for a shown scale. */
export function pickRagaNameOptions(
  answer: ScaleQuizRaga,
  pool: readonly ScaleQuizRaga[] = SCALE_QUIZ_RAGAS,
): ScaleQuizRaga[] {
  const n = distractorCount(pool.length);
  const others = shuffle(pool.filter((r) => r.id !== answer.id));
  return shuffle([answer, ...others.slice(0, n)]);
}

/** Multiple-choice scale pairs for a shown raga name. */
export function pickScalePairOptions(
  answer: ScaleQuizRaga,
  pool: readonly ScaleQuizRaga[] = SCALE_QUIZ_RAGAS,
): ScaleQuizRaga[] {
  const n = distractorCount(pool.length);
  const answerKey = scalePairKey(answer);
  const others = shuffle(
    pool.filter((r) => r.id !== answer.id && scalePairKey(r) !== answerKey),
  );
  return shuffle([answer, ...others.slice(0, n)]);
}
