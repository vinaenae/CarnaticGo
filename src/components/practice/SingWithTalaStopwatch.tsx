"use client";

import { formatSingTalaTimer } from "@/lib/sing-tala-points";
import { cn } from "@/lib/utils";
import styles from "@/components/practice/SingWithTalaSingingTimer.module.css";

export function SingWithTalaStopwatch({
  elapsedMs,
  paused,
  waitingToStart,
  continueSession,
  onStart,
}: {
  elapsedMs: number;
  paused: boolean;
  waitingToStart: boolean;
  /** User already began this sing-with-tāla session earlier. */
  continueSession: boolean;
  onStart: () => void;
}) {
  const startLabel = continueSession ? "Click to continue" : "Click to start";

  if (waitingToStart) {
    return (
      <button
        type="button"
        className={cn(styles.chip, styles.clickToStartBtn)}
        onClick={onStart}
        aria-live="polite"
        aria-label={startLabel}
      >
        {startLabel}
      </button>
    );
  }

  const title = paused ? "Paused — sing to continue" : "Timer running";

  return (
    <div className={styles.wrap} aria-live="polite">
      <div
        className={cn(styles.chip, paused && styles.chipPaused)}
        title={title}
        aria-label={`Stopwatch ${formatSingTalaTimer(elapsedMs)}`}
      >
        <span className={styles.chipLabel} aria-hidden>
          ⏱
        </span>
        <span className={styles.chipTime}>{formatSingTalaTimer(elapsedMs)}</span>
        <span
          className={cn(styles.dot, paused ? styles.dotPaused : styles.dotActive)}
          aria-hidden
        />
      </div>
    </div>
  );
}
