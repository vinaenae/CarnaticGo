import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AddFriendCard } from "@/components/dashboard/AddFriendCard";
import { HomeNavGuide } from "@/components/dashboard/HomeNavGuide";
import { LoginStreakBadge } from "@/components/dashboard/LoginStreakBadge";
import { QuizPointsHelpCard } from "@/components/dashboard/QuizPointsHelpCard";
import { SingTalaPastSessions } from "@/components/dashboard/SingTalaPastSessions";
import { GUEST_COOKIE_NAME, isGuestCookieValue } from "@/lib/guest-mode";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** First name from signUp `options.data` (JWT user_metadata); use when public.users is empty or not migrated. */
function firstNameFromAuthUser(user: { user_metadata?: Record<string, unknown> }): string | undefined {
  const raw =
    user.user_metadata?.first_name ??
    user.user_metadata?.given_name ??
    (typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.split(/\s+/)[0]
      : undefined) ??
    user.user_metadata?.name;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t.length > 0 ? t.slice(0, 80) : undefined;
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const guest = !user && isGuestCookieValue((await cookies()).get(GUEST_COOKIE_NAME)?.value);

  let greeting = "Hi!";
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("first_name")
      .eq("id", user.id)
      .maybeSingle();
    const fn = profile?.first_name?.trim() || firstNameFromAuthUser(user);
    if (fn) greeting = `Hi ${fn}!`;
  }

  return (
    <div className="flex flex-col gap-10 pb-8">
      <section className="relative mx-auto w-full max-w-6xl px-4 pt-8 sm:pt-12">
        <div className="ml-8 flex max-w-xl flex-col items-start gap-4 sm:ml-14 md:ml-20">
          {user ? <LoginStreakBadge /> : null}
          <h1 className="font-heading text-left text-5xl font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl">
            {greeting}
          </h1>
        </div>
        <HomeNavGuide />
      </section>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4">
        {guest ? (
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            You&apos;re browsing as a guest.{" "}
            <Link href="/login" className={cn(buttonVariants({ variant: "link" }), "h-auto p-0")}>
              Sign in
            </Link>{" "}
            to save quiz points, use the shop, and appear on the leaderboard.
          </div>
        ) : null}
        <div className={`grid gap-4 ${user ? "sm:grid-cols-2" : "max-w-sm"}`}>
          <QuizPointsHelpCard />
          {user ? <AddFriendCard /> : null}
        </div>
        {user ? <SingTalaPastSessions userId={user.id} /> : null}
      </div>
    </div>
  );
}
