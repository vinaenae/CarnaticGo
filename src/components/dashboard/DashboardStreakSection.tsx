"use client";

import { useEffect, useState } from "react";
import { getPracticeStreak } from "@/app/(app)/actions";
import { PracticeStreakCard } from "@/components/dashboard/PracticeStreakCard";
import { localCalendarDayString, type UserStreakSummary } from "@/lib/user-streak";

const EMPTY_STREAK: UserStreakSummary = { currentStreak: 0, qualifiedToday: false };

export function DashboardStreakSection() {
  const [streak, setStreak] = useState<UserStreakSummary>(EMPTY_STREAK);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const day = localCalendarDayString();
    void (async () => {
      const summary = await getPracticeStreak(day);
      setStreak(summary);
      setLoaded(true);
    })();
  }, []);

  if (!loaded) {
    return (
      <div
        className="h-[9.5rem] animate-pulse rounded-xl border border-primary/10 bg-primary/8"
        aria-hidden
      />
    );
  }

  return <PracticeStreakCard streak={streak} />;
}
