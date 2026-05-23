"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTonicDetectorRecorder } from "@/hooks/useTonicDetectorRecorder";
import { recordingBlobToWav } from "@/lib/audio/recordingToWav";
import { detectTonicFromBlob } from "@/lib/tonic-detector-client";
import {
  KRITI_TONIC_CLASSES,
  kritiClassForTonic,
  parseKritiTonicLabel,
  type KritiTonic,
} from "@/lib/kriti-tonic";
import { trackUserActivity } from "@/lib/track-user-activity";
import type { TonicDetectResponse } from "@/types/tonic-detector";
import { cn } from "@/lib/utils";

function formatPct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function formatElapsed(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function TonicDetectorClient() {
  const recorder = useTonicDetectorRecorder();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadWav, setUploadWav] = useState<Blob | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [result, setResult] = useState<TonicDetectResponse | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);

  const activeBlob = recorder.blob ?? uploadWav;
  const activePreview = recorder.previewUrl ?? uploadPreviewUrl;
  const hasAudio = !!activeBlob && recorder.phase !== "recording";

  const clearUpload = useCallback(() => {
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    setUploadedFile(null);
    setUploadWav(null);
    setUploadPreviewUrl(null);
  }, [uploadPreviewUrl]);

  const resetAll = useCallback(() => {
    recorder.reset();
    clearUpload();
    setResult(null);
    setAnalyzeError(null);
    setSourceLabel(null);
  }, [clearUpload, recorder]);

  const runDetection = useCallback(async () => {
    if (!activeBlob) return;
    const label = uploadedFile?.name ?? "recording.wav";
    setAnalyzing(true);
    setAnalyzeError(null);
    setResult(null);
    setSourceLabel(label);
    try {
      const pred = await detectTonicFromBlob(activeBlob);
      setResult(pred);
      trackUserActivity();
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Classification failed.");
    } finally {
      setAnalyzing(false);
    }
  }, [activeBlob, uploadedFile?.name]);

  const onUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;
      recorder.reset();
      clearUpload();
      setResult(null);
      setAnalyzeError(null);
      setSourceLabel(null);

      setUploadedFile(file);
      try {
        const wav = file.type.includes("wav") ? file : await recordingBlobToWav(file);
        setUploadWav(wav);
        setUploadPreviewUrl(URL.createObjectURL(wav));
      } catch {
        setAnalyzeError("Could not read that audio file.");
        setUploadedFile(null);
      }
    },
    [clearUpload, recorder],
  );

  const startRecording = () => {
    clearUpload();
    setResult(null);
    setAnalyzeError(null);
    setSourceLabel(null);
    void recorder.startRecording();
  };

  const downloadAudio = () => {
    if (!activeBlob) return;
    const base = uploadedFile?.name?.replace(/\.[^.]+$/, "") ?? "tonic-recording";
    downloadBlob(activeBlob, `${base}-${stamp()}.wav`);
  };

  const downloadReport = () => {
    if (!result) return;
    const payload = {
      analyzedAt: new Date().toISOString(),
      source: sourceLabel,
      prediction: result,
    };
    const json = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    downloadBlob(json, `tonic-detection-${stamp()}.json`);
  };

  const predictedTonic = result
    ? (parseKritiTonicLabel(result.tonic) as KritiTonic | null)
    : null;
  const predictedClass = predictedTonic ? kritiClassForTonic(predictedTonic) : null;

  const inputError = recorder.error ?? analyzeError;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-card/80 p-6 shadow-sm space-y-5">
        <div>
          <p className="text-sm font-medium text-foreground">Your audio</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a file or record from the mic (~10–25 seconds of solo vocal). When you are ready,
            click <strong className="font-medium text-foreground">Classify shruti</strong>.
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-border/80 bg-background/50 p-4 space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Upload
            </label>
            <input
              type="file"
              accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a"
              className="mt-2 block max-w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f) void onUpload(f);
                e.target.value = "";
              }}
              disabled={analyzing || recorder.phase === "recording"}
            />
            {uploadedFile && (
              <p className="mt-2 text-xs text-muted-foreground">{uploadedFile.name}</p>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" aria-hidden />
            or
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Record
            </p>
            {recorder.phase === "recording" ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-foreground">
                  Recording… {formatElapsed(recorder.elapsedMs)} / {recorder.maxMs / 1000}s max
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Level</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/10">
                    <div
                      className="h-full bg-primary transition-[width] duration-150"
                      style={{ width: `${Math.min(100, recorder.liveRms * 400)}%` }}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="mt-1"
                  onClick={() => void recorder.stopRecording()}
                >
                  Stop recording
                </Button>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={startRecording}
                  disabled={analyzing}
                >
                  {recorder.phase === "recorded" ? "Record again" : "Start recording"}
                </Button>
                {recorder.phase === "recorded" && recorder.diagnostics && (
                  <span className="text-xs text-muted-foreground">
                    {recorder.diagnostics.durationSec.toFixed(1)}s captured
                  </span>
                )}
              </div>
            )}
          </div>

          {activePreview && hasAudio && (
            <audio controls src={activePreview} className="w-full" preload="metadata" />
          )}
        </div>

        {inputError && <p className="text-sm text-destructive">{inputError}</p>}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            size="lg"
            onClick={() => void runDetection()}
            disabled={!hasAudio || analyzing}
          >
            {analyzing ? "Classifying…" : "Classify shruti"}
          </Button>
          {hasAudio && (
            <>
              <Button type="button" variant="outline" onClick={resetAll} disabled={analyzing}>
                Clear
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={downloadAudio}
                disabled={analyzing}
              >
                Download WAV
              </Button>
            </>
          )}
        </div>
      </section>

      {result && predictedClass && (
        <section className="rounded-2xl border border-emerald-500/35 bg-emerald-500/5 p-6 space-y-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Result
          </p>
          <h2 className="font-heading text-3xl font-semibold text-foreground">
            {predictedClass.label}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatPct(result.confidence)} confident
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {KRITI_TONIC_CLASSES.map((c) => (
              <li
                key={c.tonic}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  c.tonic === result.tonic
                    ? "border-primary bg-primary/10 font-medium text-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                <span>{c.shortLabel}</span>
                <span className="float-right tabular-nums">
                  {formatPct(result.probabilities[c.tonic] ?? 0)}
                </span>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" onClick={downloadReport}>
            Download result (JSON)
          </Button>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Tonic detector runs on port 8004 in dev (<code className="rounded bg-muted px-1 py-0.5">npm run dev</code>
        ).
      </p>
    </div>
  );
}
