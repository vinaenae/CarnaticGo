import { Flame } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UserStreakSummary } from "@/lib/user-streak";

export function PracticeStreakCard({ streak }: { streak: UserStreakSummary }) {
  const { currentStreak, qualifiedToday, bestStreak } = streak;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium">Login streak</CardTitle>
          <CardDescription>
            Consecutive days you signed in (saved to your account in Supabase).
          </CardDescription>
        </div>
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
          aria-hidden
        >
          <Flame className="size-5" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="font-heading text-4xl font-semibold tabular-nums tracking-tight text-foreground">
          {currentStreak}
          <span className="ml-2 text-lg font-normal text-muted-foreground">
            {currentStreak === 1 ? "day" : "days"}
          </span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {qualifiedToday
            ? "You’ve logged in today — streak counts this calendar day."
            : currentStreak > 0
              ? "Open the app today to keep your login streak."
              : "Your streak starts on your next visit."}
          {bestStreak != null && bestStreak > currentStreak ? (
            <span className="mt-1 block">Personal best: {bestStreak} days.</span>
          ) : null}
        </p>
      </CardContent>
    </Card>
  );
}
