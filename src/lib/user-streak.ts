import type { SupabaseClient } from "@supabase/supabase-js";

/** Local calendar day as YYYY-MM-DD (pass from client for timezone-accurate streaks). */
export function localCalendarDayString(date = new Date()): string {
  return date.toLocaleDateString("en-CA");
}

function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function addDays(day: string, delta: number): string {
  const dt = parseDay(day);
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export type UserStreakSummary = {
  currentStreak: number;
  /** True when the user has logged in today (local calendar day). */
  qualifiedToday: boolean;
  bestStreak?: number;
  /** Shop: streak freeze armed for next missed day. */
  streakFreezeArmed?: boolean;
};

/**
 * Consecutive calendar days with login (ending today if logged in today, else yesterday).
 */
export function computeLoginStreakFromDays(
  loginDays: string[],
  today: string,
): UserStreakSummary {
  const set = new Set(loginDays);
  const qualifiedToday = set.has(today);

  let cursor = qualifiedToday ? today : addDays(today, -1);
  let currentStreak = 0;
  while (set.has(cursor)) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  return { currentStreak, qualifiedToday };
}

function logStreakError(context: string, error: { message: string } | null) {
  if (error) {
    console.error(`[user-streak] ${context}:`, error.message);
  }
}

export async function upsertDailyLogin(
  supabase: SupabaseClient,
  userId: string,
  day: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data: existing, error: readErr } = await supabase
    .from("user_daily_engagement")
    .select("logged_in_at")
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle();

  if (readErr) {
    logStreakError("read engagement", readErr);
    return false;
  }

  if (existing?.logged_in_at) return true;

  if (existing) {
    const { error } = await supabase
      .from("user_daily_engagement")
      .update({ logged_in_at: now })
      .eq("user_id", userId)
      .eq("day", day);
    if (error) logStreakError("update login", error);
    return !error;
  }

  const { error } = await supabase.from("user_daily_engagement").insert({
    user_id: userId,
    day,
    logged_in_at: now,
  });
  if (error) logStreakError("insert login", error);
  return !error;
}

export async function upsertDailyActivity(
  supabase: SupabaseClient,
  userId: string,
  day: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data: existing, error: readErr } = await supabase
    .from("user_daily_engagement")
    .select("logged_in_at, activity_completed_at")
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle();

  if (readErr) {
    logStreakError("read engagement for activity", readErr);
    return false;
  }

  if (existing?.activity_completed_at) return true;

  if (existing) {
    const { error } = await supabase
      .from("user_daily_engagement")
      .update({
        activity_completed_at: now,
        logged_in_at: existing.logged_in_at ?? now,
      })
      .eq("user_id", userId)
      .eq("day", day);
    if (error) logStreakError("update activity", error);
    return !error;
  }

  const { error } = await supabase.from("user_daily_engagement").insert({
    user_id: userId,
    day,
    logged_in_at: now,
    activity_completed_at: now,
  });
  if (error) logStreakError("insert activity", error);
  return !error;
}

/** Load login days and compute consecutive-day streak. */
export async function fetchLoginStreakDays(
  supabase: SupabaseClient,
  userId: string,
  today: string,
): Promise<UserStreakSummary> {
  const { data, error } = await supabase
    .from("user_daily_engagement")
    .select("day")
    .eq("user_id", userId)
    .not("logged_in_at", "is", null);

  if (error) {
    logStreakError("fetch login days", error);
    return { currentStreak: 0, qualifiedToday: false };
  }

  const days = (data ?? []).map((r) => String(r.day).slice(0, 10));
  return computeLoginStreakFromDays(days, today);
}

/** Read cached streak from public.users (fallback if migration 005 not applied). */
export async function fetchCachedLoginStreak(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ currentStreak: number; bestStreak: number } | null> {
  const { data, error } = await supabase
    .from("users")
    .select("login_streak_current, login_streak_best")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  if (
    typeof data.login_streak_current !== "number" ||
    typeof data.login_streak_best !== "number"
  ) {
    return null;
  }
  return {
    currentStreak: data.login_streak_current,
    bestStreak: data.login_streak_best,
  };
}

/** Recompute streak from engagement rows and persist on users. */
export async function syncUserLoginStreakCache(
  supabase: SupabaseClient,
  userId: string,
  today: string,
): Promise<UserStreakSummary> {
  const { data, error } = await supabase
    .from("user_daily_engagement")
    .select("day")
    .eq("user_id", userId)
    .not("logged_in_at", "is", null);

  if (error) {
    logStreakError("fetch login days", error);
    return { currentStreak: 0, qualifiedToday: false };
  }

  let days = (data ?? []).map((r) => String(r.day).slice(0, 10));
  const yesterday = addDays(today, -1);
  if (!days.includes(yesterday)) {
    const { data: shopRow } = await supabase
      .from("users")
      .select("shop_streak_freeze_armed")
      .eq("id", userId)
      .maybeSingle();
    if (shopRow?.shop_streak_freeze_armed) {
      days = [...days, yesterday];
      await supabase
        .from("users")
        .update({ shop_streak_freeze_armed: false })
        .eq("id", userId);
    }
  }

  const summary = computeLoginStreakFromDays(days, today);
  const cached = await fetchCachedLoginStreak(supabase, userId);
  const bestStreak = Math.max(summary.currentStreak, cached?.bestStreak ?? 0);

  const { error: syncErr } = await supabase
    .from("users")
    .update({
      login_streak_current: summary.currentStreak,
      login_streak_best: bestStreak,
    })
    .eq("id", userId);

  if (syncErr) {
    logStreakError("sync users streak cache", syncErr);
    return { ...summary, bestStreak: cached?.bestStreak };
  }

  return { ...summary, bestStreak };
}

/** @deprecated alias — login-day streak (not activity-gated). */
export async function fetchUserStreak(
  supabase: SupabaseClient,
  userId: string,
  today: string,
): Promise<UserStreakSummary> {
  return syncUserLoginStreakCache(supabase, userId, today);
}
