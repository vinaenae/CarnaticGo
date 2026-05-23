import { awardSingTalaPracticeBonus } from "@/app/auth/sing-tala-points-actions";
import {
  qualifiesForSingTalaDailyBonus,
  readSingTalaPastSessions,
} from "@/lib/sing-tala-session-storage";
import { localCalendarDayString } from "@/lib/user-streak";

export async function tryAwardSingTalaDailyBonus(userId: string) {
  const today = localCalendarDayString();
  const sessions = readSingTalaPastSessions(userId);
  if (!qualifiesForSingTalaDailyBonus(sessions, today)) {
    return { ok: true as const, eligible: false, pointsAwarded: 0 };
  }

  const result = await awardSingTalaPracticeBonus(today);
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }

  return {
    ok: true as const,
    eligible: true,
    pointsAwarded: result.pointsAwarded,
    alreadyAwardedToday: result.alreadyAwardedToday,
  };
}
