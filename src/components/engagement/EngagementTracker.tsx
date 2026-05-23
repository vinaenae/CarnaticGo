"use client";

import { useEffect, useRef } from "react";
import { recordDailyLogin } from "@/app/(app)/actions";
import { localCalendarDayString } from "@/lib/user-streak";

/** Records login for the user's local calendar day on any authenticated app page. */
export function EngagementTracker() {
  const recordedRef = useRef<string | null>(null);

  useEffect(() => {
    const day = localCalendarDayString();
    if (recordedRef.current === day) return;
    recordedRef.current = day;
    void recordDailyLogin(day);
  }, []);

  return null;
}
