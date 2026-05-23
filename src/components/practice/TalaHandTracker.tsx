"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  buildTalaBeatCycle,
  CARNATIC_JATIS,
  CARNATIC_TALAS,
  countFingerMeshIndex,
  countFingerShort,
  gestureLabel,
  talaById,
  talaJatiLabel,
  totalBeatsForTalaJati,
  type JatiId,
  type TalaBeatStep,
  type TalaId,
} from "@/lib/carnatic-tala";
import { CARNATIC_KAALAS, kaalaById, type KaalaId } from "@/lib/carnatic-kaala";
import { playTalaLandClick } from "@/lib/audio/tala-beat-click";
import { DEFAULT_PRACTICE_BPM } from "@/lib/practice-storage";
import { MusicTermTip } from "@/components/practice/MusicTermTip";
import { TalaHand3D } from "@/components/practice/TalaHand3D";
import styles from "@/components/practice/TalaHandTracker.module.css";
import { cn } from "@/lib/utils";

/** Single = one hand land per beat; double = land on every kāla syllable. Audio always follows kāla. */
export type TalaLandMode = "single" | "double";

const LAND_MODES: { id: TalaLandMode; label: string; description: string }[] = [
  {
    id: "single",
    label: "Single",
    description: "Hand lands once per beat at 2nd/3rd speed.",
  },
  {
    id: "double",
    label: "Double",
    description: "Hand lands on every note (2x or 4x per beat at 2nd/3rd speed).",
  },
];

