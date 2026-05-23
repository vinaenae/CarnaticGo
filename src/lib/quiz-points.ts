/** Points for one quiz question (must match `quiz_points_for_answer` in Supabase). */
export function quizPointsForAnswer(correct: boolean, priorCorrectStreak: number): number {
  if (correct) {
    return 1 + Math.max(0, priorCorrectStreak);
  }
  return -1;
}

/** Helium float label only — always +1 or −1 regardless of streak bonuses. */
export function quizPointsFloatDelta(correct: boolean): number {
  return correct ? 1 : -1;
}

export type QuizPointsPopState = { delta: number; id: number };

export function createQuizPointsPop(correct: boolean): QuizPointsPopState {
  return { delta: quizPointsFloatDelta(correct), id: Date.now() };
}

export const QUIZ_POINTS_HELP = [
  "+5 once per day for 15 min singing in Practice (sessions combine)",
  "+1 when you answer correctly in a quiz",
  "−1 when you answer incorrectly in a quiz",
  "Extra +1 for correct answer streak in a quiz",
] as const;
