import { syncPracticeDayTotals } from "@/app/auth/practice-sync-actions";
import { buildPracticeDayTotals } from "@/lib/practice-day-sync";

/** Push local sing-with-tāla totals to Supabase (best-effort). */
export async function syncLocalPracticeToServer(userId: string): Promise<void> {
  if (!userId) return;
  const days = buildPracticeDayTotals(userId, 14);
  await syncPracticeDayTotals(days);
}
