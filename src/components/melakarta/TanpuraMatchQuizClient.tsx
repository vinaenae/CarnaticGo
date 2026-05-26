"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { TanpuraService } from "@/lib/audio/TanpuraService";
import {
  loadKritiGuessManifest,
  pickRandomKritiRound,
  type KritiGuessClip,
  type KritiGuessManifest,
} from "@/lib/kriti-guess-clips";
import {
  KRITI_TONIC_CLASSES,
  isKritiKattaiKey,
  kritiClassForTonic,
  shuffleKritiChoices,
  type KritiTonic,
} from "@/lib/kriti-tonic";
import { QuizPointsFloat } from "@/components/quizzes/QuizPointsFloat";
import { createQuizPointsPop, type QuizPointsPopState } from "@/lib/quiz-points";
import { recordQuizAttempt } from "@/lib/record-quiz-attempt";
import { trackUserActivity } from "@/lib/track-user-activity";
import { cn } from "@/lib/utils";
import { KritiSamhitaAttribution } from "@/components/melakarta/KritiSamhitaAttribution";
import { kritiClipCredit } from "@/lib/kriti-attribution";

type Phase = "loading" | "listening" | "result";

const SETUP_STEPS = [
  "Download Carnatic_Dataset_Snippets.zip from Mendeley (link below).",
  "Unzip into data/kriti-samhita/ (or run scripts/setup-kriti-quiz.ps1).",
  "python services/raga-classifier/scripts/export_kriti_guess_samples.py --dataset-dir data/kriti-samhita --per-tonic 20",
] as const;

