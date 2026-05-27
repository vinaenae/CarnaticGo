import { getFriendsPointsLeaderboard, type PointsLeaderboardRow } from "@/app/auth/actions";
import { ProfileBadgeChip } from "@/components/shop/ProfileBadgeChip";
import { nicknameTrophyById } from "@/lib/shop-items";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function displayName(row: PointsLeaderboardRow): string {
  const trophy = nicknameTrophyById(row.shopNicknameTrophy);
  if (trophy) return trophy.label;
  if (row.username) return row.username;
  if (row.first_name) return row.first_name;
  return row.is_self ? "You" : "User";
}

export async function FriendsLeaderboard() {
  const rows = await getFriendsPointsLeaderboard();
  const self = rows.find((r) => r.is_self);
  const friendsOnly = rows.filter((r) => !r.is_self);

  return (
    <div className="space-y-6">
      {self && (
        <Card className="border-primary/25 bg-gradient-to-br from-card via-card to-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your quiz points</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-baseline gap-3">
            <span className="font-heading text-4xl font-semibold tabular-nums text-primary">
              {self.quizPointsTotal}
            </span>
            <span className="text-sm text-muted-foreground">
              point{self.quizPointsTotal === 1 ? "" : "s"} from quizzes
            </span>
            <Badge variant="secondary" className="ml-auto">
              Rank #{self.rank}
              {friendsOnly.length === 0 ? " (add friends to compete)" : ""}
            </Badge>
            {self.quizCorrectStreak > 1 ? (
              <p className="w-full text-xs text-muted-foreground">
                {self.quizCorrectStreak} correct in a row — keep going for streak bonuses.
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Friends leaderboard</CardTitle>
          <CardDescription>Ranked by total points.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sign in to see your ranking.</p>
          ) : (
            <>
              {friendsOnly.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You have not added any friends yet. Add someone by username on Home to see
                  them here.
                </p>
              ) : null}
              <ol className="space-y-2">
                {rows.map((row) => (
                  <li
                    key={row.user_id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                      row.is_self
                        ? "border-primary/30 bg-primary/5"
                        : "border-border bg-card",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                        row.is_self
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary/10 text-muted-foreground",
                      )}
                    >
                      {row.rank}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate font-medium text-foreground">
                        <ProfileBadgeChip badgeId={row.shopProfileBadge} />
                        <span className="truncate">{displayName(row)}</span>
                        {row.shopNicknameTrophy && row.username ? (
                          <span className="truncate text-xs font-normal text-muted-foreground">
                            @{row.username}
                          </span>
                        ) : null}
                        {row.is_self ? (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            (you)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.quizPointsTotal === 1
                          ? "1 point"
                          : `${row.quizPointsTotal} points`}
                        {row.quizCorrectStreak > 1
                          ? ` · ${row.quizCorrectStreak} correct streak`
                          : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
