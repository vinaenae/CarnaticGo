"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useFftSwaraDetector } from "@/hooks/useFftSwaraDetector";
import type { AudioFrameListener } from "@/hooks/usePracticeSession";
import { RAGA_SWARA_PROFILES, ragaSwaraProfileById } from "@/lib/raga-swara-notes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function LiveFftSwaraDetector({
  subscribeAudioFrame,
  saHz,
  running,
}: {
  subscribeAudioFrame: (listener: AudioFrameListener) => () => void;
  saHz: number;
  running: boolean;
}) {
  const [enabled, setEnabled] = useState(true);
  const [ragaId, setRagaId] = useState<string>("Mohanam");

  const profile = useMemo(() => ragaSwaraProfileById(ragaId), [ragaId]);
  const fft = useFftSwaraDetector(subscribeAudioFrame, ragaId, saHz, enabled && running);

  const activeToken = fft.result?.token;
  const offRaga = fft.result?.voiced && fft.result.token && fft.result.inRaga === false;

  return (
    <Card className="border-primary/15 bg-gradient-to-b from-card to-secondary/20 shadow-md">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">Rāga swara (FFT)</CardTitle>
            <CardDescription>
              Python RFFT on your mic — maps pitch to the swara tokens from your scale-quiz chart for the
              chosen rāga. The 22-shruti alignment meter above is unchanged.
            </CardDescription>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-4 rounded border-border"
            />
            <span className="text-muted-foreground">Detect</span>
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="fft-raga" className="text-xs text-muted-foreground">
              Rāga (allowed swaras)
            </Label>
            <select
              id="fft-raga"
              value={ragaId}
              onChange={(e) => setRagaId(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-control-border bg-background px-3 text-sm shadow-sm"
            >
              {RAGA_SWARA_PROFILES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          {fft.serviceOk === false && (
            <p className="text-sm text-destructive">
              {fft.lastError ?? "Start shruti-fft on port 8002 (see services/shruti-fft/README.md)."}
            </p>
          )}
        </div>

        <div
          className={cn(
            "flex min-h-[120px] flex-col items-center justify-center rounded-xl border px-4 py-6 text-center transition-colors",
            !fft.result?.voiced && "border-border/80 bg-primary/8",
            fft.result?.voiced && fft.result.inRaga && "border-emerald-500/40 bg-emerald-500/5",
            fft.result?.voiced && offRaga && "border-amber-500/40 bg-amber-500/5",
          )}
        >
          {!running ? (
            <p className="text-sm text-muted-foreground">Waiting for practice session…</p>
          ) : !enabled ? (
            <p className="text-sm text-muted-foreground">Detection paused</p>
          ) : fft.analyzing && !fft.result?.voiced ? (
            <p className="text-sm text-muted-foreground">Listening…</p>
          ) : fft.result?.voiced && activeToken ? (
            <>
              <p className="font-heading text-5xl font-semibold tracking-tight text-foreground">
                {activeToken}
              </p>
              {fft.result.centsOff != null && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {Math.round(Math.abs(fft.result.centsOff))} cents{" "}
                  {fft.result.centsOff > 0 ? "sharp" : "flat"} vs chart ·{" "}
                  {Math.round(fft.result.hz ?? 0)} Hz detected
                </p>
              )}
            </>
          ) : fft.result?.voiced ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Pitch heard ({Math.round(fft.result.hz ?? 0)} Hz) but not a swara in this rāga
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Sing a note…</p>
          )}
        </div>

        {profile && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Notes in {profile.name}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {profile.swaras.map((s) => (
                <Badge
                  key={s.token}
                  variant={activeToken === s.token ? "default" : "secondary"}
                  className={cn(
                    "font-mono text-sm",
                    activeToken === s.token && "ring-2 ring-primary/40",
                  )}
                >
                  {s.token}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
