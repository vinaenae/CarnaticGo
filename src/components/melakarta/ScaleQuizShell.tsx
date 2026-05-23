"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ScaleQuizClient,
  parseScaleQuizMode,
  type ScaleQuizMode,
} from "@/components/melakarta/ScaleQuizClient";
import { cn } from "@/lib/utils";
import type { ScaleQuizDifficulty } from "@/lib/scale-quiz-ragas";

const DIFFICULTIES: { id: ScaleQuizDifficulty; label: string }[] = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

export function ScaleQuizShell() {
  const searchParams = useSearchParams();
  const [quizMode, setQuizMode] = useState<ScaleQuizMode>(() =>
    parseScaleQuizMode(searchParams.get("mode")),
  );
  const [difficulty, setDifficulty] = useState<ScaleQuizDifficulty>("beginner");

  useEffect(() => {
    setQuizMode(parseScaleQuizMode(searchParams.get("mode")));
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div
        className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-primary/10 p-1"
        role="tablist"
        aria-label="Difficulty"
      >
        {DIFFICULTIES.map((d) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={difficulty === d.id}
            onClick={() => setDifficulty(d.id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              difficulty === d.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>
      <ScaleQuizClient key={`${quizMode}-${difficulty}`} mode={quizMode} difficulty={difficulty} />
    </div>
  );
}
