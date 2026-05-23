"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SingAlongMicRecorder } from "@/components/singalong/SingAlongMicRecorder";
import { SingAlongMismatchClips } from "@/components/singalong/SingAlongMismatchClips";
import { nominalHzForWarmupTanpuraKey } from "@/lib/audio/tanpura-manifest";
import { buildAlignedPitchRows } from "@/lib/singalong/aligned-pitch-rows";
import { decodeAudioBlob, boostSamplesForPitchAnalysis } from "@/lib/audio/decodeAudioBlob";
import { recordingBlobToWav } from "@/lib/audio/recordingToWav";
import { detectTonicFromBlob } from "@/lib/tonic-detector-client";
import {
  kritiClassForTonic,
  parseKritiTonicLabel,
} from "@/lib/kriti-tonic";
import { useSingAlongRecorder } from "@/hooks/useSingAlongRecorder";
import {
  buildPitchContourForSingAlongWithEngine,
  CrepePitchError,
  type SingAlongPitchEngine,
} from "@/lib/audio/crepe-pitch-client";
import {
  compareTeacherStudentPitchContours,
  computeDtwChartAlignment,
  contourHasEnoughVoicingRaw,
  contourToChartPoints,
  type DtwChartAlignment,
  type RawPitchContour,
  type TeacherStudentPitchAnalysis,
} from "@/lib/audio/pitchContour";
import { pickSingAlongClipSections } from "@/lib/singalong/mismatch-clips";
import { safePause, safePlay } from "@/lib/audio/safeMediaPlayback";
import { cn } from "@/lib/utils";
import type { TonicDetectResponse } from "@/types/tonic-detector";

type RefShrutiMatch = {
  klass: ReturnType<typeof kritiClassForTonic>;
  confidence: number;
  response: TonicDetectResponse;
};

type LoadedClip = {
  name: string;
  url: string;
  durationSec: number;
  samples: Float32Array;
  sampleRate: number;
  pitchContour: RawPitchContour;
  pitchEngine: SingAlongPitchEngine;
};

function formatShrutiConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

function tonicLabelFromResponse(pred: TonicDetectResponse) {
  const parsed =
    parseKritiTonicLabel(pred.tonic) ??
    parseKritiTonicLabel(`${pred.tonic} Scale (${pred.kattai} Kattai)`);
  return parsed ? kritiClassForTonic(parsed) : null;
}

