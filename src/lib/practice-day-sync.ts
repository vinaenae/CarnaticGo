import {
  readSingTalaPastSessions,
  singTalaSessionLocalDay,
  totalSingTalaDurationMs,
} from "@/lib/sing-tala-session-storage";
import { localCalendarDayString } from "@/lib/user-streak";

export type PracticeDayTotal = { day: string; totalMs: number };

/** Aggregate sing-with-tāla session durations by local calendar day. */
export function buildPracticeDayTotals(
  userId: string,
  lookbackDays = 14,
): PracticeDayTotal[] {
  const sessions = readSingTalaPastSessions(userId);
  const anchor = localCalendarDayString();
  const totals: PracticeDayTotal[] = [];

  for (let i = 0; i < lookbackDays; i++) {
    const day = addCalendarDays(anchor, -i);
    const daySessions = sessions.filter((s) => singTalaSessionLocalDay(s.endedAt) === day);
    totals.push({
      day,
      totalMs: totalSingTalaDurationMs(daySessions),
    });
  }

  return totals;
}

function addCalendarDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return dt.toLocaleDateString("en-CA");
}

/** Last 7 local days (today first) with whether each has 15+ min practice. */
export function practiceStreakDayStatus(
  totals: PracticeDayTotal[],
  goalMs: number,
): { day: string; qualified: boolean; totalMs: number }[] {
  const map = new Map(totals.map((t) => [t.day, t.totalMs]));
  const anchor = localCalendarDayString();
  const rows: { day: string; qualified: boolean; totalMs: number }[] = [];

  for (let i = 0; i < 7; i++) {
    const day = addCalendarDays(anchor, -i);
    const totalMs = map.get(day) ?? 0;
    rows.push({ day, totalMs, qualified: totalMs >= goalMs });
  }

  return rows;
}

export function isPracticeStreakEligible(
  totals: PracticeDayTotal[],
  goalMs: number,
): boolean {
  return practiceStreakDayStatus(totals, goalMs).every((d) => d.qualified);
}
