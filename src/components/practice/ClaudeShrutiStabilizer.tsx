"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canonicalWarmupSwaraToken } from "@/lib/audio/swara-ratio-chart";
import { useRouter, useSearchParams } from "next/navigation";
import { useShiffmanPitchTuner } from "@/hooks/useShiffmanPitchTuner";
import {
  nominalHzForWarmupTanpuraKey,
  TANPURA_SAMPLE_MANIFEST,
  warmupShrutiSelectLabel,
} from "@/lib/audio/tanpura-manifest";
import {
  buildAllRatioSwaraSteps,
  buildPracticeRagaTargets,
  practiceRagaById,
  type PracticeSwaraStep,
} from "@/lib/practice-raga-scale";
import {
  practiceStepsToTunerNotes,
  tunerMeterGreenBandPercent,
  type ShiffmanNote,
} from "@/lib/audio/shiffman-pitch-tuner";
import { PITCH_INPUT_RMS_GATE } from "@/lib/audio/volume";
import { getRagaDisplayInfo } from "@/lib/raga-metadata";
import { SCALE_QUIZ_RAGAS } from "@/lib/scale-quiz-ragas";
import {
  WARMUP_RAGA_HELP_TEXT,
  WARMUP_RAGA_HELP_TOPICS,
  type WarmupRagaHelpTopic,
} from "@/lib/warmup-raga-help";
import styles from "@/components/practice/ClaudeShrutiStabilizer.module.css";
import {
  isPracticeSessionFlow,
  practiceLiveHref,
  PRACTICE_SESSION_FLOW,
} from "@/lib/practice-modes";
import { hasSingTalaActiveSession } from "@/lib/sing-tala-active-session-storage";
import { cn } from "@/lib/utils";

/** Short preview when tapping a swara in the scale grid. */
const SWARA_TAP_DURATION_SEC = 0.45;
/** Slightly longer for Play shruti. */
const SHRUTI_PLAY_DURATION_SEC = 0.9;

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

function playTone(
  ctx: AudioContext,
  freq: number,
  dur = SWARA_TAP_DURATION_SEC,
  waveform: OscillatorType = "triangle",
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const attack = Math.min(0.03, dur * 0.2);
  const release = Math.min(0.1, dur * 0.35);
  osc.type = waveform;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + attack);
  gain.gain.setValueAtTime(0.35, ctx.currentTime + dur - release);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur);
  return osc;
}

function SwaraCell({
  step,
  cur,
  hit,
  miss,
  playing,
  onPlay,
  compact,
}: {
  step: PracticeSwaraStep;
  cur: boolean;
  hit: boolean;
  miss: boolean;
  playing: boolean;
  onPlay: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        compact ? styles.notationCell : styles.cell,
        cur && styles.cellCur,
        hit && styles.cellHit,
        miss && styles.cellMiss,
        playing && styles.cellPlaying,
      )}
      onClick={onPlay}
      aria-label={`Play ${step.token}`}
    >
      <span className={compact ? styles.notationSname : styles.sname}>{step.token}</span>
      <span className={compact ? styles.notationPlayIcon : styles.playIcon} aria-hidden>
        ▶
      </span>
    </button>
  );
}

