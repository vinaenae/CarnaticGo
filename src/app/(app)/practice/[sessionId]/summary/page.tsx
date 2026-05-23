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
import { Progress } from "@/components/ui/progress";
import { TempoOffsetChart } from "@/components/charts/TempoOffsetChart";
import { VolumeChart } from "@/components/charts/VolumeChart";
import { RenameSessionForm } from "@/components/sessions/RenameSessionForm";
import type { DbSession, SessionScores } from "@/types";
import { cn } from "@/lib/utils";

export default async function SessionSummaryPage({
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
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) notFound();
  const session = data as DbSession;
  if (session.user_id !== user.id) notFound();

  const scores = session.scores as SessionScores | null;
  const tempo = session.tempo_data ?? [];
  const volume = session.volume_data ?? [];

  const dateLabel = new Date(session.started_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const displayTitle = session.title?.trim() || "Practice";

  return (
    <div className="space-y-10">
      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-card via-card to-secondary/35 p-6 shadow-md sm:p-8">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          ← Home
        </Link>
        <h1 className="font-heading mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{displayTitle}</h1>
        <p className="mt-1 text-muted-foreground">{dateLabel}</p>
        <div className="mt-5 max-w-md">
          <RenameSessionForm sessionId={sessionId} initialTitle={displayTitle} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ScoreCard title="Shruti steadiness" value={scores?.pitchAccuracy} />
        <ScoreCard title="Steady with the beat" value={scores?.tempoStability} />
      </div>

      <div className="grid gap-6">
        <Card className="border-primary/10 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Beat steadiness</CardTitle>
            <CardDescription>Flat line on the middle is best.</CardDescription>
          </CardHeader>
          <CardContent>
            <TempoOffsetChart data={tempo} />
          </CardContent>
        </Card>
        <Card className="border-primary/10 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Volume steadiness</CardTitle>
            <CardDescription>Flat line on the middle is best.</CardDescription>
          </CardHeader>
          <CardContent>
            <VolumeChart data={volume} />
          </CardContent>
        </Card>
      </div>

      <Link href="/practice/new" className={cn(buttonVariants({ size: "lg" }), "shadow-md shadow-primary/15")}>
        Start another session
      </Link>
    </div>
  );
}

function ScoreCard({ title, value }: { title: string; value: number | null | undefined }) {
  const v = value == null || Number.isNaN(value) ? 0 : Math.round(value);
  return (
    <Card className="border-primary/15 bg-gradient-to-br from-card to-secondary/25 shadow-md">
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums text-foreground">{v}</CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={v} />
      </CardContent>
    </Card>
  );
}
