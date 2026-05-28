import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TypewriterAppName } from "@/components/brand/TypewriterAppName";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/layout/AppNav";
import { AppMain } from "@/components/layout/AppMain";
import { Button, buttonVariants } from "@/components/ui/button";
import { EngagementTracker } from "@/components/engagement/EngagementTracker";
import { GUEST_COOKIE_NAME, isGuestCookieValue } from "@/lib/guest-mode";
import { cn } from "@/lib/utils";
import { signOut } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const guest = isGuestCookieValue((await cookies()).get(GUEST_COOKIE_NAME)?.value);
  if (!user && !guest) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 shrink-0 border-b border-border/60 bg-background/75 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/65">
        <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5">
          <Link
            href="/dashboard"
            className="font-heading text-lg text-foreground transition-colors hover:text-primary"
            aria-label="ragify.ai home"
          >
            <TypewriterAppName animate={false} />
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <AppNav />
            {user ? (
              <form action={signOut}>
                <Button type="submit" variant="ghost" size="sm" className="rounded-full text-muted-foreground">
                  Sign out
                </Button>
              </form>
            ) : (
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "rounded-full text-muted-foreground",
                )}
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      {user ? <EngagementTracker /> : null}
      <AppMain>{children}</AppMain>
    </div>
  );
}
