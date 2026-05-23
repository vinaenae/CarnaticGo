"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Mic, Square, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSingAlongRecorder } from "@/hooks/useSingAlongRecorder";
import { decodeAudioBlobForPitchAnalysis } from "@/lib/audio/decodeAudioBlob";
import { CrepePitchError, fetchCrepePitchContour } from "@/lib/audio/crepe-pitch-client";
import type { RawPitchContour } from "@/lib/audio/pitchContour";
import { shruti22AnchorsScaled } from "@/lib/audio/shruti22-chart";
import {
  analyzePracticeShrutiFromContour,
  contourToPracticePitchDots,
  formatPracticeShrutiTime,
  smoothVoicedContourForPractice,
  type PracticePitchDot,
  type PracticeShrutiAnalysis,
} from "@/lib/audio/practiceShrutiAnalysis";
import { CREPE_DISPLAY_HIT_CENTS } from "@/lib/audio/shrutiRowBand";
import { PracticeRecordingPitchDotChart } from "@/components/practice/PracticeRecordingPitchDotChart";
import { downloadBlob } from "@/lib/audio/recordingToWav";
import { getTanpuraService } from "@/lib/audio/TanpuraService";
import { cn } from "@/lib/utils";

type AudioClip = {
  samples: Float32Array;
  sampleRate: number;
  label: string;
  previewUrl: string | null;
};

