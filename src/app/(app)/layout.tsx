import Link from "next/link";
import { redirect } from "next/navigation";
import { TypewriterAppName } from "@/components/brand/TypewriterAppName";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/layout/AppNav";
import { AppMain } from "@/components/layout/AppMain";
import { Button } from "@/components/ui/button";
import { EngagementTracker } from "@/components/engagement/EngagementTracker";
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
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 shrink-0 border-b border-border/60 bg-background/75 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/65">
        <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5">
          <Link
            href="/dashboard"
            className="font-heading text-lg text-foreground transition-colors hover:text-primary"
            aria-label="Ragify home"
          >
            <TypewriterAppName animate={false} />
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <AppNav />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" className="rounded-full text-muted-foreground">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <EngagementTracker />
      <AppMain>{children}</AppMain>
    </div>
  );
}
