"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Volume2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  pickRagaNameOptions,
  pickScalePairOptions,
} from "@/lib/scale-quiz-utils";
import {
  randomScaleQuizRaga,
  scaleQuizPoolForDifficulty,
  type ScaleQuizDifficulty,
  type ScaleQuizRaga,
} from "@/lib/scale-quiz-ragas";
import { playScaleLine } from "@/lib/carnatic-scale-synth";
import { QuizPointsFloat } from "@/components/quizzes/QuizPointsFloat";
import { createQuizPointsPop, type QuizPointsPopState } from "@/lib/quiz-points";
import { recordQuizAttempt } from "@/lib/record-quiz-attempt";
import { trackUserActivity } from "@/lib/track-user-activity";
import { cn } from "@/lib/utils";

export type ScaleQuizMode = "guess-raga" | "guess-scale";

export const SCALE_QUIZ_MODE_OPTIONS: {
  id: ScaleQuizMode;
  label: string;
  href: string;
}[] = [
  { id: "guess-raga", label: "Guess the rāga", href: "/melakarta/scale-quiz?mode=guess-raga" },
  { id: "guess-scale", label: "Guess the scale", href: "/melakarta/scale-quiz?mode=guess-scale" },
];

export function parseScaleQuizMode(modeParam: string | null): ScaleQuizMode {
  return modeParam === "guess-scale" ? "guess-scale" : "guess-raga";
}

export function scaleQuizModeLabel(mode: ScaleQuizMode): string {
  return SCALE_QUIZ_MODE_OPTIONS.find((m) => m.id === mode)?.label ?? "Scale quiz";
}

type Phase = "question" | "result";

