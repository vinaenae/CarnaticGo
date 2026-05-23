"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SING_TALA_BONUS_POINTS } from "@/lib/sing-tala-points";
import { localCalendarDayString } from "@/lib/user-streak";

export type AwardSingTalaBonusResult =
  | { ok: true; pointsAwarded: number; quizPointsTotal: number; alreadyAwardedToday: boolean }
  | { ok: false; error?: string };

function revalidatePointsPaths() {
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  revalidatePath("/shop");
}

export async function awardSingTalaPracticeBonus(
  day?: string,
): Promise<AwardSingTalaBonusResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to earn sing-with-tāla practice points." };
  }

  const today = day?.trim().slice(0, 10) || localCalendarDayString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return { ok: false, error: "Invalid calendar day." };
  }

  const { data, error } = await supabase.rpc("award_sing_tala_practice_bonus", {
    p_day: today,
  });

  if (!error && data && typeof data === "object") {
    const payload = data as Record<string, unknown>;
    revalidatePointsPaths();
    return {
      ok: true,
      pointsAwarded: Number(payload.points_awarded ?? 0),
      quizPointsTotal: Number(payload.quiz_points_total ?? 0),
      alreadyAwardedToday: Boolean(payload.already_awarded_today),
    };
  }

  const rpcMissing =
    error?.message.includes("award_sing_tala_practice_bonus") ||
    error?.message.includes("sing_tala_bonus_day") ||
    error?.code === "PGRST202";

  if (!rpcMissing && error) {
    return { ok: false, error: error.message };
  }

  const { data: row, error: readErr } = await supabase
    .from("users")
    .select("quiz_points_total, sing_tala_bonus_day")
    .eq("id", user.id)
    .maybeSingle();

  if (readErr) {
    return {
      ok: false,
      error:
        "Sing-with-tāla bonus is not set up yet. Run supabase/apply_sing_tala_bonus.sql in Supabase.",
    };
  }

  const alreadyAwardedToday = row?.sing_tala_bonus_day === today;
  if (alreadyAwardedToday) {
    return {
      ok: true,
      pointsAwarded: 0,
      quizPointsTotal: Math.max(0, row?.quiz_points_total ?? 0),
      alreadyAwardedToday: true,
    };
  }

  const quizPointsTotal = Math.max(0, (row?.quiz_points_total ?? 0) + SING_TALA_BONUS_POINTS);
  const { error: writeErr } = await supabase
    .from("users")
    .update({
      quiz_points_total: quizPointsTotal,
      sing_tala_bonus_day: today,
    })
    .eq("id", user.id);

  if (writeErr) {
    return { ok: false, error: writeErr.message };
  }

  revalidatePointsPaths();
  return {
    ok: true,
    pointsAwarded: SING_TALA_BONUS_POINTS,
    quizPointsTotal,
    alreadyAwardedToday: false,
  };
}
