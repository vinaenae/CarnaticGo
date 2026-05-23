"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useShiffmanPitchTuner } from "@/hooks/useShiffmanPitchTuner";
import {
  readHoldSwaraBestSeconds,
  writeHoldSwaraBestSeconds,
} from "@/lib/hold-swara-storage";
import {
  nominalHzForWarmupTanpuraKey,
  TANPURA_SAMPLE_MANIFEST,
  warmupShrutiSelectLabel,
} from "@/lib/audio/tanpura-manifest";
import {
  HOLD_SWARA_IN_TUNE_HZ,
  tunerMeterGreenBandPercent,
} from "@/lib/audio/shiffman-pitch-tuner";
import { practiceLiveHref, PRACTICE_SESSION_FLOW } from "@/lib/practice-modes";
import {
  readPracticeConfig,
  writePracticeConfig,
} from "@/lib/practice-storage";
import holdStyles from "@/components/practice/HoldSwaraExercise.module.css";
import styles from "@/components/practice/ClaudeShrutiStabilizer.module.css";
import { cn } from "@/lib/utils";

const SHRUTI_PLAY_DURATION_SEC = 0.9;
/** Ignore mic pitch after Play Sa (speaker bleed). */
const PLAY_SA_IGNORE_MS = SHRUTI_PLAY_DURATION_SEC * 1000 + 500;

function MicIcon({ off }: { off?: boolean }) {
  if (off) {
    return (
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8}>
        <line x1={1} y1={1} x2={23} y2={23} />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2" />
        <line x1={12} y1={19} x2={12} y2={22} />
        <line x1={9} y1={22} x2={15} y2={22} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x={9} y={2} width={6} height={11} rx={3} />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1={12} y1={19} x2={12} y2={22} />
      <line x1={9} y1={22} x2={15} y2={22} />
    </svg>
  );
}

function playTone(ctx: AudioContext, freq: number, dur: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const attack = Math.min(0.03, dur * 0.2);
  const release = Math.min(0.1, dur * 0.35);
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + attack);
  gain.gain.setValueAtTime(0.35, ctx.currentTime + dur - release);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}

function formatHoldSeconds(sec: number): string {
  if (sec < 10) return sec.toFixed(1);
  return Math.floor(sec).toString();
}