async function blobForTonicDetection(file: File): Promise<Blob> {
  return file.type.includes("wav") ? file : recordingBlobToWav(file);
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
}

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${r.toString().padStart(2, "0")}` : `${r}s`;
}

export function TeacherSingAlongClient() {
  const refInputRef = useRef<HTMLInputElement>(null);
  const userInputRef = useRef<HTMLInputElement>(null);
  const refAudioRef = useRef<HTMLAudioElement>(null);
  const userAudioRef = useRef<HTMLAudioElement>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const [refClip, setRefClip] = useState<LoadedClip | null>(null);
  const [userClip, setUserClip] = useState<LoadedClip | null>(null);
  const [refErr, setRefErr] = useState<string | null>(null);
  const [userErr, setUserErr] = useState<string | null>(null);
  const [extractingRef, setExtractingRef] = useState(false);
  const [extractingUser, setExtractingUser] = useState(false);

  const [playingRef, setPlayingRef] = useState(false);
  const [playingUser, setPlayingUser] = useState(false);

  const [pitchEngine, setPitchEngine] = useState<SingAlongPitchEngine | null>(null);
  const [refShruti, setRefShruti] = useState<RefShrutiMatch | null>(null);
  const [refShrutiError, setRefShrutiError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<TeacherStudentPitchAnalysis | null>(null);
  const [analyzingCompare, setAnalyzingCompare] = useState(false);

  const userRecorder = useSingAlongRecorder();
  const refRecorder = useSingAlongRecorder();
  const micBusy =
    userRecorder.phase === "recording" || refRecorder.phase === "recording";

  const revokeAllUrls = useCallback(() => {
    for (const u of objectUrlsRef.current) URL.revokeObjectURL(u);
    objectUrlsRef.current = [];
  }, []);

  useEffect(() => () => revokeAllUrls(), [revokeAllUrls]);

  const loadFromSamples = async (
    samples: Float32Array,
    sampleRate: number,
    name: string,
    which: "ref" | "user",
    playbackUrl: string,
    tonicBlob?: Blob,
  ): Promise<LoadedClip | null> => {
    if (which === "ref") {
      setExtractingRef(true);
    } else {
      setExtractingUser(true);
    }
    if (which === "ref") {
      setRefErr(null);
      setRefShruti(null);
      setRefShrutiError(null);
    } else {
      setUserErr(null);
    }

    const classifyRefShruti = async () => {
      if (!tonicBlob) return;
      try {
        const pred = await detectTonicFromBlob(tonicBlob);
        const klass = tonicLabelFromResponse(pred);
        if (!klass) {
          setRefShruti(null);
          setRefShrutiError("Could not map the detected shruti.");
          return;
        }
        setRefShruti({ klass, confidence: pred.confidence, response: pred });
        setRefShrutiError(null);
      } catch (e) {
        setRefShruti(null);
        setRefShrutiError(
          e instanceof Error
            ? e.message
            : "Shruti detection failed. Restart dev if the tonic service is offline.",
        );
      }
    };

    try {
      const durationSec = samples.length / sampleRate;
      if (durationSec > 8 * 60) {
        const msg = "Please use clips under 8 minutes.";
        if (which === "ref") setRefErr(msg);
        else setUserErr(msg);
        return null;
      }

      const analysisSamples = boostSamplesForPitchAnalysis(samples);
      const [{ contour, engine }, _shruti] = await Promise.all([
        buildPitchContourForSingAlongWithEngine(analysisSamples, sampleRate),
        which === "ref" ? classifyRefShruti() : Promise.resolve(),
      ]);

      setPitchEngine((prev) => (prev === "yin" || engine === "yin" ? "yin" : "crepe"));

      if (!contourHasEnoughVoicingRaw(contour, 8)) {
        const msg = "Very little pitch detected — try a clearer vocal-only take.";
        if (which === "ref") setRefErr(msg);
        else setUserErr(msg);
      }

      objectUrlsRef.current.push(playbackUrl);
      return {
        name,
        url: playbackUrl,
        durationSec,
        samples: analysisSamples,
        sampleRate,
        pitchContour: contour,
        pitchEngine: engine,
      };
    } catch (e) {
      const msg =
        e instanceof CrepePitchError
          ? e.message
          : "Could not decode or analyze this file. Try WAV, MP3, or M4A.";
      if (which === "ref") setRefErr(msg);
      else setUserErr(msg);
      return null;
    } finally {
      if (which === "ref") setExtractingRef(false);
      else setExtractingUser(false);
    }
  };

  const loadClip = async (file: File, which: "ref" | "user"): Promise<LoadedClip | null> => {
    try {
      const dec = await decodeAudioBlob(file);
      const url = URL.createObjectURL(file);
      const tonicBlob = which === "ref" ? await blobForTonicDetection(file) : undefined;
      return loadFromSamples(dec.samples, dec.sampleRate, file.name, which, url, tonicBlob);
    } catch {
      const msg = "Could not decode this file. Try WAV, MP3, or M4A.";
      if (which === "ref") setRefErr(msg);
      else setUserErr(msg);
      return null;
    }
  };

  const onPickRef = async (list: FileList | null) => {
    const file = list?.item(0);
    if (!file) return;
    refRecorder.reset();
    const clip = await loadClip(file, "ref");
    if (clip) setRefClip(clip);
  };

  const onPickUser = async (list: FileList | null) => {
    const file = list?.item(0);
    if (!file) return;
    userRecorder.reset();
    const clip = await loadClip(file, "user");
    if (clip) setUserClip(clip);
  };

  const applyRefRecordingForAnalysis = async () => {
    if (refRecorder.phase !== "recorded" || !refRecorder.previewUrl) return;
    const { samples, sampleRate } = refRecorder.getRecording();
    const clip = await loadFromSamples(
      samples,
      sampleRate,
      `reference-${Math.round(refRecorder.elapsedMs / 1000)}s.wav`,
      "ref",
      refRecorder.previewUrl,
      refRecorder.wavBlob ?? undefined,
    );
    if (clip) setRefClip(clip);
  };

  const applyUserRecordingForAnalysis = async () => {
    if (userRecorder.phase !== "recorded" || !userRecorder.previewUrl) return;
    const { samples, sampleRate } = userRecorder.getRecording();
    const clip = await loadFromSamples(
      samples,
      sampleRate,
      `sing-along-${Math.round(userRecorder.elapsedMs / 1000)}s.wav`,
      "user",
      userRecorder.previewUrl,
    );
    if (clip) setUserClip(clip);
  };

  useEffect(() => {
    if (!refClip || !userClip) {
      setAnalysis(null);
      setAnalyzingCompare(false);
      return;
    }

    let cancelled = false;
    setAnalyzingCompare(true);
    setAnalysis(null);

    const timer = window.setTimeout(() => {
      const result = compareTeacherStudentPitchContours(
        refClip.pitchContour,
        userClip.pitchContour,
        refClip.durationSec,
        userClip.durationSec,
      );
      if (!cancelled) {
        setAnalysis(result);
        setAnalyzingCompare(false);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [refClip, userClip]);

  const dtwAlignment = useMemo((): DtwChartAlignment | null => {
    if (!refClip || !userClip) return null;
    const refPts = contourToChartPoints(refClip.pitchContour);
    const userPts = contourToChartPoints(userClip.pitchContour);
    return computeDtwChartAlignment(refPts, userPts);
  }, [refClip, userClip]);

  const alignedPitchRows = useMemo(() => {
    if (!refClip || !userClip) return null;
    return buildAlignedPitchRows(refClip.pitchContour, userClip.pitchContour);
  }, [refClip, userClip]);

  const saHzForClips = useMemo(() => {
    if (!refShruti) return null;
    return nominalHzForWarmupTanpuraKey(refShruti.klass.kattaiKey);
  }, [refShruti]);

  const clipSections = useMemo(() => {
    if (!analysis || !refClip || !userClip) {
      return { stable: [], contour: [], flat: [] };
    }
    return pickSingAlongClipSections(
      analysis,
      refClip.durationSec,
      alignedPitchRows,
      saHzForClips,
      dtwAlignment,
      userClip.pitchContour,
    );
  }, [analysis, refClip, userClip, alignedPitchRows, saHzForClips, dtwAlignment]);

  const stopAllAudio = useCallback(() => {
    safePause(refAudioRef.current);
    safePause(userAudioRef.current);
    setPlayingRef(false);
    setPlayingUser(false);
  }, []);

  const togglePlay = (which: "ref" | "user") => {
    const el = which === "ref" ? refAudioRef.current : userAudioRef.current;
    if (!el) return;
    if (which === "ref") {
      if (playingRef) {
        safePause(el);
        setPlayingRef(false);
      } else {
        void safePlay(el);
        setPlayingRef(true);
        setPlayingUser(false);
        safePause(userAudioRef.current);
      }
    } else if (playingUser) {
      safePause(el);
      setPlayingUser(false);
    } else {
      void safePlay(el);
      setPlayingUser(true);
      setPlayingRef(false);
      safePause(refAudioRef.current);
    }
  };

  const resetAll = () => {
    stopAllAudio();
    revokeAllUrls();
    setRefClip(null);
    setUserClip(null);
    setRefErr(null);
    setUserErr(null);
    setPlayingRef(false);
    setPlayingUser(false);
    setPitchEngine(null);
    setRefShruti(null);
    setRefShrutiError(null);
    setAnalysis(null);
    setExtractingRef(false);
    setExtractingUser(false);
    if (refInputRef.current) refInputRef.current.value = "";
    if (userInputRef.current) userInputRef.current.value = "";
    userRecorder.reset();
    refRecorder.reset();
  };

  const pitchEngineLabel =
    pitchEngine === "crepe" ? "CREPE" : pitchEngine === "yin" ? "YIN fallback" : "—";

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Home
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reference clip</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SingAlongMicRecorder
              recorder={refRecorder}
              disabled={micBusy && refRecorder.phase !== "recording"}
              isExtracting={extractingRef}
              onUseForAnalysis={() => void applyRefRecordingForAnalysis()}
              downloadFilenamePrefix="reference"
            />
            {!extractingRef ? (
              <>
                <p className="text-center text-xs text-muted-foreground">or upload a file</p>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={micBusy}
                  onClick={() => refInputRef.current?.click()}
                >
                  Upload reference
                </Button>
                <input
                  ref={refInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => void onPickRef(e.target.files)}
                />
              </>
            ) : null}
            {refClip && (
              <p className="text-sm text-muted-foreground">
                {refClip.name} · {formatTime(refClip.durationSec)}
              </p>
            )}
            {refShruti && (
              <div className="rounded-lg border border-primary/25 bg-primary/8 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Detected shruti — match this in your singing
                </p>
                <p className="mt-1 font-heading text-xl font-semibold text-foreground">
                  {refShruti.klass.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatShrutiConfidence(refShruti.confidence)} confident
                </p>
              </div>
            )}
            {refShrutiError && !refShruti && refClip && (
              <p className="text-sm text-amber-800 dark:text-amber-200">{refShrutiError}</p>
            )}
            {refErr && <p className="text-sm text-destructive">{refErr}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your singing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SingAlongMicRecorder
              recorder={userRecorder}
              disabled={micBusy && userRecorder.phase !== "recording"}
              isExtracting={extractingUser}
              onUseForAnalysis={() => void applyUserRecordingForAnalysis()}
              downloadFilenamePrefix="sing-along"
            />
            {!extractingUser ? (
              <>
                <p className="text-center text-xs text-muted-foreground">or upload a file</p>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={micBusy}
                  onClick={() => userInputRef.current?.click()}
                >
                  Upload your clip
                </Button>
                <input
                  ref={userInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => void onPickUser(e.target.files)}
                />
              </>
            ) : null}
            {userClip && (
              <p className="text-sm text-muted-foreground">
                {userClip.name} · {formatTime(userClip.durationSec)}
              </p>
            )}
            {userErr && <p className="text-sm text-destructive">{userErr}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Where to listen closely</CardTitle>
          <CardDescription>
            Short reference clips where your take differed — stable swara landings, melodic contour,
            or flat vs moving pitch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pitchEngine && (
            <p className="text-sm">
              <Badge variant={pitchEngine === "yin" ? "secondary" : "default"}>
                Pitch analysis: {pitchEngineLabel}
              </Badge>
              {pitchEngine === "yin" && (
                <span className="ml-2 text-muted-foreground">
                  CREPE service not reachable — start npm run dev (crepe-pitch).
                </span>
              )}
            </p>
          )}

          {refClip && userClip && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={playingRef ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => togglePlay("ref")}
              >
                {playingRef ? <Pause className="size-4" /> : <Play className="size-4" />}
                Full reference
              </Button>
              <Button
                type="button"
                variant={playingUser ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => togglePlay("user")}
              >
                {playingUser ? <Pause className="size-4" /> : <Play className="size-4" />}
                Full take
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={resetAll}>
                Reset all
              </Button>
            </div>
          )}

          {refClip && <audio ref={refAudioRef} src={refClip.url} preload="metadata" className="hidden" />}
          {userClip && (
            <audio ref={userAudioRef} src={userClip.url} preload="metadata" className="hidden" />
          )}

          {!refClip || !userClip ? (
            <p className="text-sm text-muted-foreground">
              Add reference and your singing to analyze pitch and hear mismatch highlights.
            </p>
          ) : (
            <>
              <SingAlongMismatchClips
                refAudioUrl={refClip.url}
                userAudioUrl={userClip.url}
                alignment={dtwAlignment}
                sections={clipSections}
                loading={analyzingCompare}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
