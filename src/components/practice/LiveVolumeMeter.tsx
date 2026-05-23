"use client";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const RMS_SOFT = 0.012;
const RMS_LOUD = 0.08;
const RMS_DISPLAY_MAX = 0.11;

function volumeTone(label: "too_soft" | "good" | "too_loud", hasSignal: boolean) {
  if (!hasSignal) return "idle" as const;
  if (label === "good") return "good" as const;
  if (label === "too_soft") return "warn" as const;
  return "bad" as const;
}

/** Map RMS to 0–100 for bar (soft left, loud right). */
function rmsToBarPct(rms: number): number {
  const x = Math.max(0, Math.min(RMS_DISPLAY_MAX, rms));
  return (x / RMS_DISPLAY_MAX) * 100;
}

export function LiveVolumeMeter({ volume }: { volume: { rms: number; label: "too_soft" | "good" | "too_loud" } }) {
  const { rms, label } = volume;
  const hasSignal = rms >= 0.0015;
  const tone = volumeTone(label, hasSignal);
  const barPct = rmsToBarPct(rms);
  const goodLo = (RMS_SOFT / RMS_DISPLAY_MAX) * 100;
  const goodHi = (RMS_LOUD / RMS_DISPLAY_MAX) * 100;

  return (
    <Card className="flex h-full min-h-[320px] flex-col border-primary/20 bg-gradient-to-b from-card to-secondary/25 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Volume</CardTitle>
        <CardDescription>
          Stay in the green band for steady levels the coach can score fairly.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center pb-8 pt-2">
        <div className="relative mx-auto w-full max-w-md px-2">
          <div
            className={cn(
              "pointer-events-none absolute inset-x-6 top-8 h-14 rounded-full opacity-40 blur-2xl",
              tone === "idle" && "bg-muted-foreground/20",
              tone === "good" && "bg-emerald-500/35",
              tone === "warn" && "bg-amber-500/30",
              tone === "bad" && "bg-destructive/25",
            )}
            aria-hidden
          />
          <div className="relative pt-4">
            <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Softer ← → Louder
            </p>
            <div
              className="relative h-5 overflow-hidden rounded-full bg-primary/10 shadow-inner"
              role="img"
              aria-label="Input level"
            >
              <div
                className="absolute inset-y-0 rounded-full bg-emerald-500/25"
                style={{
                  left: `${goodLo}%`,
                  width: `${goodHi - goodLo}%`,
                }}
              />
              <div
                className={cn(
                  "absolute top-0.5 h-[calc(100%-4px)] w-2.5 rounded-full shadow-md transition-[left,background-color] duration-500 ease-out",
                  tone === "idle" && "bg-muted-foreground/35",
                  tone === "good" && "bg-emerald-500",
                  tone === "warn" && "bg-amber-500",
                  tone === "bad" && "bg-destructive",
                )}
                style={{ left: `${barPct}%`, transform: "translateX(-50%)" }}
              />
            </div>
            <p className="mt-2 text-center font-mono text-xs tabular-nums text-muted-foreground">
              {hasSignal ? rms.toFixed(4) : "—"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
