"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  theoryQuestionsForFilter,
  type TheoryQuizDifficulty,
  type TheoryQuizTopic,
} from "@/lib/theory-quiz-data";
import {
  pickRandomTheoryQuestion,
  shuffleQuestionOptions,
  type ShuffledTheoryQuestion,
} from "@/lib/theory-quiz-utils";
import { QuizPointsFloat } from "@/components/quizzes/QuizPointsFloat";
import { createQuizPointsPop, type QuizPointsPopState } from "@/lib/quiz-points";
import { recordQuizAttempt } from "@/lib/record-quiz-attempt";
import { trackUserActivity } from "@/lib/track-user-activity";
import { cn } from "@/lib/utils";

type Phase = "question" | "result";

function formatPct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function TheoryQuizClient({
  topic,
  difficulty,
}: {
  topic: TheoryQuizTopic;
  difficulty: TheoryQuizDifficulty;
}) {
  const pool = useMemo(
    () => theoryQuestionsForFilter(topic, difficulty),
    [topic, difficulty],
  );

  const [round, setRound] = useState<ShuffledTheoryQuestion | null>(null);
  const [phase, setPhase] = useState<Phase>("question");
  const [selectedIndex, setSelectedIndex] = useState<0 | 1 | 2 | 3 | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [pointsPop, setPointsPop] = useState<QuizPointsPopState | null>(null);

  const startRound = useCallback(
    (excludeId?: string) => {
      const q = pickRandomTheoryQuestion(pool, excludeId);
      if (!q) {
        setRound(null);
        return;
      }
      setRound(shuffleQuestionOptions(q));
      setSelectedIndex(null);
      setPointsPop(null);
      setPhase("question");
    },
    [pool],
  );

  useEffect(() => {
    if (pool.length === 0) {
      setRound(null);
      return;
    }
    startRound();
  }, [pool, startRound]);

  const submit = async (index: 0 | 1 | 2 | 3) => {
    if (!round || phase === "result") return;
    setSelectedIndex(index);
    const correct = index === round.correctIndex;
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

  if (pool.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card/60 p-8">
        <p className="text-sm text-muted-foreground">
          No questions in this topic and level yet. Try another combination.
        </p>
      </section>
    );
  }

  if (!round) {
    return (
      <section className="rounded-2xl border border-border bg-card/60 p-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </section>
    );
  }

  const correct = selectedIndex === round.correctIndex;
  const { question } = round;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
          Theory quiz
        </p>
        <h2 className="font-heading mt-1 text-xl font-semibold leading-snug text-foreground sm:text-2xl">
          {question.prompt}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {pool.length} questions in this set · pick one answer
        </p>

        {phase === "question" && (
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {round.options.map((label, i) => {
              const idx = i as 0 | 1 | 2 | 3;
              return (
                <Button
                  key={idx}
                  type="button"
                  variant="outline"
                  className="h-auto min-h-[3rem] justify-start whitespace-normal py-3 text-left text-sm leading-snug"
                  onClick={() => submit(idx)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        )}

        {phase === "result" && selectedIndex !== null && (
          <div
            className={cn(
              "mt-6 rounded-xl border p-4",
              correct
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-destructive/35 bg-destructive/5",
            )}
          >
            <p
              className={cn(
                "font-heading text-xl font-semibold",
                correct ? "text-emerald-700 dark:text-emerald-400" : "text-destructive",
              )}
            >
              {correct ? "Correct" : "Not quite"}
            </p>
            {!correct && (
              <p className="mt-2 text-sm text-foreground">
                Answer:{" "}
                <span className="font-medium">{round.options[round.correctIndex]}</span>
              </p>
            )}
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {question.explanation}
            </p>
            <Button type="button" className="mt-4" onClick={() => startRound(question.id)}>
              Next question
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
