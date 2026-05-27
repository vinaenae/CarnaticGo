"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { applyQuizPointsMultiplier, quizPointsForAnswer } from "@/lib/quiz-points";

export type AwardQuizPointsResult =
  | {
      ok: true;
      pointsAwarded: number;
      quizPointsTotal: number;
      quizCorrectStreak: number;
    }
  | { ok: false; error?: string };

type AwardRpcPayload = {
  points_awarded?: number;
  quiz_points_total?: number;
  quiz_correct_streak?: number;
};

/** Server-side quiz scoring (attempt + correct + consecutive-correct streak). */
export async function awardQuizPoints(correct: boolean): Promise<AwardQuizPointsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to earn quiz points." };
  }

  const { data, error } = await supabase.rpc("award_quiz_points", {
    p_correct: correct,
  });

  if (!error) {
    const payload = (typeof data === "object" && data !== null ? data : {}) as AwardRpcPayload;
    revalidatePath("/leaderboard");
    revalidatePath("/dashboard");
    revalidatePath("/shop");
    return {
      ok: true,
      pointsAwarded: Number(payload.points_awarded ?? 0),
      quizPointsTotal: Number(payload.quiz_points_total ?? 0),
      quizCorrectStreak: Number(payload.quiz_correct_streak ?? 0),
    };
  }

  const rpcMissing =
    error.message.includes("award_quiz_points") ||
    error.message.includes("quiz_points_total") ||
    error.code === "PGRST202";

  if (!rpcMissing) {
    console.error("award_quiz_points:", error.message);
    return { ok: false, error: error.message };
  }

  const fallback = await awardQuizPointsViaProfileUpdate(supabase, user.id, correct);
  if (!fallback.ok) {
    return {
      ok: false,
      error:
        "Quiz points are not set up yet. Run supabase/apply_quiz_points.sql in the Supabase SQL Editor.",
    };
  }

  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  return fallback;
}

/** Used when RPC is not deployed yet; still writes only the authenticated user's row. */
async function awardQuizPointsViaProfileUpdate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  correct: boolean,
): Promise<AwardQuizPointsResult> {
  const { data: row, error: readErr } = await supabase
    .from("users")
    .select("quiz_points_total, quiz_correct_streak, shop_points_multiplier_until")
    .eq("id", userId)
    .single();

  if (readErr) {
    console.error("awardQuizPointsViaProfileUpdate read:", readErr.message);
    return { ok: false, error: readErr.message };
  }

  const priorStreak = row.quiz_correct_streak ?? 0;
  const newStreak = correct ? priorStreak + 1 : 0;
  const basePoints = quizPointsForAnswer(correct, priorStreak);
  const pointsAwarded = applyQuizPointsMultiplier(
    basePoints,
    row.shop_points_multiplier_until ?? null,
  );
  const quizPointsTotal = Math.max(0, (row.quiz_points_total ?? 0) + pointsAwarded);

  const { error: writeErr } = await supabase
    .from("users")
    .update({
      quiz_points_total: quizPointsTotal,
      quiz_correct_streak: newStreak,
    })
    .eq("id", userId);

  if (writeErr) {
    console.error("awardQuizPointsViaProfileUpdate write:", writeErr.message);
    return { ok: false, error: writeErr.message };
  }

  return {
    ok: true,
    pointsAwarded,
    quizPointsTotal,
    quizCorrectStreak: newStreak,
  };
}
