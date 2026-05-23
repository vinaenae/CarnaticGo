"use client";

import { useState } from "react";
import { TheoryQuizClient } from "@/components/theory/TheoryQuizClient";
import {
  THEORY_QUIZ_DIFFICULTIES,
  THEORY_QUIZ_TOPICS,
  type TheoryQuizDifficulty,
  type TheoryQuizTopic,
} from "@/lib/theory-quiz-data";
import { cn } from "@/lib/utils";

export function TheoryQuizShell() {
  const [topic, setTopic] = useState<TheoryQuizTopic>("all");
  const [difficulty, setDifficulty] = useState<TheoryQuizDifficulty>("beginner");

  return (
    <div className="space-y-6">
      <div
        className="flex max-w-full flex-nowrap gap-1 overflow-x-auto rounded-xl border border-border bg-primary/10 p-1 [scrollbar-width:thin]"
        role="tablist"
        aria-label="Theory topic"
      >
        {THEORY_QUIZ_TOPICS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={topic === t.id}
            onClick={() => setTopic(t.id)}
            className={cn(
              "shrink-0 cursor-pointer whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold transition-[background,border-color,color,box-shadow] sm:text-sm",
              topic === t.id
                ? "border-primary/40 bg-background text-foreground shadow-sm"
                : "border-border bg-card/80 text-foreground/85 hover:border-primary/30 hover:bg-accent hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-primary/10 p-1"
        role="tablist"
        aria-label="Difficulty"
      >
        {THEORY_QUIZ_DIFFICULTIES.map((d) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={difficulty === d.id}
            onClick={() => setDifficulty(d.id)}
            className={cn(
              "cursor-pointer rounded-lg border px-4 py-2 text-sm font-semibold transition-[background,border-color,color,box-shadow]",
              difficulty === d.id
                ? "border-primary/40 bg-background text-foreground shadow-sm"
                : "border-border bg-card/80 text-foreground/85 hover:border-primary/30 hover:bg-accent hover:text-foreground",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      <TheoryQuizClient key={`${topic}-${difficulty}`} topic={topic} difficulty={difficulty} />
    </div>
  );
}
