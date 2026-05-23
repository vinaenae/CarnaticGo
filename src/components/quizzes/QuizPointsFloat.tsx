"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import styles from "@/components/quizzes/QuizPointsFloat.module.css";

export function formatQuizPointsDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export function QuizPointsFloat({
  delta,
  popId,
  onDone,
}: {
  delta: number;
  /** Unique id per pop so timers do not cancel across re-renders. */
  popId: number;
  onDone?: () => void;
}) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const t = window.setTimeout(() => onDoneRef.current?.(), 1200);
    return () => window.clearTimeout(t);
  }, [popId]);

  return (
    <div
      className={cn(
        styles.pop,
        delta > 0 ? styles.positive : styles.negative,
      )}
      role="status"
      aria-live="polite"
      aria-label={`${formatQuizPointsDelta(delta)} points`}
    >
      {formatQuizPointsDelta(delta)}
    </div>
  );
}
