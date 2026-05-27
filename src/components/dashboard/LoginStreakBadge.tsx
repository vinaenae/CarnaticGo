"use client";

import { useEffect, useState } from "react";
import { getPracticeStreak, getStreakFreezeStatus } from "@/app/(app)/actions";
import { localCalendarDayString, type UserStreakSummary } from "@/lib/user-streak";
import { cn } from "@/lib/utils";

const EMPTY_STREAK: UserStreakSummary = {
  currentStreak: 0,
  qualifiedToday: false,
  streakFreezeArmed: false,
};

const bubbleClass =
  "inline-flex items-center gap-1 rounded bg-primary/12 px-2 py-0.5 text-[11px] font-medium tracking-wide text-foreground sm:text-xs";

export function LoginStreakBadge({ className }: { className?: string }) {
  const [streak, setStreak] = useState<UserStreakSummary>(EMPTY_STREAK);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const day = localCalendarDayString();
    void (async () => {
      const [summary, freeze] = await Promise.all([
        getPracticeStreak(day),
        getStreakFreezeStatus(),
      ]);
      setStreak({
        ...summary,
        streakFreezeArmed: freeze.armedDays > 0,
        streakFreezeArmedDays: freeze.armedDays,
      });
      setLoaded(true);
    })();
  }, []);

  const n = streak.currentStreak;
  const label = `${n} day log in streak`;
  if (!loaded) {
    return (
      <div
        className={cn(bubbleClass, "min-w-[7.5rem] min-h-[1.35rem] animate-pulse opacity-60", className)}
        aria-hidden
      />
    );
  }

  return (
    <p className={cn(bubbleClass, className)} aria-label={label}>
      <span className="font-semibold tabular-nums">{n}</span>
      <span>day log in streak</span>
      {streak.streakFreezeArmed ? (
        <span
          className="text-primary"
          title={
            streak.streakFreezeArmedDays && streak.streakFreezeArmedDays > 1
              ? `${streak.streakFreezeArmedDays}-day streak freeze armed`
              : "Streak freeze armed"
          }
        >
          · ❄
          {streak.streakFreezeArmedDays && streak.streakFreezeArmedDays > 1
            ? streak.streakFreezeArmedDays
            : ""}
        </span>
      ) : null}
    </p>
  );
}
