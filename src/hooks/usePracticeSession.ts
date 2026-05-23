"use client";

import { useCallback, useRef, useState } from "react";
import { analyzeCrepePitchFrame, isCrepePitchLiveAvailable } from "@/lib/audio/crepe-pitch-live-client";
import type { ExternalPitchReading } from "@/lib/audio/pitchPipeline";
import { VocalPitchProcessor } from "@/lib/audio/pitchPipeline";
import type { ShrutiFeedbackStatus } from "@/lib/audio/liveShrutiFeedback";
import { computeRms, volumeLabel } from "@/lib/audio/volume";
import { DEFAULT_TANPURA_KEY, nominalHzForTanpuraKey } from "@/lib/audio/tanpura-manifest";
import type { PitchSample, PracticeConfig, TempoSample, VolumeSample } from "@/types";

const MAX_POINTS = 900;
const CHART_FRAME_STRIDE = 3;
const AUDIO_FRAME_FANOUT_STRIDE = 8;
const UI_UPDATE_MS = 50;
const CREPE_FRAME_INTERVAL_MS = 110;
const CREPE_MIN_SAMPLES = 4096;
const VOLUME_LIVE_ALPHA = 0.065;

export type AudioFrameListener = (buffer: Float32Array, sampleRate: number) => void;

export type LivePitchState = {
  deviationCents: number;
  smoothedDeviation: number;
  confidence: number;
  isVoiced: boolean;
  shruti22Index: number | null;
  targetShrutiHz: number | null;
  detectedHz: number | null;
  smoothedHz: number | null;
  feedbackStatus: ShrutiFeedbackStatus;
  crepeActive: boolean;
};

function trim<T>(arr: T[], max: number) {
  if (arr.length > max) arr.splice(0, arr.length - max);
}

