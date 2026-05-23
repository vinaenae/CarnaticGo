import Link from "next/link";
import { FriendsLeaderboard } from "@/components/leaderboard/FriendsLeaderboard";

export const dynamic = "force-dynamic";

export default function LeaderboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          ← Home
        </Link>
        <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Leaderboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          See how your points rank among friends.
        </p>
      </div>

      <FriendsLeaderboard />
    </div>
  );
}