export function ClaudeShrutiStabilizer({
  sessionId,
  initialTanpuraKey,
  initialRagaId,
}: {
  sessionId: string;
  initialTanpuraKey: string;
  initialRagaId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inSessionFlow = isPracticeSessionFlow(searchParams.get("flow"));
  const [tanpuraKey, setTanpuraKey] = useState(initialTanpuraKey);
  const [ragaId, setRagaId] = useState(initialRagaId ?? "");
  const [listening, setListening] = useState(true);
  const [hasHeardInput, setHasHeardInput] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [helpTopic, setHelpTopic] = useState<WarmupRagaHelpTopic | null>(null);
  const [singTalaInProgress, setSingTalaInProgress] = useState(false);

  useEffect(() => {
    setSingTalaInProgress(hasSingTalaActiveSession(sessionId));
  }, [sessionId]);

  const raga = useMemo(() => (ragaId ? practiceRagaById(ragaId) : null), [ragaId]);
  const ragaMeta = useMemo(() => (raga ? getRagaDisplayInfo(raga) : null), [raga]);
  const saHz = useMemo(() => nominalHzForWarmupTanpuraKey(tanpuraKey), [tanpuraKey]);

  useEffect(() => {
    setHelpTopic(null);
  }, [ragaId]);

  const ragaTargets = useMemo(
    () => (raga ? buildPracticeRagaTargets(raga, saHz) : null),
    [raga, saHz],
  );

  const allRatioSteps = useMemo(() => buildAllRatioSwaraSteps(saHz), [saHz]);

  /** Shiffman `notes[]` — swara chart Hz at this shruti (`SWARA_RATIO` × mandra Sa). */
  const notes: ShiffmanNote[] = useMemo(
    () => practiceStepsToTunerNotes(ragaTargets?.meterTargets ?? allRatioSteps),
    [ragaTargets, allRatioSteps],
  );

  const tuner = useShiffmanPitchTuner(notes, listening);

  const hasPitch = tuner.freq > 0 && tuner.closest != null;
  const onPoint = hasPitch && tuner.inTune;

  useEffect(() => {
    if (!listening) {
      setHasHeardInput(false);
      return;
    }
    if (tuner.inputRms >= PITCH_INPUT_RMS_GATE) {
      setHasHeardInput(true);
    }
  }, [listening, tuner.inputRms]);

  const toneCtxRef = useRef<AudioContext | null>(null);

  const goToSongPractice = () => {
    router.push(
      practiceLiveHref(sessionId, "warmup", {
        view: "song",
        shruti: tanpuraKey,
        raga: ragaId || undefined,
        flow: inSessionFlow ? PRACTICE_SESSION_FLOW : undefined,
      }),
    );
  };

  const backToHoldSwara = () => {
    router.push(
      practiceLiveHref(sessionId, "hold-swara", {
        flow: PRACTICE_SESSION_FLOW,
        shruti: tanpuraKey,
        raga: ragaId || undefined,
      }),
    );
  };

  useEffect(() => {
    setTanpuraKey(initialTanpuraKey);
  }, [initialTanpuraKey]);

  useEffect(() => {
    if (initialRagaId) setRagaId(initialRagaId);
  }, [initialRagaId]);

  const onMicToggle = () => setListening((v) => !v);

  const getToneContext = useCallback(() => {
    if (!toneCtxRef.current || toneCtxRef.current.state === "closed") {
      toneCtxRef.current = new AudioContext();
    }
    return toneCtxRef.current;
  }, []);

  const playHz = useCallback(
    (
      hz: number,
      key: string,
      waveform: OscillatorType = "triangle",
      dur = SWARA_TAP_DURATION_SEC,
    ) => {
      const ctx = getToneContext();
      void ctx.resume();
      setPlayingKey(key);
      const osc = playTone(ctx, hz, dur, waveform);
      osc.onended = () => setPlayingKey((p) => (p === key ? null : p));
    },
    [getToneContext],
  );

  const playSa = useCallback(() => {
    playHz(saHz, "sa", "sine", SHRUTI_PLAY_DURATION_SEC);
  }, [playHz, saHz]);

  const needleLeft = `${tuner.needlePercent}%`;
  const meterBand = tunerMeterGreenBandPercent();
  const meterTrackStyle = {
    "--meter-out-left": `${meterBand.start}%`,
    "--meter-green-size": `${meterBand.end - meterBand.start}%`,
    "--meter-out-right": `${100 - meterBand.end}%`,
  } as React.CSSProperties;

  let pillClass = styles.pill;
  let pillLabel = listening ? (hasPitch ? "" : "Sing…") : "Mic off";
  let accent = "var(--foreground)";
  if (!listening) {
    pillLabel = "Mic off";
  } else if (!hasPitch) {
    pillLabel = "Sing…";
  } else if (onPoint) {
    pillClass = cn(styles.pill, styles.pillIn);
    pillLabel = "On swara ✓";
    accent = "var(--tuner-in)";
  } else if (tuner.recordDiff < 0) {
    pillClass = cn(styles.pill, styles.pillFlat);
    pillLabel = "Flat ♭";
    accent = "var(--tuner-out)";
  } else {
    pillClass = cn(styles.pill, styles.pillSharp);
    pillLabel = "Sharp ♯";
    accent = "var(--tuner-out)";
  }

  const tokenMatchesMeter = (token: string) =>
    tuner.closest != null &&
    canonicalWarmupSwaraToken(tuner.closest.closestNote.note) ===
      canonicalWarmupSwaraToken(token);

  const renderNotationRow = (label: string, steps: PracticeSwaraStep[], prefix: string) => (
    <div className={styles.notationLine}>
      <span className={styles.notationLbl}>{label}</span>
      <div className={styles.notationFlow}>
        {steps.map((step, i) => {
          const key = `${prefix}-${i}-${step.token}`;
          const cur = tokenMatchesMeter(step.token);
          const hit = cur && onPoint;
          const miss = cur && hasPitch && !onPoint;
          return (
            <SwaraCell
              key={key}
              step={step}
              cur={cur}
              hit={hit}
              miss={miss}
              playing={playingKey === key}
              compact
              onPlay={() => playHz(step.hz, key)}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={styles.root}>
      <button type="button" className={styles.flowBackBtn} onClick={backToHoldSwara}>
        ← Back to Hold the swara
      </button>

      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h2>Warmup for your song</h2>
          {raga ? <p className={styles.sub}>{raga.name}</p> : null}
        </div>
        <button type="button" className={styles.songReadyBtn} onClick={goToSongPractice}>
          {singTalaInProgress ? "Continue singing" : "Ready to sing"}
        </button>
      </div>

      <div className={styles.ctrlRow}>
        <div className={styles.ctrl}>
          <div className={styles.ctrlLbl}>Shruti (Sa)</div>
          <select
            className={styles.select}
            value={tanpuraKey}
            onChange={(e) => setTanpuraKey(e.target.value)}
          >
            {TANPURA_SAMPLE_MANIFEST.map((e) => (
              <option key={e.key} value={e.key}>
                {warmupShrutiSelectLabel(e.key)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.ctrl}>
          <div className={styles.ctrlLbl}>Rāga</div>
          <select
            className={styles.select}
            value={ragaId}
            onChange={(e) => setRagaId(e.target.value)}
          >
            <option value="">None — full swara chart</option>
            {SCALE_QUIZ_RAGAS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className={cn(
          styles.scaleInfoCard,
          !(raga && ragaMeta) && styles.scaleInfoCardHelpOnly,
        )}
      >
        {raga && ragaMeta ? (
          <div className={styles.scaleInfoMain}>
            {ragaMeta.parentMelakartaLine ? (
              <p>
                <strong>Melakarta / parent:</strong> {ragaMeta.parentMelakartaLine}
              </p>
            ) : null}
            <p>
              <strong>Classification:</strong> {ragaMeta.janyaLine}
            </p>
            {ragaMeta.ragaTypeLine ? (
              <p>
                <strong>Rāga type:</strong> {ragaMeta.ragaTypeLine}
              </p>
            ) : null}
          </div>
        ) : null}
        <div
          className={cn(
            styles.scaleInfoHelp,
            !(raga && ragaMeta) && styles.scaleInfoHelpStandalone,
          )}
        >
          {WARMUP_RAGA_HELP_TOPICS.map((topic) => (
            <button
              key={topic.id}
              type="button"
              className={cn(
                styles.helpBox,
                helpTopic === topic.id && styles.helpBoxActive,
              )}
              aria-expanded={helpTopic === topic.id}
              onClick={() =>
                setHelpTopic((cur) => (cur === topic.id ? null : topic.id))
              }
            >
              {topic.label}
            </button>
          ))}
        </div>
        {helpTopic ? (
          <div className={styles.scaleInfoExplanation} role="region" aria-live="polite">
            <p>{WARMUP_RAGA_HELP_TEXT[helpTopic]}</p>
          </div>
        ) : null}
      </div>

      <div className={styles.swaraTapBlock}>
        <div className={styles.tapToHearCallout} role="note">
          <span className={styles.tapToHearBadge} aria-hidden>
            ▶
          </span>
          <div>
            <p className={styles.tapToHearTitle}>Tap any swara to hear it</p>
            <p className={styles.tapToHearSub}>
              {ragaTargets
                ? "Each note in Arohanam and Avarohanam is a button — tap to preview, then sing to match."
                : "Each swara in the chart is a button — tap to preview, then sing to match."}
            </p>
          </div>
        </div>

        {ragaTargets ? (
          <div className={styles.notationSection}>
            {renderNotationRow("Arohanam:", ragaTargets.arohanamSteps, "aro")}
            {renderNotationRow("Avarohanam:", ragaTargets.avarohanamSteps, "ava")}
          </div>
        ) : (
          <div className={styles.sgridAboveTonic} role="group" aria-label="Full swara chart">
            {allRatioSteps.map((step, i) => {
              const cur = tokenMatchesMeter(step.token);
              const hit = cur && onPoint;
              const miss = cur && hasPitch && !onPoint;
              const key = `ratio-${i}-${step.token}`;
              return (
                <SwaraCell
                  key={key}
                  step={step}
                  cur={cur}
                  hit={hit}
                  miss={miss}
                  playing={playingKey === key}
                  compact
                  onPlay={() => playHz(step.hz, key)}
                />
              );
            })}
          </div>
        )}
      </div>

      <button type="button" className={styles.tonicStrip} onClick={playSa}>
        Play shruti
      </button>

      <div className={cn(styles.meterCard, styles.meterCardCompact)}>
        <div className={styles.snapLabel}>Nearest swara</div>
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
          {tuner.closest?.closestNote.note ?? "—"}
        </div>
        {listening && !hasHeardInput ? (
          <p className={styles.snapTargetHz}>
            Sing a note — matches nearest swara on your chart.
          </p>
        ) : null}

        <div className={styles.trackWrap}>
          <div className={styles.track} style={meterTrackStyle}>
            <div className={styles.zoneOut} aria-hidden />
            <div className={styles.zoneIn} aria-hidden />
            <div className={styles.zoneOut} aria-hidden />
          </div>
          <div className={styles.cmark} />
          <div className={styles.nlayer}>
            <div className={styles.needle} style={{ left: needleLeft, background: accent }} />
          </div>
        </div>
        <div className={styles.trackLbls}>
          <span>♭ Flat</span>
          <span>In tune</span>
          <span>Sharp ♯</span>
        </div>

        <span className={pillClass}>{pillLabel}</span>
      </div>

      <button
        type="button"
        className={cn(styles.micBtn, listening && styles.micBtnOn)}
        onClick={onMicToggle}
      >
        <MicIcon off={listening} />
        {listening ? "Stop listening" : "Start listening"}
      </button>
      {tuner.error ? <p className={styles.err}>{tuner.error}</p> : null}

      <p className={styles.tunerCredit}>
        Pitch detection follows Daniel Shiffman,&nbsp;
        <a
          href="https://thecodingtrain.com/CodingChallenges/151-ukulele-tuner.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          Coding Train #151 — Ukulele Tuner with CREPE
        </a>
        &nbsp;(
        <a
          href="https://youtu.be/F1OkDTUkKFo"
          target="_blank"
          rel="noopener noreferrer"
        >
          video
        </a>
        ,&nbsp;
        <a
          href="https://editor.p5js.org/codingtrain/sketches/8io2zvT03"
          target="_blank"
          rel="noopener noreferrer"
        >
          p5 sketch
        </a>
        ). CREPE model weights from ml5.js; swara targets are Carnatic ratios × your selected Sa.
      </p>
    </div>
  );
}


