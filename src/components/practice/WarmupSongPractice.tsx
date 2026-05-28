"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShrutiDetectorPanel } from "@/components/practice/ShrutiDetectorPanel";
import { SingWithTalaStopwatch } from "@/components/practice/SingWithTalaStopwatch";
import { TalaHandTracker } from "@/components/practice/TalaHandTracker";
import {
  nominalHzForWarmupTanpuraKey,
  warmupShrutiSelectLabel,
} from "@/lib/audio/tanpura-manifest";
import {
  buildAllRatioSwaraSteps,
  buildPracticeRagaTargets,
  practiceRagaById,
} from "@/lib/practice-raga-scale";
import {
  practiceStepsToTunerNotes,
  SHIFFMAN_IN_TUNE_HZ,
  type ShiffmanNote,
} from "@/lib/audio/shiffman-pitch-tuner";
import { useShiffmanPitchTuner } from "@/hooks/useShiffmanPitchTuner";
import { useSingWithTalaStopwatch } from "@/hooks/useSingWithTalaStopwatch";
import { isSingTalaVoiceActive } from "@/lib/sing-tala-points";
import {
  isPracticeSessionFlow,
  practiceLiveHref,
  PRACTICE_SESSION_FLOW,
} from "@/lib/practice-modes";
import {
  clearSingTalaActiveSession,
  hasSingTalaActiveSession,
  markSingTalaSessionStarted,
} from "@/lib/sing-tala-active-session-storage";
import { addSingTalaPastSession } from "@/lib/sing-tala-session-storage";
import { syncLocalPracticeToServer } from "@/lib/sync-practice-to-server";
import { createClient } from "@/lib/supabase/client";
import styles from "@/components/practice/WarmupSongPractice.module.css";

/** Slow default for beginners on the song + tāla screen. */
const WARMUP_SONG_TALA_BPM = 52;
const MIN_SESSION_MS = 1000;

export function WarmupSongPractice({
  sessionId,
  tanpuraKey,
  ragaId,
}: {
  sessionId: string;
  tanpuraKey: string;
  ragaId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inSessionFlow = isPracticeSessionFlow(searchParams.get("flow"));
  const [shrutiEnabled, setShrutiEnabled] = useState(true);
  const [stopwatchArmed, setStopwatchArmed] = useState(false);
  const [continueSession, setContinueSession] = useState(false);
  const [ragaHighlight, setRagaHighlight] = useState(false);
  const [shrutiHighlight, setShrutiHighlight] = useState(false);

  useEffect(() => {
    setContinueSession(hasSingTalaActiveSession(sessionId));
  }, [sessionId]);

  const saHz = useMemo(() => nominalHzForWarmupTanpuraKey(tanpuraKey), [tanpuraKey]);
  const shrutiLabel = useMemo(() => warmupShrutiSelectLabel(tanpuraKey), [tanpuraKey]);
  const raga = useMemo(() => (ragaId ? practiceRagaById(ragaId) : null), [ragaId]);
  const ragaLabel = raga?.name ?? "Full swara chart";
  const ragaTargets = useMemo(
    () => (raga ? buildPracticeRagaTargets(raga, saHz) : null),
    [raga, saHz],
  );
  const allRatioSteps = useMemo(() => buildAllRatioSwaraSteps(saHz), [saHz]);
  const notes: ShiffmanNote[] = useMemo(
    () => practiceStepsToTunerNotes(ragaTargets?.meterTargets ?? allRatioSteps),
    [ragaTargets, allRatioSteps],
  );

  const tuner = useShiffmanPitchTuner(notes, true, {
    inTuneThresholdHz: SHIFFMAN_IN_TUNE_HZ,
  });

  const voiceNow = isSingTalaVoiceActive(tuner.inputRms, tuner.freq);

  const { elapsedMs, paused, waitingToStart, getElapsedMs } = useSingWithTalaStopwatch(
    sessionId,
    true,
    stopwatchArmed,
    voiceNow,
  );

  const shrutiHasPitch = tuner.freq > 0 && tuner.closest != null;
  const onPoint = shrutiHasPitch && tuner.inTune;

  const backToWarmup = () => {
    router.push(
      practiceLiveHref(sessionId, "warmup", {
        shruti: tanpuraKey,
        raga: ragaId || undefined,
        flow: inSessionFlow ? PRACTICE_SESSION_FLOW : undefined,
      }),
    );
  };

  const doneWithSession = async () => {
    const durationMs = getElapsedMs();
    if (durationMs >= MIN_SESSION_MS) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const saved = addSingTalaPastSession(user.id, {
          durationMs,
          raga: ragaLabel,
          shruti: shrutiLabel,
        });
        clearSingTalaActiveSession();
        if (saved) {
          void syncLocalPracticeToServer(user.id);
          router.push(`/practice/sing-tala/finish?pastId=${encodeURIComponent(saved.id)}`);
          return;
        }
      }
    }
    clearSingTalaActiveSession();
    router.push("/dashboard");
  };

  const shrutiAside = shrutiEnabled ? (
    <ShrutiDetectorPanel
      fillHeight
      saHz={saHz}
      enabled={shrutiEnabled}
      onEnabledChange={setShrutiEnabled}
      hasPitch={shrutiHasPitch}
      inTune={onPoint}
      onRagaHintActive={setRagaHighlight}
      onShrutiHintActive={setShrutiHighlight}
    />
  ) : null;

  return (
    <div className={styles.root}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={backToWarmup}>
          ← Back to warmup for your song
        </button>
        <div className={styles.topBarEnd}>
          {!shrutiEnabled ? (
            <button
              type="button"
              className={styles.showShrutiBtn}
              onClick={() => setShrutiEnabled(true)}
            >
              Show shruti detector
            </button>
          ) : null}
          <button type="button" className={styles.doneBtn} onClick={doneWithSession}>
            Done with session
          </button>
        </div>
      </div>

      <TalaHandTracker
        embedded
        defaultTempoBpm={WARMUP_SONG_TALA_BPM}
        gestureAside={shrutiAside}
        sessionMeta={{
          raga: ragaLabel,
          shruti: shrutiLabel,
          ragaHighlight,
          shrutiHighlight,
          stopwatch: (
            <SingWithTalaStopwatch
              elapsedMs={elapsedMs}
              paused={paused}
              waitingToStart={waitingToStart}
              continueSession={continueSession}
              onStart={() => {
                markSingTalaSessionStarted(sessionId);
                setContinueSession(true);
                setStopwatchArmed(true);
              }}
            />
          ),
        }}
      />
    </div>
  );
}