export function HoldSwaraExercise({
  initialTanpuraKey,
  sessionId,
}: {
  initialTanpuraKey: string;
  sessionId: string;
}) {
  const router = useRouter();
  const [tanpuraKey, setTanpuraKey] = useState(initialTanpuraKey);
  const [listening, setListening] = useState(true);
  const [bestSec, setBestSec] = useState(0);
  const [currentHoldSec, setCurrentHoldSec] = useState(0);
  /** Timestamp (ms) until which mic pitch is ignored (Play Sa bleed). */
  const [ignorePitchUntil, setIgnorePitchUntil] = useState(0);

  const saHz = useMemo(() => nominalHzForWarmupTanpuraKey(tanpuraKey), [tanpuraKey]);
  const notes = useMemo(() => [{ note: "Sa", freq: saHz }] as const, [saHz]);
  const tuner = useShiffmanPitchTuner(notes, listening, {
    inTuneThresholdHz: HOLD_SWARA_IN_TUNE_HZ,
  });

  const toneCtxRef = useRef<AudioContext | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const bestSecRef = useRef(0);

  useEffect(() => {
    setBestSec(readHoldSwaraBestSeconds(tanpuraKey));
  }, [tanpuraKey]);

  useEffect(() => {
    bestSecRef.current = bestSec;
  }, [bestSec]);

  const pitchFromUser =
    ignorePitchUntil <= 0 || performance.now() >= ignorePitchUntil;
  const hasPitch = pitchFromUser && tuner.freq > 0 && tuner.closest != null;
  const onPoint = hasPitch && tuner.inTune;
  const holding = listening && onPoint;

  useEffect(() => {
    if (ignorePitchUntil <= 0 || performance.now() >= ignorePitchUntil) return;
    const delay = ignorePitchUntil - performance.now();
    const t = window.setTimeout(() => setIgnorePitchUntil(0), delay);
    return () => clearTimeout(t);
  }, [ignorePitchUntil]);

  const resetHold = useCallback(() => {
    if (holdStartRef.current != null) {
      const elapsed = (performance.now() - holdStartRef.current) / 1000;
      if (elapsed > bestSecRef.current) {
        writeHoldSwaraBestSeconds(tanpuraKey, elapsed);
        setBestSec(elapsed);
      }
    }
    holdStartRef.current = null;
    setCurrentHoldSec(0);
  }, [tanpuraKey]);

  useEffect(() => {
    if (!holding) {
      if (holdStartRef.current != null) resetHold();
      return;
    }

    if (holdStartRef.current == null) {
      holdStartRef.current = performance.now();
    }

    let raf = 0;
    const tick = () => {
      if (holdStartRef.current == null) return;
      setCurrentHoldSec((performance.now() - holdStartRef.current) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [holding, resetHold]);

  const onShrutiChange = useCallback(
    (key: string) => {
      setTanpuraKey(key);
      const existing = readPracticeConfig(sessionId);
      if (existing) {
        writePracticeConfig(sessionId, { ...existing, tanpuraKey: key });
      }
    },
    [sessionId],
  );

  const onMicToggle = () => setListening((v) => !v);

  const playSa = useCallback(() => {
    setIgnorePitchUntil(performance.now() + PLAY_SA_IGNORE_MS);
    resetHold();

    if (!toneCtxRef.current || toneCtxRef.current.state === "closed") {
      toneCtxRef.current = new AudioContext();
    }
    const ctx = toneCtxRef.current;
    void ctx.resume();
    playTone(ctx, saHz, SHRUTI_PLAY_DURATION_SEC);
  }, [saHz, resetHold]);

  const needleLeft = `${tuner.needlePercent}%`;
  const meterBand = tunerMeterGreenBandPercent(HOLD_SWARA_IN_TUNE_HZ);
  const meterTrackStyle = {
    "--meter-out-left": `${meterBand.start}%`,
    "--meter-green-size": `${meterBand.end - meterBand.start}%`,
    "--meter-out-right": `${100 - meterBand.end}%`,
  } as React.CSSProperties;

  let accent = "var(--foreground)";
  if (onPoint) accent = "var(--tuner-in)";
  else if (hasPitch) accent = "var(--tuner-out)";

  const bestLabel = bestSec > 0 ? formatHoldSeconds(bestSec) : "—";
  const statusLabel = !listening
    ? "Mic off"
    : !pitchFromUser
      ? "Listen for your voice…"
      : !hasPitch
        ? "Sing Sa…"
        : onPoint
          ? "Holding Sa"
          : "Adjust pitch";

  return (
    <div className={holdStyles.root}>
      <p className={holdStyles.bestBanner} aria-live="polite">
        Best attempt: <strong>{bestLabel}</strong>
        {bestSec > 0 ? " seconds" : ""}
      </p>

      <div className={styles.header}>
        <h2>Hold the swara</h2>
        <p className={styles.sub}>Sustain base Sa without breaking pitch</p>
      </div>

      <p className={holdStyles.instructions}>
        Choose your shruti, then hold a steady <strong>Sa</strong> on the mic. The timer counts
        only while you sing Sa in tune; any slip resets it. <strong>Play Sa</strong> is for
        reference only — it does not start the timer.
      </p>

      <div className={styles.ctrlRow}>
        <div className={styles.ctrl}>
          <div className={styles.ctrlLbl}>Shruti (Sa)</div>
          <select
            className={styles.select}
            value={tanpuraKey}
            onChange={(e) => onShrutiChange(e.target.value)}
          >
            {TANPURA_SAMPLE_MANIFEST.map((e) => (
              <option key={e.key} value={e.key}>
                {warmupShrutiSelectLabel(e.key)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p
        className={cn(holdStyles.holdTimer, holding && holdStyles.holdTimerActive)}
        aria-live="polite"
      >
        {holding ? formatHoldSeconds(currentHoldSec) : "0.0"} s
      </p>
      <p className={holdStyles.holdHint} aria-live="polite">
        {holding ? "Keep singing…" : statusLabel}
      </p>

      <button type="button" className={styles.tonicStrip} onClick={playSa}>
        Play Sa
      </button>

      <div className={holdStyles.miniMeterOuter} aria-hidden={!listening}>
        <div className={holdStyles.miniMeterInner}>
          <div className={cn(styles.meterCard, styles.meterCardCompact)}>
            <div
              className={styles.snapName}
              style={{
                color: hasPitch
                  ? onPoint
                    ? "var(--tuner-in)"
                    : "var(--tuner-out)"
                  : undefined,
              }}
            >
              Sa
            </div>
            <div className={styles.trackWrap}>
              <div className={styles.track} style={meterTrackStyle}>
                <div className={styles.zoneOut} aria-hidden />
                <div className={styles.zoneIn} aria-hidden />
                <div className={styles.zoneOut} aria-hidden />
              </div>
              <div className={styles.cmark} />
              <div className={styles.nlayer}>
                <div
                  className={styles.needle}
                  style={{ left: needleLeft, background: accent }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={cn(styles.micBtn, listening && styles.micBtnOn)}
        onClick={onMicToggle}
      >
        <MicIcon off={listening} />
        {listening ? "Stop listening" : "Start listening"}
      </button>

      <button
        type="button"
        className={holdStyles.nextBtn}
        onClick={() => {
          const cfg = readPracticeConfig(sessionId);
          router.push(
            practiceLiveHref(sessionId, "warmup", {
              flow: PRACTICE_SESSION_FLOW,
              shruti: cfg?.tanpuraKey ?? tanpuraKey,
              raga: cfg?.ragaId,
            }),
          );
        }}
      >
        Next — warmup for your song
      </button>

      {tuner.error ? <p className={styles.err}>{tuner.error}</p> : null}
    </div>
  );
}
