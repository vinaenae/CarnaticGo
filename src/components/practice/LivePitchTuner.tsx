"use client";

import { cn } from "@/lib/utils";
import type { LivePitchState } from "@/hooks/usePracticeSession";
import { LIVE_SHRUTI_TOLERANCE_CENTS, shrutiFeedbackLabel } from "@/lib/audio/liveShrutiFeedback";
import { svaraShortFromShruti22Row } from "@/lib/audio/svaraFromShruti22Row";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const METER_RANGE = 22;

function alignmentTone(status: LivePitchState["feedbackStatus"]) {
  if (status === "in_shruti") return "good" as const;
  if (status === "above" || status === "below") return "bad" as const;
  return "idle" as const;
}

export function LivePitchTuner({
  pitch,
  shrutiLabel,
  chartColumnTitle,
  saHz,
}: {
  pitch: LivePitchState;
  shrutiLabel: string;
  chartColumnTitle: string;
  saHz: number;
}) {
  const {
    smoothedDeviation,
    deviationCents,
    isVoiced,
    shruti22Index,
    targetShrutiHz,
    detectedHz,
    feedbackStatus,
    crepeActive,
  } = pitch;
  const tone = alignmentTone(feedbackStatus);
  const statusLabel = shrutiFeedbackLabel(feedbackStatus);

  const needleDeg = !isVoiced
    ? 0
    : (Math.max(-METER_RANGE, Math.min(METER_RANGE, smoothedDeviation)) / METER_RANGE) * 48;

  const barPct = !isVoiced
    ? 50
    : Math.max(0, Math.min(100, 50 + (smoothedDeviation / METER_RANGE) * 50));

  return (
    <Card className="flex h-full min-h-[320px] flex-col border-primary/20 bg-gradient-to-b from-card to-secondary/25 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Shruti alignment (CREPE)</CardTitle>
        <CardDescription>
          Live pitch vs the <span className="font-medium text-foreground/85">22 shrutis</span> in column{" "}
          <span className="font-medium text-foreground/85">{chartColumnTitle}</span> ({shrutiLabel}).
          In shruti when within ±{LIVE_SHRUTI_TOLERANCE_CENTS} cents of the nearest target.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center gap-5 pb-8 pt-2">
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-center text-sm font-semibold",
            tone === "idle" && "border-border/60 bg-primary/8 text-muted-foreground",
            tone === "good" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
            tone === "bad" && "border-destructive/35 bg-destructive/10 text-destructive",
          )}
          role="status"
          aria-live="polite"
        >
          {statusLabel}
        </p>

        <div className="grid gap-2 rounded-lg border border-border/50 bg-primary/6 px-3 py-2 font-mono text-xs tabular-nums">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Detected</span>
            <span className="text-foreground">
              {isVoiced && detectedHz != null ? `${detectedHz.toFixed(2)} Hz` : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Target</span>
            <span className="text-foreground">
              {isVoiced && targetShrutiHz != null
                ? `${targetShrutiHz.toFixed(2)} Hz${
                    shruti22Index != null
                      ? ` · row ${shruti22Index} (${svaraShortFromShruti22Row(shruti22Index)})`
                      : ""
                  }`
                : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Deviation</span>
            <span className="text-foreground">
              {isVoiced
                ? `${deviationCents >= 0 ? "+" : ""}${deviationCents.toFixed(1)} ¢ (smoothed ${smoothedDeviation >= 0 ? "+" : ""}${smoothedDeviation.toFixed(1)} ¢)`
                : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Sa (row 1)</span>
            <span className="text-foreground">{saHz.toFixed(2)} Hz</span>
          </div>
        </div>

        {!crepeActive ? (
          <p className="text-center text-xs text-amber-700 dark:text-amber-400">
            CREPE service offline — start <code className="text-[11px]">npm run dev</code> (port 8003).
          </p>
        ) : null}

        <div className="relative mx-auto max-w-md px-2">
          <svg viewBox="0 0 192 112" className="relative w-full" aria-hidden>
            <path
              d="M 20 88 A 76 76 0 0 1 172 88"
              fill="none"
              stroke="currentColor"
              className="text-border"
              strokeWidth="10"
              strokeLinecap="round"
              opacity={0.35}
            />
            <g
              transform={`translate(96,88) rotate(${needleDeg})`}
              style={{ transition: "transform 200ms ease-out" }}
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="-68"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="text-primary"
              />
            </g>
            <circle cx="96" cy="88" r="6" className="fill-primary shadow-sm" />
          </svg>
        </div>

        <div className="relative h-4 overflow-hidden rounded-full bg-primary/10 shadow-inner">
          <div
            className="absolute inset-y-0 w-px bg-foreground/25"
            style={{ left: "50%", transform: "translateX(-50%)" }}
          />
          <div
            className={cn(
              "absolute top-0.5 h-[calc(100%-4px)] w-2 rounded-full shadow-md transition-[left,background-color] duration-300 ease-out",
              tone === "idle" && "bg-muted-foreground/35",
              tone === "good" && "bg-emerald-500",
              tone === "bad" && "bg-destructive",
            )}
            style={{ left: `${barPct}%`, transform: "translateX(-50%)" }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
