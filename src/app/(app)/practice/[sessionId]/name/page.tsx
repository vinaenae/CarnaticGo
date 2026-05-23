import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { RenameSessionForm } from "@/components/sessions/RenameSessionForm";
import type { DbSession } from "@/types";
import { cn } from "@/lib/utils";

export default async function EditSessionNamePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data, error } = await supabase
    .from("sessions")
    .select("id, user_id, title, started_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) notFound();
  const session = data as Pick<DbSession, "id" | "user_id" | "title" | "started_at">;
  if (session.user_id !== user.id) notFound();

  const displayTitle = session.title?.trim() || "Practice";
  const dateLabel = new Date(session.started_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          ← Home
        </Link>
        <h1 className="font-heading mt-3 text-3xl font-semibold tracking-tight">Edit session name</h1>
        <p className="mt-1 text-sm text-muted-foreground">Saved {dateLabel}</p>
      </div>

      <Card className="border-primary/15 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Session name</CardTitle>
          <CardDescription>
            Give this practice a name you will recognize on Home.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RenameSessionForm sessionId={sessionId} initialTitle={displayTitle} large />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/practice/${sessionId}/summary`}
              className={cn(buttonVariants({ variant: "default" }), "sm:flex-1")}
            >
              View session summary
            </Link>
            <Link
              href="/practice/new"
              className={cn(buttonVariants({ variant: "outline" }), "sm:flex-1")}
            >
              Start another session
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