export function TalaHandTracker({
  embedded = false,
  defaultTempoBpm,
  gestureAside,
  sessionMeta,
}: {
  /** Compact layout for warmup song split screen (tāla takes most of the width). */
  embedded?: boolean;
  defaultTempoBpm?: number;
  /** Renders above the laghu/clap block inside the right-hand gesture column (e.g. shruti detector). */
  gestureAside?: React.ReactNode;
  /** Replaces notation/beat meta row on sing-with-tāla (embedded) only. */
  sessionMeta?: {
    raga: string;
    shruti: string;
    ragaHighlight?: boolean;
    shrutiHighlight?: boolean;
    stopwatch?: ReactNode;
  };
} = {}) {
  const [talaId, setTalaId] = useState<TalaId>("triputa");
  const [jatiId, setJatiId] = useState<JatiId>("chatusra");
  const [kaalaId, setKaalaId] = useState<KaalaId>("prathama");
  const [tempoBpm, setTempoBpm] = useState(
    defaultTempoBpm ?? DEFAULT_PRACTICE_BPM,
  );
  const [beatIndex, setBeatIndex] = useState(0);
  const [subdivision, setSubdivision] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [beatSoundOn, setBeatSoundOn] = useState(true);
  const [landMode, setLandMode] = useState<TalaLandMode>("single");

  const kaala = kaalaById(kaalaId);
  const subdivisions = kaala.subdivisionsPerBeat;

  const cycle = useMemo(() => buildTalaBeatCycle(talaId, jatiId), [talaId, jatiId]);
  const totalBeats = useMemo(() => totalBeatsForTalaJati(talaId, jatiId), [talaId, jatiId]);
  const current = cycle[beatIndex] ?? cycle[0]!;
  const tala = talaById(talaId);

  const beatIndexRef = useRef(0);
  const subdivisionRef = useRef(0);
  const playingRef = useRef(false);
  const cycleRef = useRef(cycle);
  const clickCtxRef = useRef<AudioContext | null>(null);
  const beatSoundOnRef = useRef(beatSoundOn);
  const landModeRef = useRef(landMode);

  useEffect(() => {
    cycleRef.current = cycle;
  }, [cycle]);

  useEffect(() => {
    beatSoundOnRef.current = beatSoundOn;
  }, [beatSoundOn]);

  useEffect(() => {
    landModeRef.current = landMode;
  }, [landMode]);

  const ensureClickContext = useCallback(async () => {
    if (!clickCtxRef.current || clickCtxRef.current.state === "closed") {
      clickCtxRef.current = new AudioContext();
    }
    await clickCtxRef.current.resume();
    return clickCtxRef.current;
  }, []);

  const playLandSound = useCallback(
    (step: TalaBeatStep | undefined) => {
      if (!step || !beatSoundOnRef.current) return;
      void ensureClickContext().then((ctx) => playTalaLandClick(ctx, step.gesture));
    },
    [ensureClickContext],
  );

  /** Advance one kāla syllable (one land); returns new beat + subdivision indices. */
  const advanceLand = useCallback(
    (beat: number, sub: number, subs: number, cycleLen: number) => {
      let nextSub = sub + 1;
      let nextBeat = beat;
      if (nextSub >= subs) {
        nextSub = 0;
        nextBeat = (beat + 1) % cycleLen;
      }
      return { beat: nextBeat, sub: nextSub };
    },
    [],
  );

  const resetCycle = useCallback(() => {
    beatIndexRef.current = 0;
    subdivisionRef.current = 0;
    setBeatIndex(0);
    setSubdivision(0);
  }, []);

  useEffect(() => {
    return () => {
      void clickCtxRef.current?.close();
      clickCtxRef.current = null;
    };
  }, []);

  useEffect(() => {
    resetCycle();
    setPlaying(false);
  }, [talaId, jatiId, kaalaId, resetCycle]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    if (!playing || tempoBpm <= 0) return;
    const beatMs = 60_000 / tempoBpm;
    const tickMs = beatMs / subdivisions;
    const id = window.setInterval(() => {
      if (!playingRef.current) return;
      const len = cycleRef.current.length;
      const prevBeat = beatIndexRef.current;
      const next = advanceLand(
        beatIndexRef.current,
        subdivisionRef.current,
        subdivisions,
        len,
      );
      const beatChanged = next.beat !== prevBeat;
      beatIndexRef.current = next.beat;
      subdivisionRef.current = next.sub;
      setBeatIndex(next.beat);
      setSubdivision(next.sub);
      playLandSound(cycleRef.current[next.beat]);
      if (landModeRef.current === "double" || beatChanged) {
        setPulse((p) => p + 1);
      }
    }, tickMs);
    return () => window.clearInterval(id);
  }, [playing, subdivisions, cycle.length, tempoBpm, playLandSound, advanceLand]);

  const raisedFinger = useMemo(() => {
    if (current.gesture !== "count" || !current.countFinger) return null;
    return countFingerMeshIndex(current.countFinger);
  }, [current]);

  const togglePlay = useCallback(() => {
    setPlaying((wasPlaying) => {
      if (!wasPlaying) {
        playLandSound(cycleRef.current[beatIndexRef.current]);
        setPulse((p) => p + 1);
      }
      return !wasPlaying;
    });
  }, [playLandSound]);

  const toggleBeatSound = useCallback(() => {
    setBeatSoundOn((on) => {
      const next = !on;
      beatSoundOnRef.current = next;
      if (next) {
        void ensureClickContext();
      }
      return next;
    });
  }, [ensureClickContext]);

  const resetToSam = useCallback(() => {
    resetCycle();
    if (playingRef.current) {
      playLandSound(cycleRef.current[0]);
      setPulse((p) => p + 1);
    }
  }, [resetCycle, playLandSound]);

  const gestureHintText =
    beatIndex === 0 && subdivision === 0
      ? "Sam — first beat of the avartanam."
      : subdivisions > 1
        ? landMode === "single"
          ? `Syllable ${subdivision + 1} of ${subdivisions} — hand lands once per beat; ${subdivisions} beat clicks.`
          : `Syllable ${subdivision + 1} of ${subdivisions} — hand lands on each syllable.`
        : "One syllable per beat — match this gesture while you sing.";

  const cycleButtons = (inHand: boolean) => (
    <div className={cn(styles.controls, inHand && styles.handControls)}>
      <button
        type="button"
        className={cn(styles.btn, inHand && styles.handBtn, playing && styles.btnOn)}
        onClick={togglePlay}
      >
        {playing ? "Pause cycle" : "Run cycle"}
      </button>
      <button type="button" className={cn(styles.btn, inHand && styles.handBtn)} onClick={resetToSam}>
        Reset
      </button>
    </div>
  );

  const gestureControls = (inHand: boolean) => (
    <div className={inHand ? styles.handGesturePanel : styles.gestureCard}>
      {inHand ? (
        <div className={styles.handGestureRow}>
          <p className={styles.handGestureTitle}>{gestureLabel(current)}</p>
          {cycleButtons(true)}
        </div>
      ) : (
        <>
          <p className={styles.gestureTitle}>{gestureLabel(current)}</p>
          <p className={styles.gestureHint}>{gestureHintText}</p>

          {subdivisions > 1 ? (
            <div className={styles.subdivStrip} aria-label="Syllables in current beat">
              {Array.from({ length: subdivisions }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    styles.subdivTick,
                    i === subdivision && styles.subdivTickActive,
                  )}
                />
              ))}
            </div>
          ) : null}

          <div className={styles.beatStrip}>
            {cycle.map((step, i) => (
              <div
                key={`${step.beatInCycle}-${step.gesture}-${i}`}
                className={cn(
                  styles.beatDot,
                  i === beatIndex && styles.beatDotActive,
                  i === 0 && styles.beatDotSam,
                )}
                title={gestureLabel(step)}
              >
                {step.gesture === "wave"
                  ? "↷"
                  : step.gesture === "count" && step.countFinger
                    ? countFingerShort(step.countFinger)
                    : "✥"}
              </div>
            ))}
          </div>
          {cycleButtons(false)}
        </>
      )}
    </div>
  );

  const embeddedSplit = embedded && !!gestureAside;

  const stageSection = (
    <div
      className={cn(
        styles.stage,
        embedded && styles.stageEmbeddedTop,
        embeddedSplit && styles.stageEmbeddedSplit,
        embedded && !gestureAside && styles.stageEmbeddedFull,
      )}
    >
      <div className={cn(styles.handViewport, embedded && styles.handViewportEmbedded)}>
        <button
          type="button"
          className={cn(styles.soundToggle, beatSoundOn && styles.soundToggleOn)}
          onClick={toggleBeatSound}
          aria-pressed={beatSoundOn}
          aria-label={beatSoundOn ? "Mute beat sounds" : "Enable beat sounds"}
          title={beatSoundOn ? "Beat sound on" : "Beat sound off"}
        >
          {beatSoundOn ? (
            <Volume2 className={styles.soundToggleIcon} aria-hidden />
          ) : (
            <VolumeX className={styles.soundToggleIcon} aria-hidden />
          )}
        </button>
        {embedded ? gestureControls(true) : null}
        <div className={cn(embedded && styles.handModelSlot)}>
          <TalaHand3D
            gesture={current.gesture}
            raisedFinger={raisedFinger}
            countFinger={current.countFinger}
            pulse={pulse}
          />
        </div>
      </div>

      {embeddedSplit ? (
        <div className={styles.stageRightCol}>
          <div className={styles.stageShrutiSlot}>{gestureAside}</div>
        </div>
      ) : !embedded ? (
        gestureControls(false)
      ) : null}
    </div>
  );

  const talaPreferences = (
    <>
      <div className={styles.ctrlRow}>
        <div className={styles.ctrl}>
          <div className={styles.ctrlLbl}>Tāla (sapta tāla)</div>
          <select
            className={styles.select}
            value={talaId}
            onChange={(e) => setTalaId(e.target.value as TalaId)}
          >
            {CARNATIC_TALAS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.notation})
              </option>
            ))}
          </select>
        </div>
        <div className={styles.ctrl}>
          <div className={styles.ctrlLbl}>Jāti (laghu length)</div>
          <select
            className={styles.select}
            value={jatiId}
            onChange={(e) => setJatiId(e.target.value as JatiId)}
          >
            {CARNATIC_JATIS.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name} (I = {j.laghuBeats} beats)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.kaalaBlock}>
        <div className={styles.ctrlLbl}>Kāla (speed)</div>
        {kaala.description ? (
          <p className={styles.kaalaHint}>{kaala.description}</p>
        ) : null}
        <div className={styles.kaalaBtns}>
          {CARNATIC_KAALAS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={cn(styles.kaalaBtn, kaalaId === k.id && styles.kaalaBtnOn)}
              onClick={() => setKaalaId(k.id)}
            >
              <span className={styles.kaalaBtnTitle}>
                {k.shortLabel}
                <span className={styles.kaalaBtnParen}>
                  {" "}
                  ({k.alternateName ?? k.name})
                </span>
              </span>
              <span className={styles.kaalaBtnCount}>
                {k.subdivisionsPerBeat === 1
                  ? "1 note per beat"
                  : `${k.subdivisionsPerBeat} notes per beat`}
              </span>
            </button>
          ))}
        </div>
        {subdivisions > 1 ? (
          <div className={styles.landModeBlock}>
            <div className={styles.ctrlLbl}>Hand land (2nd & 3rd speed)</div>
            <div className={styles.landModeBtns}>
              {LAND_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={cn(styles.landModeBtn, landMode === m.id && styles.landModeBtnOn)}
                  onClick={() => setLandMode(m.id)}
                >
                  <span className={styles.landModeBtnTitle}>{m.label}</span>
                  <span className={styles.landModeBtnSub}>{m.description}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.tempoBlock}>
        <div className={styles.ctrlLbl}>Tempo (beats per minute)</div>
        <p className={styles.tempoHint}>How fast the 3D tala hand moves.</p>
        <div className={styles.tempoSliderRow}>
          <span className={styles.tempoSliderLbl}>Slower</span>
          <input
            id="tala-tempo-bpm"
            type="range"
            min={40}
            max={160}
            step={1}
            value={tempoBpm}
            onChange={(e) => setTempoBpm(Number(e.target.value))}
            className={styles.tempoSlider}
            aria-valuetext={`${tempoBpm} beats per minute`}
          />
          <span className={styles.tempoSliderLbl}>Faster</span>
        </div>
        <p className={styles.tempoValue}>{tempoBpm} BPM</p>
      </div>
    </>
  );

  return (
    <div className={cn(styles.root, embedded && styles.rootEmbedded)}>
      {!embedded ? (
        <div className={styles.header}>
          <h2>Tāla hand guide</h2>
          <p className={styles.sub}>
            Hand gestures mark each beat of the{" "}
            <MusicTermTip term="avartanam" definition="one full cycle of a tala" />.
          </p>
        </div>
      ) : (
        <h2 className={styles.embeddedTitle}>Sing with tāla</h2>
      )}

      {embedded && sessionMeta ? (
        <div className={cn(styles.sessionMetaBar, styles.sessionMetaBarEmbedded)}>
          <span className={styles.sessionMetaRaga}>
            <strong>Rāga:</strong>{" "}
            <span
              className={cn(
                styles.sessionMetaValue,
                sessionMeta.ragaHighlight && styles.sessionMetaValueHighlight,
              )}
            >
              {sessionMeta.raga}
            </span>
          </span>
          <span className={styles.sessionMetaShruti}>
            <strong>Shruti:</strong>{" "}
            <span
              className={cn(
                styles.sessionMetaValue,
                sessionMeta.shrutiHighlight && styles.sessionMetaValueHighlight,
              )}
            >
              {sessionMeta.shruti}
            </span>
          </span>
          {sessionMeta.stopwatch}
        </div>
      ) : null}

      {embedded ? stageSection : null}

      {talaPreferences}

      {!embedded ? (
        <div className={styles.meta}>
          <span>
            <strong>Notation:</strong> {tala.notation}
          </span>
          <span>
            <strong>Cycle:</strong> {talaJatiLabel(talaId, jatiId)}
          </span>
          <span>
            <strong>Beat:</strong> {beatIndex + 1} / {totalBeats}
          </span>
          <span>
            <strong>Kāla:</strong> {kaala.name}
            {kaala.alternateName ? ` (${kaala.alternateName})` : ""}
          </span>
          <span>
            <strong>Tempo:</strong> {tempoBpm} BPM
          </span>
          {subdivisions > 1 ? (
            <span>
              <strong>Land:</strong> {landMode === "single" ? "Single" : "Double"}
            </span>
          ) : null}
        </div>
      ) : null}

      {!embedded ? stageSection : null}
    </div>
  );
}
