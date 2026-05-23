"use client";

import { Download, Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/audio/recordingToWav";
import type { useSingAlongRecorder } from "@/hooks/useSingAlongRecorder";

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${r.toString().padStart(2, "0")}` : `${r}s`;
}

type Recorder = ReturnType<typeof useSingAlongRecorder>;

export function SingAlongMicRecorder({
  recorder,
  disabled,
  isExtracting,
  onUseForAnalysis,
  downloadFilenamePrefix,
}: {
  recorder: Recorder;
  disabled: boolean;
  /** CREPE running for this side only — does not block the other column. */
  isExtracting: boolean;
  onUseForAnalysis: () => void;
  downloadFilenamePrefix: string;
}) {

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-primary/6 p-3">
      <p className="text-sm font-medium text-foreground">Record in the browser</p>
      {recorder.phase === "recording" ? (
        <p className="text-xs text-muted-foreground">
          {`Recording… ${formatElapsed(recorder.elapsedMs)} (min ${formatElapsed(4000)})`}
        </p>
      ) : null}

      {recorder.phase === "recording" && (
        <div className="h-2 overflow-hidden rounded-full bg-primary/10" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-150"
            style={{ width: `${Math.min(100, recorder.liveRms * 400)}%` }}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {recorder.phase === "idle" && (
          <Button
            type="button"
            variant="default"
            disabled={disabled || isExtracting}
            onClick={() => void recorder.startRecording()}
            className="gap-2"
          >
            <Mic className="size-4" aria-hidden />
            Start recording
          </Button>
        )}
        {recorder.phase === "recording" && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => recorder.stopRecording()}
            className="gap-2"
          >
            <Square className="size-3.5 fill-current" aria-hidden />
            Stop
          </Button>
        )}
        {recorder.phase === "recorded" && (
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={isExtracting}
              onClick={onUseForAnalysis}
              className="gap-2"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Analyzing…
                </>
              ) : (
                "Use for analysis"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!recorder.wavBlob}
              onClick={() => {
                if (!recorder.wavBlob) return;
                downloadBlob(
                  recorder.wavBlob,
                  `${downloadFilenamePrefix}-${Math.round(recorder.elapsedMs / 1000)}s.wav`,
                );
              }}
              className="gap-2"
            >
              <Download className="size-4" aria-hidden />
              Download WAV
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isExtracting}
              onClick={() => recorder.reset()}
            >
              Re-record
            </Button>
          </>
        )}
      </div>

      {recorder.previewUrl && recorder.phase === "recorded" && (
        <audio
          controls
          src={recorder.previewUrl}
          className="h-9 w-full max-w-md"
          preload="metadata"
        >
          Your browser does not support audio playback.
        </audio>
      )}
      {recorder.error && (
        <p className="text-sm text-destructive" role="alert">
          {recorder.error}
        </p>
      )}
    </div>
  );
}
