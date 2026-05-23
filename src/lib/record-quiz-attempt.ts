"use client";

import {
  awardQuizPoints,
  type AwardQuizPointsResult,
} from "@/app/auth/quiz-points-actions";
import { quizPointsFloatDelta } from "@/lib/quiz-points";

/**
 * Persists quiz points to the database (signed-in users).
 * Returns the point delta for UI (helium float).
 */
export async function recordQuizAttempt(
  correct: boolean,
): Promise<AwardQuizPointsResult & { displayDelta: number }> {
  const res = await awardQuizPoints(correct);
  return { ...res, displayDelta: quizPointsFloatDelta(correct) };
}
