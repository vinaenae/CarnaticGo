import type { TheoryQuizQuestion } from "@/lib/theory-quiz-data";

export type ShuffledTheoryQuestion = {
  question: TheoryQuizQuestion;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
};

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Return question with options shuffled so correct answer moves. */
export function shuffleQuestionOptions(q: TheoryQuizQuestion): ShuffledTheoryQuestion {
  const indexed = q.options.map((text, index) => ({ text, index }));
  const shuffled = shuffle(indexed);
  const options = shuffled.map((x) => x.text) as [string, string, string, string];
  const correctIndex = shuffled.findIndex((x) => x.index === q.correctIndex) as 0 | 1 | 2 | 3;
  return { question: q, options, correctIndex };
}

export function pickRandomTheoryQuestion(
  pool: TheoryQuizQuestion[],
  excludeId?: string,
): TheoryQuizQuestion | null {
  if (pool.length === 0) return null;
  const candidates =
    excludeId && pool.length > 1 ? pool.filter((q) => q.id !== excludeId) : pool;
  const list = candidates.length > 0 ? candidates : pool;
  return list[Math.floor(Math.random() * list.length)]!;
}
