"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  fetchUserStreak,
  localCalendarDayString,
  syncUserLoginStreakCache,
  upsertDailyActivity,
  upsertDailyLogin,
  type UserStreakSummary,
} from "@/lib/user-streak";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function deletePracticeSession(formData: FormData) {
  const sessionId = formData.get("sessionId");
  if (typeof sessionId !== "string" || !sessionId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
}

export async function updateSessionTitle(formData: FormData) {
  const sessionId = formData.get("sessionId");
  const title = formData.get("title");
  if (typeof sessionId !== "string" || !sessionId) return;
  if (typeof title !== "string") return;
  const trimmed = title.trim().slice(0, 120);
  if (!trimmed) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("sessions")
    .update({ title: trimmed })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/practice/${sessionId}/summary`);
  revalidatePath(`/practice/${sessionId}/name`);
}

/** Call on dashboard visit — marks login for the user's local calendar day. */
export async function recordDailyLogin(day?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const calendarDay = day?.trim().slice(0, 10) || localCalendarDayString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(calendarDay)) return;

  const ok = await upsertDailyLogin(supabase, user.id, calendarDay);
  if (ok) {
    await supabase
      .from("users")
      .update({ last_login_day: calendarDay })
      .eq("id", user.id);
    await syncUserLoginStreakCache(supabase, user.id, calendarDay);
  }
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  revalidatePath("/shop");
}

/** Call after practice, quizzes, sing-along comparison, etc. */
export async function recordUserActivity(day?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const calendarDay = day?.trim().slice(0, 10) || localCalendarDayString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(calendarDay)) return;

  const loginOk = await upsertDailyLogin(supabase, user.id, calendarDay);
  const activityOk = await upsertDailyActivity(supabase, user.id, calendarDay);
  if (loginOk || activityOk) {
    await syncUserLoginStreakCache(supabase, user.id, calendarDay);
  }
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  revalidatePath("/shop");
}

export async function getStreakFreezeStatus(): Promise<{
  armed: boolean;
  inventory: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { armed: false, inventory: 0 };

  const { data } = await supabase
    .from("users")
    .select("shop_streak_freeze_armed, shop_streak_freeze_inventory")
    .eq("id", user.id)
    .maybeSingle();

  return {
    armed: Boolean(data?.shop_streak_freeze_armed),
    inventory: Math.max(0, data?.shop_streak_freeze_inventory ?? 0),
  };
}

export async function getPracticeStreak(day?: string): Promise<UserStreakSummary> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { currentStreak: 0, qualifiedToday: false };

  const calendarDay = day?.trim().slice(0, 10) || localCalendarDayString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(calendarDay)) {
    return { currentStreak: 0, qualifiedToday: false };
  }

  return fetchUserStreak(supabase, user.id, calendarDay);
}