export function PracticeOfflineShrutiCheck({
  tanpuraKey,
  saHz,
  chartColumnTitle,
  practiceRunning,
}: {
  tanpuraKey: string;
  saHz: number;
  chartColumnTitle: string;
  /** When true, tanpura loop resumes after recording stops. */
  practiceRunning: boolean;
}) {
  const recorder = useSingAlongRecorder({ minDurationMs: 2000 });
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadPreviewRef = useRef<string | null>(null);

  const [clip, setClip] = useState<AudioClip | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<PracticeShrutiAnalysis | null>(null);
  const [pitchDots, setPitchDots] = useState<PracticePitchDot[] | null>(null);
  const [chartAnchorsHz, setChartAnchorsHz] = useState<number[]>([]);
  const [contourDurationSec, setContourDurationSec] = useState(0);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const revokeUploadPreview = () => {
    if (uploadPreviewRef.current) {
      URL.revokeObjectURL(uploadPreviewRef.current);
      uploadPreviewRef.current = null;
    }
  };

  const setClipFromSamples = useCallback(
    (samples: Float32Array, sampleRate: number, label: string, previewUrl: string | null) => {
      revokeUploadPreview();
      setClip({ samples, sampleRate, label, previewUrl });
      setResult(null);
      setPitchDots(null);
      setChartAnchorsHz([]);
      setContourDurationSec(0);
      setAnalyzeError(null);
    },
    [],
  );

  const useRecording = () => {
    if (recorder.phase !== "recorded") return;
    const { samples, sampleRate } = recorder.getRecording();
    setClipFromSamples(
      samples,
      sampleRate,
      `practice-${Math.round(recorder.elapsedMs / 1000)}s.wav`,
      recorder.previewUrl,
    );
  };

  const downloadWav = () => {
    if (!recorder.wavBlob) return;
    downloadBlob(recorder.wavBlob, `practice-${Math.round(recorder.elapsedMs / 1000)}s.wav`);
  };

  const onUpload = async (list: FileList | null) => {
    const file = list?.item(0);
    if (!file) return;
    recorder.reset();
    setAnalyzeError(null);
    setResult(null);
    setPitchDots(null);
    try {
      const decoded = await decodeAudioBlobForPitchAnalysis(file);
      const url = URL.createObjectURL(file);
      uploadPreviewRef.current = url;
      setClipFromSamples(decoded.samples, decoded.sampleRate, file.name, url);
    } catch {
      setAnalyzeError("Could not read that audio file. Try WAV or MP3.");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const runCrepeShrutiCheck = async () => {
    if (!clip) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    setResult(null);
    setPitchDots(null);
    setChartAnchorsHz([]);
    try {
      const raw = await fetchCrepePitchContour(clip.samples, clip.sampleRate);
      const contour = smoothVoicedContourForPractice(raw);
      setResult(analyzePracticeShrutiFromContour(contour, saHz, tanpuraKey));
      setPitchDots(contourToPracticePitchDots(contour, saHz, tanpuraKey));
      setChartAnchorsHz(shruti22AnchorsScaled(saHz, tanpuraKey));
      setContourDurationSec(contourDurationFromRaw(contour));
    } catch (e) {
      const msg =
        e instanceof CrepePitchError
          ? e.message
          : e instanceof Error
            ? e.message
            : "CREPE analysis failed";
      setAnalyzeError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const clearClip = () => {
    revokeUploadPreview();
    setClip(null);
    setResult(null);
    setPitchDots(null);
    setChartAnchorsHz([]);
    setContourDurationSec(0);
    setAnalyzeError(null);
    recorder.reset();
  };

  function contourDurationFromRaw(contour: RawPitchContour): number {
    const n = contour.timesSec.length;
    if (n < 2) return 0;
    return Math.max(0, contour.timesSec[n - 1]! - contour.timesSec[0]!);
  }

  const previewSrc = clip?.previewUrl ?? recorder.previewUrl;

  useEffect(() => {
    if (recorder.phase !== "recording") return;
    const svc = getTanpuraService();
    svc.stop();
    return () => {
      if (!practiceRunning) return;
      void svc.preload().then(() => {
        svc.setVolume(0.16);
        svc.play(tanpuraKey);
      });
    };
  }, [recorder.phase, practiceRunning, tanpuraKey]);

  return (
    <Card className="border-primary/15 bg-card/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Check shruti offline (CREPE)</CardTitle>
        <CardDescription>
          CREPE pitch compared to the 22 printed Hz in column{" "}
          <span className="font-medium text-foreground/85">{chartColumnTitle}</span>. Nearest-target
          matching with ±12¢ in shruti on the charts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {recorder.phase === "idle" && (
            <Button
              type="button"
              variant="default"
              disabled={analyzing}
              onClick={() => void recorder.startRecording()}
              className="gap-2"
            >
              <Mic className="size-4" aria-hidden />
              Record
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
              Stop ({(recorder.elapsedMs / 1000).toFixed(1)}s)
            </Button>
          )}
          {recorder.phase === "recorded" && (
            <>
              <Button type="button" variant="secondary" disabled={analyzing} onClick={useRecording}>
                Use recording
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!recorder.wavBlob}
                onClick={downloadWav}
                className="gap-2"
              >
                <Download className="size-4" aria-hidden />
                Download WAV
              </Button>
              <Button type="button" variant="ghost" disabled={analyzing} onClick={recorder.reset}>
                Re-record
              </Button>
            </>
          )}

          <Button
            type="button"
            variant="outline"
            disabled={analyzing}
            onClick={() => fileRef.current?.click()}
            className="gap-2"
          >
            <Upload className="size-4" aria-hidden />
            Upload WAV / audio
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm"
            className="sr-only"
            onChange={(e) => void onUpload(e.target.files)}
          />
        </div>

        {recorder.phase === "recording" && (
          <p className="text-xs text-muted-foreground">
            Tanpura muted while recording. Level (RMS): {recorder.liveRms.toFixed(4)} — sing clearly toward
            the mic.
          </p>
        )}
        {recorder.error && (
          <p className="text-sm text-destructive" role="alert">
            {recorder.error}
          </p>
        )}

        {clip && (
          <div className="rounded-lg border border-border/80 bg-primary/6 p-3 space-y-3">
            <p className="text-sm font-medium text-foreground">{clip.label}</p>
            {previewSrc && (
              <audio controls src={previewSrc} className="h-9 w-full max-w-md" preload="metadata" />
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={analyzing}
                onClick={() => void runCrepeShrutiCheck()}
                className="gap-2"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Analyzing with CREPE…
                  </>
                ) : (
                  "Check shruti"
                )}
              </Button>
              <Button type="button" variant="ghost" disabled={analyzing} onClick={clearClip}>
                Clear
              </Button>
            </div>
          </div>
        )}

        {analyzeError && (
          <p className="text-sm text-destructive" role="alert">
            {analyzeError}
          </p>
        )}

        {result && (
          <div
            className={cn(
              "space-y-3 rounded-lg border p-4",
              result.verdict === "mostly_on" && "border-emerald-500/35 bg-emerald-500/5",
              result.verdict === "mixed" && "border-amber-500/35 bg-amber-500/5",
              result.verdict === "often_off" && "border-destructive/30 bg-destructive/5",
            )}
          >
            <p className="text-sm font-medium text-foreground">{result.verdictLabel}</p>
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <p>
                On shruti (±{CREPE_DISPLAY_HIT_CENTS} cents):{" "}
                <span className="font-mono font-medium text-foreground">{result.onShrutiPct.toFixed(0)}%</span>{" "}
                of voiced frames
              </p>
              <p>
                Mean deviation:{" "}
                <span className="font-mono font-medium text-foreground">
                  {result.meanAbsCents.toFixed(1)} cents
                </span>
              </p>
              <p>
                Median deviation:{" "}
                <span className="font-mono font-medium text-foreground">
                  {result.medianAbsCents.toFixed(1)} cents
                </span>
              </p>
              <p>
                Shruti score:{" "}
                <span className="font-mono font-medium text-foreground">
                  {result.pitchAccuracyScore.toFixed(0)} / 100
                </span>
              </p>
            </div>
            {result.offRegions.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground/90">
                  Passages noticeably off shruti (&gt;50 cents from nearest chart dot):
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {result.offRegions.slice(0, 8).map((r, i) => (
                    <li key={i} className="font-mono">
                      {formatPracticeShrutiTime(r.startSec)} – {formatPracticeShrutiTime(r.endSec)} · ~
                      {r.meanAbsCents.toFixed(0)} cents off · near shruti {r.shruti22Index} ({r.svaraShort})
                    </li>
                  ))}
                  {result.offRegions.length > 8 && (
                    <li>…and {result.offRegions.length - 8} more</li>
                  )}
                </ul>
              </div>
            ) : result.voicedSec > 0.5 ? (
              <p className="text-xs text-muted-foreground">
                No long stretches stayed more than 50 cents away from the nearest chart frequency.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Verify by ear — pitch tracking can mis-hear noise, harmonics, or very quiet singing.
            </p>

            {chartAnchorsHz.length > 0 && (
              <PracticeRecordingPitchDotChart
                dots={pitchDots ?? []}
                chartAnchorsHz={chartAnchorsHz}
                maxDurationSec={contourDurationSec}
                chartColumnTitle={chartColumnTitle}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