function formatPct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function ScaleDisplay({ raga }: { raga: ScaleQuizRaga }) {
  const stopSynthRef = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState<"aro" | "ava" | null>(null);

  const playSample = useCallback(
    (which: "aro" | "ava") => {
      stopSynthRef.current?.();
      const line = which === "aro" ? raga.arohanam : raga.avarohanam;
      stopSynthRef.current = playScaleLine(line, {
        noteMs: 380,
        gapMs: 52,
        gain: 0.115,
        onComplete: () => setPlaying(null),
      });
      setPlaying(which);
    },
    [raga.arohanam, raga.avarohanam],
  );

  useEffect(() => {
    stopSynthRef.current?.();
    setPlaying(null);
    return () => {
      stopSynthRef.current?.();
    };
  }, [raga.id]);

  return (
    <div className="mt-6 space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border/80 bg-background/60 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Arohanam</p>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-8 shrink-0"
              aria-label="Play ascending scale as tones"
              title="Pure tones per note (fixed Hz chart)"
              onClick={() => playSample("aro")}
            >
              <Volume2
                className={cn(
                  "size-4",
                  playing === "aro" ? "text-primary" : "text-muted-foreground",
                )}
              />
            </Button>
          </div>
          <p className="mt-2 font-mono text-sm leading-relaxed text-foreground sm:text-base">
            {raga.arohanam}
          </p>
        </div>
        <div className="rounded-xl border border-border/80 bg-background/60 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Avarohanam</p>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-8 shrink-0"
              aria-label="Play descending scale as tones"
              title="Pure tones per note (fixed Hz chart)"
              onClick={() => playSample("ava")}
            >
              <Volume2
                className={cn(
                  "size-4",
                  playing === "ava" ? "text-primary" : "text-muted-foreground",
                )}
              />
            </Button>
          </div>
          <p className="mt-2 font-mono text-sm leading-relaxed text-foreground sm:text-base">
            {raga.avarohanam}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ScaleQuizClient({
  mode,
  difficulty,
}: {
  mode: ScaleQuizMode;
  difficulty: ScaleQuizDifficulty;
}) {
  const pool = useMemo(() => scaleQuizPoolForDifficulty(difficulty), [difficulty]);
  const [target, setTarget] = useState<ScaleQuizRaga | null>(null);
  const [options, setOptions] = useState<ScaleQuizRaga[]>([]);
  const [phase, setPhase] = useState<Phase>("question");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  /** Consecutive correct answers in this quiz session (resets when tier/mode changes). */
  const [streak, setStreak] = useState(0);
  /** Longest streak this session for the same tier/mode combo. */
  const [bestStreak, setBestStreak] = useState(0);
  const [pointsPop, setPointsPop] = useState<QuizPointsPopState | null>(null);

  const startRound = useCallback(
    (excludeId?: string) => {
      if (pool.length === 0) return;
      const answer = randomScaleQuizRaga(pool, excludeId);
      setTarget(answer);
      setOptions(
        mode === "guess-raga"
          ? pickRagaNameOptions(answer, pool)
          : pickScalePairOptions(answer, pool),
      );
      setSelectedId(null);
      setPointsPop(null);
      setPhase("question");
    },
    [mode, pool],
  );

  useEffect(() => {
    if (pool.length === 0) {
      setTarget(null);
      return;
    }
    startRound();
  }, [pool, startRound]);

  const submit = async (guessId: string) => {
    if (!target || phase === "result") return;
    setSelectedId(guessId);
    const correct = guessId === target.id;
    setScore((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      total: s.total + 1,
    }));
    if (correct) {
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    } else {
      setStreak(0);
    }
    setPointsPop(createQuizPointsPop(correct));
    setPhase("result");
    void recordQuizAttempt(correct).then(() => trackUserActivity());
  };

  const nextRound = () => startRound(target?.id);

  if (pool.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card/60 p-8">
        <p className="text-sm text-muted-foreground">
          No ragas match this difficulty in the quiz pool yet.
        </p>
      </section>
    );
  }

  if (!target) {
    return (
      <section className="rounded-2xl border border-border bg-card/60 p-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </section>
    );
  }

  const correct = selectedId === target.id;
  const modeTitle =
    mode === "guess-raga" ? "Which rāga is this scale?" : "Which scale matches this rāga?";
  const modeHint =
    mode === "guess-raga"
      ? "Read the arohanam and avarohanam, then pick the rāga name."
      : "Pick the arohanam and avarohanam that belong to the rāga shown.";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <p>
            Score:{" "}
            <span className="font-semibold text-foreground">
              {score.correct}/{score.total}
            </span>
            {score.total > 0 && (
              <span className="ml-1">({formatPct(score.correct / score.total)})</span>
            )}
          </p>
          <p>
            Streak:{" "}
            <span
              className={cn(
                "font-semibold tabular-nums",
                streak > 0 ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {streak}
            </span>
            {bestStreak > 0 && (
              <span className="ml-2 text-xs opacity-80">best {bestStreak}</span>
            )}
          </p>
        </div>
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
          Scale quiz
        </p>
        <h2 className="font-heading mt-1 text-2xl font-semibold text-foreground">{modeTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{modeHint}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {pool.length} ragas in this tier · 4 choices per round
        </p>

        {mode === "guess-raga" ? (
          <ScaleDisplay raga={target} />
        ) : (
          <>
            <h3 className="font-heading mt-6 text-3xl font-semibold tracking-tight text-foreground">
              {target.name}
            </h3>
            {target.melakartaNum != null && (
              <p className="mt-1 text-sm text-muted-foreground">Melakarta {target.melakartaNum}</p>
            )}
          </>
        )}

        {phase === "question" && (
          <div
            className={cn(
              "mt-6 grid gap-2",
              mode === "guess-raga" ? "sm:grid-cols-2" : "sm:grid-cols-2",
            )}
          >
            {mode === "guess-raga"
              ? options.map((r) => (
                  <Button
                    key={r.id}
                    type="button"
                    variant="outline"
                    className="h-auto justify-start py-3 text-left"
                    onClick={() => submit(r.id)}
                  >
                    <span className="font-medium">{r.name}</span>
                    {r.melakartaNum != null && (
                      <span className="ml-2 text-xs text-muted-foreground">M{r.melakartaNum}</span>
                    )}
                  </Button>
                ))
              : options.map((r) => (
                  <Button
                    key={r.id}
                    type="button"
                    variant="outline"
                    className="h-auto flex-col items-stretch gap-2 py-3 text-left"
                    onClick={() => submit(r.id)}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Arohanam
                    </span>
                    <span className="font-mono text-sm leading-relaxed">{r.arohanam}</span>
                    <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-primary">
                      Avarohanam
                    </span>
                    <span className="font-mono text-sm leading-relaxed">{r.avarohanam}</span>
                  </Button>
                ))}
          </div>
        )}

        {phase === "result" && selectedId && (
          <div
            className={cn(
              "mt-6 rounded-xl border p-4",
              correct ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/35 bg-destructive/5",
            )}
          >
            <p
              className={cn(
                "font-heading text-xl font-semibold",
                correct ? "text-emerald-700 dark:text-emerald-400" : "text-destructive",
              )}
            >
              {correct ? "Correct!" : "Not quite"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "guess-raga" ? (
                <>
                  This scale is{" "}
                  <span className="font-medium text-foreground">{target.name}</span>.
                  {!correct && (
                    <>
                      {" "}
                      You chose{" "}
                      <span className="font-medium text-foreground">
                        {options.find((r) => r.id === selectedId)?.name ?? selectedId}
                      </span>
                      .
                    </>
                  )}
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">{target.name}</span> is{" "}
                  <span className="font-mono text-foreground">{target.arohanam}</span>
                  {" / "}
                  <span className="font-mono text-foreground">{target.avarohanam}</span>.
                </>
              )}
            </p>
            {!correct && mode === "guess-scale" && (
              <div className="mt-3 rounded-lg border border-border/80 bg-background/50 p-3 text-sm">
                <p className="text-xs font-semibold uppercase text-primary">Correct scale</p>
                <p className="mt-1 font-mono text-foreground">{target.arohanam}</p>
                <p className="mt-1 font-mono text-foreground">{target.avarohanam}</p>
              </div>
            )}
            <Button type="button" className="mt-4" size="lg" onClick={nextRound}>
              Next question
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
