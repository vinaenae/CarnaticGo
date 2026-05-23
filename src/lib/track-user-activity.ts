import { recordUserActivity } from "@/app/(app)/actions";
import { localCalendarDayString } from "@/lib/user-streak";

/** Fire-and-forget: counts toward the dashboard daily streak. */
export function trackUserActivity() {
  void recordUserActivity(localCalendarDayString());
}
