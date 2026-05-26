"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  loadGuessClipManifest,
  randomListenRound,
  type GuessClipManifest,
} from "@/lib/raga-guess-clips";
import { buildRagaAnswer, ragaGuessMatches } from "@/lib/raga-name-match";
import type { QuizRaga } from "@/lib/raga-quiz-ragas";
import { KritiSamhitaAttribution } from "@/components/melakarta/KritiSamhitaAttribution";
import { ListenQuizSetupPanel } from "@/components/melakarta/ListenQuizSetupPanel";
import { QuizPointsFloat } from "@/components/quizzes/QuizPointsFloat";
import { createQuizPointsPop, type QuizPointsPopState } from "@/lib/quiz-points";
import { recordQuizAttempt } from "@/lib/record-quiz-attempt";
import { trackUserActivity } from "@/lib/track-user-activity";
import { cn } from "@/lib/utils";

type Phase = "loading" | "listening" | "result";

type Round = {
  clipUrl: string;
  answer: QuizRaga;
  song?: string;
};

function formatPct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function clipCount(manifest: GuessClipManifest): number {
  return Object.values(manifest).reduce((n, urls) => n + urls.length, 0);
}

function ragaCount(manifest: GuessClipManifest): number {
  return Object.keys(manifest).length;
}

export function RagaListenQuizClient() {
  const [manifest, setManifest] = useState<GuessClipManifest | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [round, setRound] = useState<Round | null>(null);
  const [guess, setGuess] = useState("");
  const [attempt, setAttempt] = useState(1);
  const [firstGuess, setFirstGuess] = useState("");
  const [won, setWon] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [pointsPop, setPointsPop] = useState<QuizPointsPopState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startRound = useCallback(
    async (m: GuessClipManifest, excludeClipUrl?: string) => {
      const next = await randomListenRound(m, excludeClipUrl);
      if (!next) {
        setError("No listen clips in manifest — export KritiSamhita A-shruti clips first.");
        setPhase("loading");
        return;
      }
      setError(null);
      setRound(next);
      setGuess("");
      setFirstGuess("");
      setAttempt(1);
      setWon(false);
      setPointsPop(null);
      setPhase("listening");
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      const m = await loadGuessClipManifest();
      setManifest(m);
      const total = clipCount(m);
      if (total === 0) {
        setError("No listen clips yet — add Carnatic_Dataset_Snippets.zip and run the export script.");
        setPhase("loading");
        return;
      }
      await startRound(m);
    })();
  }, [startRound]);

  const finishRound = async (correct: boolean) => {
    setWon(correct);
    setScore((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      total: s.total + 1,
    }));
    setPhase("result");
    const res = await recordQuizAttempt(correct);
    setPointsPop(createQuizPointsPop(correct));
    trackUserActivity();
  };

  const submitGuess = async () => {
    if (!round || phase !== "listening") return;
    const trimmed = guess.trim();
    if (!trimmed) return;

    const answer = buildRagaAnswer(round.answer.name, round.answer.aliases);
    if (ragaGuessMatches(trimmed, answer)) {
      await finishRound(true);
      return;
    }

    if (attempt >= 2) {
      await finishRound(false);
      return;
    }

    setAttempt(2);
    setFirstGuess(trimmed);
    setGuess("");
  };

  const nextRound = () => {
    if (!manifest) return;
    void startRound(manifest, round?.clipUrl);
  };

  if (phase === "loading" || !manifest) {
    const clips = manifest ? clipCount(manifest) : 0;
    const ragas = manifest ? ragaCount(manifest) : 0;
    return (
      <section className="rounded-2xl border border-border bg-card/60 p-8">
        <p className="text-sm text-muted-foreground">
          {error ?? "Loading clips…"}
        </p>
        {clips > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {clips} clips · {ragas} rāgas
          </p>
        ) : (
          <ListenQuizSetupPanel />
        )}
      </section>
    );
  }

  const clips = clipCount(manifest);
  const ragas = ragaCount(manifest);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Score:{" "}
          <span className="font-semibold text-foreground">
            {score.correct}/{score.total}
          </span>
          {score.total > 0 && (
            <span className="ml-1">({formatPct(score.correct / score.total)})</span>
          )}
          <span className="ml-2 text-xs">
            · {clips} clips · {ragas} rāgas
          </span>
        </p>
        <Link href="/melakarta" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← Melakarta
        </Link>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card/80 p-6 shadow-sm">
        {pointsPop != null ? (
          <QuizPointsFloat
            key={pointsPop.id}
            popId={pointsPop.id}
            delta={pointsPop.delta}
            onDone={() => setPointsPop(null)}
          />
        ) : null}
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Listen & guess
        </p>
        <h2 className="font-heading mt-1 text-2xl font-semibold text-foreground">
          What rāga is this?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Type the rāga name — two attempts per round.
        </p>

        {round?.clipUrl && (
          <div className="mt-6">
            <audio
              key={round.clipUrl}
              controls
              src={round.clipUrl}
              className="w-full max-w-md"
              preload="auto"
              onError={() =>
                setError("Could not load this clip. Try the next round or refresh the page.")
              }
            >
              Your browser does not support audio.
            </audio>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {phase === "listening" && (
          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submitGuess();
            }}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <label htmlFor="raga-guess" className="text-sm font-medium text-foreground">
                  Your answer
                </label>
                <Input
                  id="raga-guess"
                  type="text"
                  autoComplete="off"
                  placeholder="e.g. Kalyani, Todi, Bhairavi…"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  autoFocus
                />
              </div>
              <Button type="submit" size="lg" className="sm:mb-0.5">
                {attempt === 1 ? "Submit" : "Try again"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Attempt {attempt} of 2
              {attempt === 2 && firstGuess && (
                <>
                  {" "}
                  · first guess:{" "}
                  <span className="font-medium text-foreground">{firstGuess}</span>
                </>
              )}
            </p>
            {attempt === 2 && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                One attempt left — listen again if you need to.
              </p>
            )}
          </form>
        )}

        {phase === "result" && round && (
          <div
            className={cn(
              "mt-6 rounded-xl border p-4",
              won
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-destructive/35 bg-destructive/5",
            )}
          >
            <p
              className={cn(
                "font-heading text-xl font-semibold",
                won ? "text-emerald-700 dark:text-emerald-400" : "text-destructive",
              )}
            >
              {won ? "Correct!" : "Not quite"}
            </p>
            <Button type="button" className="mt-4" size="lg" onClick={nextRound}>
              Next clip
            </Button>
          </div>
        )}
      </section>

      <KritiSamhitaAttribution clipCount={clips} />
    </div>
  );
}