function formatPct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function TanpuraMatchQuizClient() {
  const tanpuraRef = useRef<TanpuraService | null>(null);
  const [manifest, setManifest] = useState<KritiGuessManifest | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [clip, setClip] = useState<KritiGuessClip | null>(null);
  const [choices, setChoices] = useState([...KRITI_TONIC_CLASSES]);
  const [selected, setSelected] = useState<KritiTonic | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [firstPick, setFirstPick] = useState<KritiTonic | null>(null);
  const [won, setWon] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [pointsPop, setPointsPop] = useState<QuizPointsPopState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  useEffect(() => {
    const svc = new TanpuraService();
    tanpuraRef.current = svc;
    void svc.preload();
    return () => svc.stop();
  }, []);

  const startRound = useCallback(
    (m: KritiGuessManifest, excludeId?: string) => {
      const next = pickRandomKritiRound(m, excludeId);
      if (!next) {
        setError("no-clips");
        setPhase("loading");
        return;
      }
      setError(null);
      setAudioError(null);
      setClip(next);
      setChoices(shuffleKritiChoices(KRITI_TONIC_CLASSES));
      setSelected(null);
      setFirstPick(null);
      setAttempt(1);
      setWon(false);
      setPhase("listening");
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      const m = await loadKritiGuessManifest();
      setManifest(m);
      if (!m) {
        setError("no-clips");
        setPhase("loading");
        return;
      }
      startRound(m);
    })();
  }, [startRound]);

  const previewTanpura = (kattaiKey: string) => {
    const svc = tanpuraRef.current;
    if (!svc) return;
    if (!isKritiKattaiKey(kattaiKey)) return;
    setPreviewKey(kattaiKey);
    svc.playPreview(kattaiKey, 2500);
    window.setTimeout(() => setPreviewKey(null), 2600);
  };

  const finishRound = async (correct: boolean, pick: KritiTonic) => {
    setSelected(pick);
    setWon(correct);
    setScore((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      total: s.total + 1,
    }));
    setPointsPop(createQuizPointsPop(correct));
    setPhase("result");
    void recordQuizAttempt(correct).then(() => trackUserActivity());
    tanpuraRef.current?.stop();
  };

  const submitPick = async (tonic: KritiTonic) => {
    if (!clip || phase !== "listening") return;
    if (tonic === clip.tonic) {
      await finishRound(true, tonic);
      return;
    }
    if (attempt >= 2) {
      await finishRound(false, tonic);
      return;
    }
    setAttempt(2);
    setFirstPick(tonic);
    setSelected(null);
  };

  const nextRound = () => {
    if (!manifest) return;
    startRound(manifest, clip?.id);
  };

  if (phase === "loading" || !manifest) {
    return (
      <section className="rounded-2xl border border-border bg-card/60 p-8 space-y-4">
        <p className="text-sm text-muted-foreground">
          {error === "no-clips"
            ? "No KritiSamhita clips are in public/assets/kriti-guess yet."
            : (error ?? "Loading clips…")}
        </p>
        {error === "no-clips" && (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <a
                href="https://data.mendeley.com/datasets/nkdm57hvw3/2"
                className="text-primary underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download the dataset
              </a>
              , then export quiz clips:
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              {SETUP_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs text-foreground whitespace-pre-wrap break-words">
              {SETUP_STEPS[2]}
            </pre>
            <p className="text-xs">
              Or run{" "}
              <code className="rounded bg-muted px-1 py-0.5">.\scripts\setup-kriti-quiz.ps1</code>{" "}
              if the zip is already in your Downloads folder.
            </p>
          </div>
        )}
      </section>
    );
  }

  const answerClass = kritiClassForTonic(clip?.tonic ?? "G");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Score:{" "}
          <span className="font-semibold text-foreground">
            {score.correct}/{score.total}
          </span>
          {score.total > 0 && (
            <span className="ml-1">({formatPct(score.correct / score.total)})</span>
          )}
        </p>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← Home
        </Link>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card/80 p-6 shadow-sm">
        {pointsPop != null ? (
          <QuizPointsFloat
            key={pointsPop.id}
            popId={pointsPop.id}
            delta={pointsPop.delta}
            onDone={() => setPointsPop(null)}
          />
        ) : null}
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Guess the shruti
        </p>
        <h2 className="font-heading mt-1 text-2xl font-semibold text-foreground">
          Which shruti matches this singing?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Two attempts per round.
        </p>

        {clip?.url && (
          <div className="mt-6">
            <audio
              key={clip.url}
              controls
              src={clip.url}
              className="w-full max-w-md"
              preload="auto"
              onError={() =>
                setAudioError(
                  "Could not load this clip. Pull latest main or refresh — quiz audio may be missing on deploy.",
                )
              }
            >
              Your browser does not support audio.
            </audio>
            {audioError ? (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {audioError}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              {kritiClipCredit(clip.songName)}
            </p>
          </div>
        )}

        {phase === "listening" && (
          <div className="mt-6 space-y-3">
            <p className="text-sm font-medium text-foreground">Choose a tanpura</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {choices.map((opt) => (
                <li key={opt.tonic}>
                  <div
                    className={cn(
                      "flex items-stretch overflow-hidden rounded-xl border transition-colors",
                      selected === opt.tonic
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background/60",
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col items-start px-4 py-3 text-left hover:bg-primary/5"
                      onClick={() => submitPick(opt.tonic)}
                    >
                      <span className="font-medium text-foreground">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">Submit this shruti</span>
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "shrink-0 border-l border-border px-3 text-xs font-medium transition-colors hover:bg-muted/80",
                        previewKey === opt.kattaiKey && "bg-primary/10 text-primary",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        previewTanpura(opt.kattaiKey);
                      }}
                      aria-label={`Preview tanpura at ${opt.label}`}
                    >
                      ▶ Drone
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Attempt {attempt} of 2
              {attempt === 2 && firstPick && (
                <>
                  {" "}
                  · first pick:{" "}
                  <span className="font-medium text-foreground">
                    {kritiClassForTonic(firstPick).label}
                  </span>
                </>
              )}
            </p>
          </div>
        )}

        {phase === "result" && clip && (
          <div
            className={cn(
              "mt-6 rounded-xl border p-4",
              won
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-destructive/35 bg-destructive/5",
            )}
          >
            <p
              className={cn(
                "font-heading text-xl font-semibold",
                won ? "text-emerald-700 dark:text-emerald-400" : "text-destructive",
              )}
            >
              {won ? "Correct!" : "Not quite"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              This clip is in{" "}
              <span className="font-medium text-foreground">{answerClass.label}</span>.{" "}
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => previewTanpura(clip.kattaiKey)}
              >
                Hear matching tanpura
              </button>
              {!won && firstPick && selected && (
                <>
                  {" "}
                  Your picks:{" "}
                  <span className="font-medium text-foreground">
                    {kritiClassForTonic(firstPick).label}, {kritiClassForTonic(selected).label}
                  </span>
                  .
                </>
              )}
            </p>
            <Button type="button" className="mt-4" size="lg" onClick={nextRound}>
              Next clip
            </Button>
          </div>
        )}
      </section>

      <KritiSamhitaAttribution manifest={manifest} />
    </div>
  );
}
