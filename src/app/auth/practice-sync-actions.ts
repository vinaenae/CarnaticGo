"use server";

import { createClient } from "@/lib/supabase/server";
import type { PracticeDayTotal } from "@/lib/practice-day-sync";
import { localCalendarDayString } from "@/lib/user-streak";

export type PracticeSyncResult =
  | { ok: true }
  | { ok: false; error: string };

export async function syncPracticeDayTotals(
  days: PracticeDayTotal[],
): Promise<PracticeSyncResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to sync practice." };

  for (const { day, totalMs } of days) {
    if (!day || totalMs < 0) continue;
    const { error } = await supabase.rpc("sync_user_practice_day", {
      p_day: day,
      p_total_ms: Math.round(totalMs),
    });

    if (error) {
      const missing =
        error.message.includes("sync_user_practice_day") ||
        error.message.includes("user_daily_practice") ||
        error.code === "PGRST202";
      if (missing) {
        return {
          ok: false,
          error:
            "Practice tracking is not set up yet. Run supabase/apply_shop_extras.sql in Supabase.",
        };
      }
      return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}

export async function fetchPracticeStreakEligible(
  anchorDay: string = localCalendarDayString(),
): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc("has_seven_day_practice_streak", {
    p_anchor_day: anchorDay,
  });

  if (error) {
    return false;
  }

  return Boolean(data);
}

export async function fetchPracticeDayMs(
  anchorDay: string = localCalendarDayString(),
): Promise<{ day: string; practiceMs: number }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(addCalendarDays(anchorDay, -i));
  }

  const { data, error } = await supabase
    .from("user_daily_practice")
    .select("day, practice_ms")
    .eq("user_id", user.id)
    .in("day", days);

  if (error) return [];

  const map = new Map(
    (data ?? []).map((r) => [String(r.day).slice(0, 10), Number(r.practice_ms ?? 0)]),
  );

  return days.map((day) => ({
    day,
    practiceMs: map.get(day) ?? 0,
  }));
}

function addCalendarDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return dt.toLocaleDateString("en-CA");
}
