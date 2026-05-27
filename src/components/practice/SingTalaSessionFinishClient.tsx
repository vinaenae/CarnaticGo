"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteSingTalaPastSession,
  formatSingTalaSessionDuration,
  formatSingTalaSessionWhen,
  getSingTalaPastSession,
  updateSingTalaPastSessionNotes,
  updateSingTalaPastSessionTitle,
  type SingTalaPastSession,
} from "@/lib/sing-tala-session-storage";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import finishStyles from "@/components/practice/SingTalaSessionFinishClient.module.css";
import { tryAwardSingTalaDailyBonus } from "@/lib/sing-tala-daily-bonus";
import { syncLocalPracticeToServer } from "@/lib/sync-practice-to-server";

export function SingTalaSessionFinishClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pastId = searchParams.get("pastId")?.trim() ?? "";

  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<SingTalaPastSession | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!pastId) {
        router.replace("/dashboard");
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        router.replace("/dashboard");
        return;
      }

      const row = getSingTalaPastSession(user.id, pastId);
      if (!row) {
        router.replace("/dashboard");
        return;
      }

      setUserId(user.id);
      setSession(row);
      setTitle(row.title ?? "");
      setNotes(row.notes ?? "");
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [pastId, router]);

  useEffect(() => {
    if (!userId) return;
    void syncLocalPracticeToServer(userId);
    void tryAwardSingTalaDailyBonus(userId);
  }, [userId]);

  const goHome = () => {
    router.push("/dashboard");
  };

  const persistAndGoHome = () => {
    if (!userId || !session || busy) return;
    setBusy(true);
    updateSingTalaPastSessionTitle(userId, session.id, title);
    updateSingTalaPastSessionNotes(userId, session.id, notes);
    goHome();
  };

  const deleteSession = () => {
    if (!userId || !session || busy) return;
    if (!window.confirm("Delete this practice session? It will not appear in exports.")) return;
    setBusy(true);
    deleteSingTalaPastSession(userId, session.id);
    goHome();
  };

  if (loading || !session) {
    return (
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Loading session…
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
          Save practice session
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Name this session, add notes, or delete it if you do not want to keep it.
        </p>
      </div>

      <Card className="border-primary/15 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{formatSingTalaSessionWhen(session.endedAt)}</CardTitle>
          <CardDescription>
            {formatSingTalaSessionDuration(session.durationMs)} singing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="session-title">Session name (optional)</Label>
            <Input
              id="session-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Abhogi varnam"
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-notes">Practice notes (optional)</Label>
            <textarea
              id="session-notes"
              className={finishStyles.notesInput}
              rows={5}
              placeholder={"• Warm-up swaras\n• Varnam / kriti\n• Tāla practice"}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              className="sm:flex-1"
              disabled={busy}
              onClick={persistAndGoHome}
            >
              Save and go home
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="sm:flex-1"
              disabled={busy}
              onClick={deleteSession}
            >
              Delete session
            </Button>
          </div>

          <button
            type="button"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
            disabled={busy}
            onClick={persistAndGoHome}
          >
            Skip naming
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