export function usePracticeSession() {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pitchLive, setPitchLive] = useState<LivePitchState>({
    deviationCents: 0,
    smoothedDeviation: 0,
    confidence: 0,
    isVoiced: false,
    shruti22Index: null,
    targetShrutiHz: null,
    detectedHz: null,
    smoothedHz: null,
    feedbackStatus: "idle",
    crepeActive: false,
  });
  const [volumeLive, setVolumeLive] = useState({
    rms: 0,
    label: "too_soft" as "too_soft" | "good" | "too_loud",
  });

  const pitchSeriesRef = useRef<PitchSample[]>([]);
  const volumeSeriesRef = useRef<VolumeSample[]>([]);
  const tempoSeriesRef = useRef<TempoSample[]>([]);
  const centsAbsVoicedRef = useRef<number[]>([]);
  const tempoOffsetAbsRef = useRef<number[]>([]);
  const rmsOnlyRef = useRef<number[]>([]);

  const rafRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const audioFrameListenersRef = useRef<Set<AudioFrameListener>>(new Set());
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pitchProcessorRef = useRef<VocalPitchProcessor | null>(null);
  const wallStartRef = useRef(0);
  const startedAtIsoRef = useRef<string | null>(null);
  const volumeDisplayRmsRef = useRef(0);
  const lastUiUpdateRef = useRef(0);
  const crepeLastReadingRef = useRef<ExternalPitchReading | null>(null);
  const crepeInFlightRef = useRef(false);
  const crepeLastCallWallRef = useRef(0);
  const crepeActiveRef = useRef(false);
  const configRef = useRef<PracticeConfig>({
    shrutiHz: nominalHzForTanpuraKey(DEFAULT_TANPURA_KEY),
    tanpuraKey: DEFAULT_TANPURA_KEY,
  });

  const stopInternal = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    frameRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    pitchProcessorRef.current = null;
    volumeDisplayRmsRef.current = 0;
    crepeLastReadingRef.current = null;
    crepeInFlightRef.current = false;
    crepeLastCallWallRef.current = 0;
    crepeActiveRef.current = false;
    setRunning(false);
  }, []);

  const start = useCallback(
    async (config: PracticeConfig) => {
      setError(null);
      startedAtIsoRef.current = null;
      stopInternal();
      configRef.current = {
        ...config,
        shrutiHz: nominalHzForTanpuraKey(config.tanpuraKey),
      };
      lastUiUpdateRef.current = 0;
      pitchSeriesRef.current = [];
      volumeSeriesRef.current = [];
      tempoSeriesRef.current = [];
      centsAbsVoicedRef.current = [];
      tempoOffsetAbsRef.current = [];
      rmsOnlyRef.current = [];
      volumeDisplayRmsRef.current = 0;

      try {
        const crepeOk = await isCrepePitchLiveAvailable();
        crepeActiveRef.current = crepeOk;
        if (!crepeOk) {
          setError(
            "CREPE pitch service is not running. Start dev with npm run dev (port 8003).",
          );
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: false,
        });
        streamRef.current = stream;
        startedAtIsoRef.current = new Date().toISOString();

        const ctx = new AudioContext();
        await ctx.resume();
        ctxRef.current = ctx;
        pitchProcessorRef.current = new VocalPitchProcessor(ctx.sampleRate);

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 4096;
        analyser.smoothingTimeConstant = 0.2;
        source.connect(analyser);

        wallStartRef.current = performance.now();

        const buffer = new Float32Array(analyser.fftSize);

        const loop = () => {
          const audioCtx = ctxRef.current;
          const processor = pitchProcessorRef.current;
          if (!audioCtx || !processor) return;

          analyser.getFloatTimeDomainData(buffer);
          const rms = computeRms(buffer);
          const wallMs = performance.now();
          const t = (wallMs - wallStartRef.current) / 1000;
          const shruti = configRef.current.shrutiHz;
          const tanpuraKey = configRef.current.tanpuraKey;

          const sr = audioCtx.sampleRate;
          if (
            crepeActiveRef.current &&
            !crepeInFlightRef.current &&
            buffer.length >= CREPE_MIN_SAMPLES &&
            wallMs - crepeLastCallWallRef.current >= CREPE_FRAME_INTERVAL_MS
          ) {
            crepeLastCallWallRef.current = wallMs;
            crepeInFlightRef.current = true;
            const snap = new Float32Array(buffer);
            void analyzeCrepePitchFrame(snap, sr)
              .then((res) => {
                if (res.voiced && res.hz != null && Number.isFinite(res.hz)) {
                  crepeLastReadingRef.current = {
                    hz: res.hz,
                    probability: res.confidence ?? 0.85,
                  };
                }
              })
              .catch(() => {
                /* keep last reading */
              })
              .finally(() => {
                crepeInFlightRef.current = false;
              });
          }

          const out = processor.process(
            wallMs,
            buffer,
            rms,
            shruti,
            tanpuraKey,
            crepeActiveRef.current ? crepeLastReadingRef.current : null,
          );

          if (out.voiced) {
            centsAbsVoicedRef.current.push(Math.abs(out.deviationCents));
            trim(centsAbsVoicedRef.current, MAX_POINTS);
          }

          rmsOnlyRef.current.push(rms);
          trim(rmsOnlyRef.current, MAX_POINTS);

          frameRef.current += 1;
          if (
            frameRef.current % AUDIO_FRAME_FANOUT_STRIDE === 0 &&
            audioFrameListenersRef.current.size > 0
          ) {
            const fanout = new Float32Array(buffer);
            const fanoutSr = audioCtx.sampleRate;
            for (const fn of audioFrameListenersRef.current) {
              fn(fanout, fanoutSr);
            }
          }
          if (frameRef.current % CHART_FRAME_STRIDE === 0) {
            pitchSeriesRef.current.push({
              t,
              hz: null,
              cents: out.voiced ? out.deviationCents : null,
              shruti22Index: out.voiced ? out.shruti22Index : null,
              confidence: out.voiced ? out.confidence : null,
            });
            volumeSeriesRef.current.push({ t, rms });
            trim(pitchSeriesRef.current, MAX_POINTS);
            trim(volumeSeriesRef.current, MAX_POINTS);
          }

          const nowUi = performance.now();
          if (nowUi - lastUiUpdateRef.current >= UI_UPDATE_MS) {
            lastUiUpdateRef.current = nowUi;
            setPitchLive({
              deviationCents: out.deviationCents,
              smoothedDeviation: out.smoothedDeviation,
              confidence: out.confidence,
              isVoiced: out.voiced,
              shruti22Index: out.shruti22Index,
              targetShrutiHz: out.targetShrutiHz,
              detectedHz: out.detectedHz,
              smoothedHz: out.smoothedHz,
              feedbackStatus: out.feedbackStatus,
              crepeActive: crepeActiveRef.current,
            });
            volumeDisplayRmsRef.current +=
              VOLUME_LIVE_ALPHA * (rms - volumeDisplayRmsRef.current);
            const vr = volumeDisplayRmsRef.current;
            setVolumeLive({ rms: vr, label: volumeLabel(vr) });
          }

          rafRef.current = requestAnimationFrame(loop);
        };

        setRunning(true);
        rafRef.current = requestAnimationFrame(loop);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Microphone access failed";
        setError(msg);
        stopInternal();
      }
    },
    [stopInternal],
  );

  const stop = useCallback(() => {
    stopInternal();
  }, [stopInternal]);

  const getCaptured = useCallback(
    () => ({
      pitch: [...pitchSeriesRef.current],
      volume: [...volumeSeriesRef.current],
      tempo: [...tempoSeriesRef.current],
      centsAbsVoiced: [...centsAbsVoicedRef.current],
      tempoOffsetMsAbs: [...tempoOffsetAbsRef.current],
      rmsSeries: [...rmsOnlyRef.current],
    }),
    [],
  );

  const getStartedAtIso = useCallback(() => startedAtIsoRef.current, []);

  const subscribeAudioFrame = useCallback((listener: AudioFrameListener) => {
    audioFrameListenersRef.current.add(listener);
    return () => {
      audioFrameListenersRef.current.delete(listener);
    };
  }, []);

  const updateConfig = useCallback((tanpuraKey: string, shrutiHz?: number) => {
    configRef.current = {
      ...configRef.current,
      tanpuraKey,
      shrutiHz: shrutiHz ?? nominalHzForTanpuraKey(tanpuraKey),
    };
    pitchProcessorRef.current?.reset();
    crepeLastReadingRef.current = null;
  }, []);

  return {
    running,
    error,
    start,
    stop,
    pitchLive,
    volumeLive,
    getCaptured,
    getStartedAtIso,
    subscribeAudioFrame,
    updateConfig,
  };
}
