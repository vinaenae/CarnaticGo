"use client";

/**
 * Shiffman ukulele tuner structure (Coding Train #151) with ml5 CREPE in-browser.
 *
 * setup → listening → modelLoaded → gotPitch loop + draw loop
 *
 * @see https://thecodingtrain.com/CodingChallenges/151-ukulele-tuner.html
 * @see https://youtu.be/F1OkDTUkKFo
 * @see https://editor.p5js.org/codingtrain/sketches/8io2zvT03
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createMl5CrepePitchDetection,
  type Ml5CrepePitchDetector,
} from "@/lib/audio/ml5-crepe-pitch";
import {
  shiffmanTunerDrawFrame,
  type ShiffmanNote,
  type ShiffmanTunerSnapshot,
} from "@/lib/audio/shiffman-pitch-tuner";
import { createYinFrameDetector } from "@/lib/audio/yinFrame";
import { computeRms, PITCH_INPUT_RMS_GATE } from "@/lib/audio/volume";

export type PitchEngine = "ml5-crepe" | "yin-fallback";

export type ShiffmanPitchTunerState = ShiffmanTunerSnapshot & {
  listening: boolean;
  inputRms: number;
  error: string | null;
  pitchEngine: PitchEngine;
  modelLoading: boolean;
};

const BUFFER_SIZE = 2048;
const RMS_GATE = PITCH_INPUT_RMS_GATE;

const emptySnapshot = (notes: readonly ShiffmanNote[]): ShiffmanPitchTunerState => ({
  freq: 0,
  notes,
  closest: null,
  recordDiff: 0,
  inTune: false,
  needlePercent: 50,
  listening: false,
  inputRms: 0,
  error: null,
  pitchEngine: "ml5-crepe",
  modelLoading: true,
});

export type ShiffmanPitchTunerOptions = {
  /** ±Hz from target to count as in tune; default `SHIFFMAN_IN_TUNE_HZ` (3). */
  inTuneThresholdHz?: number;
  /** YIN-only mic path — skips CREPE/TensorFlow (use on hold-Sa and other simple tuners). */
  lightweight?: boolean;
};

const UI_UPDATE_MS = 50;
const CREPE_POLL_MS = 66;

export function useShiffmanPitchTuner(
  notes: readonly ShiffmanNote[],
  listening: boolean,
  options?: ShiffmanPitchTunerOptions,
) {
  const [state, setState] = useState<ShiffmanPitchTunerState>(() =>
    emptySnapshot(notes),
  );

  const notesRef = useRef(notes);
  const inTuneThresholdRef = useRef(options?.inTuneThresholdHz);
  const lightweightRef = useRef(options?.lightweight ?? false);
  const listeningRef = useRef(listening);
  const lastUiUpdateRef = useRef(0);
  const freqRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const crepeRef = useRef<Ml5CrepePitchDetector | null>(null);
  const yinProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const yinSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const yinDetectRef = useRef<ReturnType<typeof createYinFrameDetector> | null>(null);
  const yinBufferRef = useRef(new Float32Array(BUFFER_SIZE));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterBufferRef = useRef(new Float32Array(BUFFER_SIZE));
  const engineRef = useRef<PitchEngine>("ml5-crepe");
  const generationRef = useRef(0);
  const gotPitchActiveRef = useRef(false);
  const drawRafRef = useRef<number | null>(null);

  useEffect(() => {
    notesRef.current = notes;
    setState((prev) => ({ ...prev, notes }));
  }, [notes]);

  useEffect(() => {
    inTuneThresholdRef.current = options?.inTuneThresholdHz;
    lightweightRef.current = options?.lightweight ?? false;
  }, [options?.inTuneThresholdHz, options?.lightweight]);

  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  const teardown = useCallback(() => {
    gotPitchActiveRef.current = false;
    if (drawRafRef.current != null) {
      cancelAnimationFrame(drawRafRef.current);
      drawRafRef.current = null;
    }
    crepeRef.current?.dispose();
    crepeRef.current = null;
    yinProcessorRef.current?.disconnect();
    yinSourceRef.current?.disconnect();
    yinProcessorRef.current = null;
    yinSourceRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    yinDetectRef.current = null;
    freqRef.current = 0;
  }, []);

  /** Shiffman `draw()` — read `freq`, closest note, update meter. */
  const draw = useCallback(() => {
    if (!listeningRef.current) {
      drawRafRef.current = null;
      return;
    }
    drawRafRef.current = requestAnimationFrame(draw);

    const now = performance.now();
    if (now - lastUiUpdateRef.current < UI_UPDATE_MS) return;
    lastUiUpdateRef.current = now;

    let inputRms = 0;
    const analyser = analyserRef.current;
    const meterBuf = meterBufferRef.current;
    if (analyser && meterBuf.length === analyser.fftSize) {
      analyser.getFloatTimeDomainData(meterBuf);
      inputRms = computeRms(meterBuf);
      if (inputRms < RMS_GATE && engineRef.current === "ml5-crepe") {
        freqRef.current = 0;
      }
    }

    const snap = shiffmanTunerDrawFrame(
      freqRef.current,
      notesRef.current,
      inTuneThresholdRef.current,
    );
    setState((prev) => ({
      ...snap,
      listening: true,
      inputRms,
      error: prev.error,
      pitchEngine: engineRef.current,
      modelLoading: prev.modelLoading,
    }));
  }, []);

  /** Shiffman `gotPitch(error, frequency)` → `pitch.getPitch(gotPitch)`. */
  const gotPitch = useCallback(async () => {
    if (!gotPitchActiveRef.current || !listeningRef.current) return;

    const crepe = crepeRef.current;
    if (crepe && engineRef.current === "ml5-crepe") {
      try {
        const frequency = await crepe.getPitch();
        if (frequency != null && frequency > 55 && frequency < 2000) {
          freqRef.current = frequency;
        } else {
          freqRef.current = 0;
        }
      } catch {
        /* keep last freq */
      }
      window.setTimeout(() => void gotPitch(), CREPE_POLL_MS);
      return;
    }

    const detect = yinDetectRef.current;
    const buf = yinBufferRef.current;
    const rms = computeRms(buf);
    setState((prev) => ({ ...prev, inputRms: rms }));

    if (detect && rms >= RMS_GATE) {
      const yin = detect(buf);
      if (yin && yin.hz > 55 && yin.hz < 2000) {
        freqRef.current = yin.hz;
      }
    } else if (rms < RMS_GATE) {
      freqRef.current = 0;
    }

    requestAnimationFrame(() => void gotPitch());
  }, []);

  /** Shiffman `listening()` → `pitch = ml5.pitchDetection(..., modelLoaded)`. */
  const startYinFallback = useCallback(
    (ctx: AudioContext, stream: MediaStream) => {
      engineRef.current = "yin-fallback";
      yinDetectRef.current = createYinFrameDetector({
        sampleRate: ctx.sampleRate,
        threshold: 0.13,
        probabilityThreshold: 0.1,
      });
      const source = ctx.createMediaStreamSource(stream);
      yinSourceRef.current = source;
      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      yinProcessorRef.current = processor;
      const silent = ctx.createGain();
      silent.gain.value = 0.0001;
      processor.onaudioprocess = (ev) => {
        yinBufferRef.current.set(ev.inputBuffer.getChannelData(0));
      };
      source.connect(processor);
      processor.connect(silent);
      silent.connect(ctx.destination);
      setState((prev) => ({
        ...prev,
        pitchEngine: "yin-fallback",
        modelLoading: false,
        error: lightweightRef.current ? null : prev.error,
      }));
      gotPitchActiveRef.current = true;
      void gotPitch();
    },
    [gotPitch],
  );

  const modelLoaded = useCallback(async () => {
    const ctx = ctxRef.current;
    const stream = streamRef.current;
    if (!ctx || !stream) return;

    const gen = generationRef.current;

    if (lightweightRef.current) {
      startYinFallback(ctx, stream);
      return;
    }

    try {
      const crepe = await createMl5CrepePitchDetection(ctx, stream);
      if (gen !== generationRef.current) {
        crepe.dispose();
        return;
      }
      crepeRef.current = crepe;
      engineRef.current = "ml5-crepe";
      setState((prev) => ({
        ...prev,
        pitchEngine: "ml5-crepe",
        modelLoading: false,
        error: null,
      }));
      gotPitchActiveRef.current = true;
      void gotPitch();
    } catch {
      startYinFallback(ctx, stream);
      setState((prev) => ({
        ...prev,
        error: "ml5 CREPE model failed to load — using YIN fallback.",
      }));
    }
  }, [gotPitch, startYinFallback]);

  /** Shiffman `setup()` — mic + audioContext. */
  const setup = useCallback(async () => {
    const gen = ++generationRef.current;
    teardown();
    freqRef.current = 0;
    setState({ ...emptySnapshot(notesRef.current), listening: true, modelLoading: true });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      if (gen !== generationRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      const ctx = new AudioContext();
      await ctx.resume();
      if (gen !== generationRef.current) {
        void ctx.close();
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      ctxRef.current = ctx;

      const meterSource = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = BUFFER_SIZE;
      meterSource.connect(analyser);
      analyserRef.current = analyser;
      meterBufferRef.current = new Float32Array(analyser.fftSize);

      drawRafRef.current = requestAnimationFrame(draw);
      await modelLoaded();
    } catch {
      if (gen !== generationRef.current) return;
      setState({
        ...emptySnapshot(notesRef.current),
        listening: false,
        modelLoading: false,
        error: "Microphone access was denied or unavailable.",
      });
      teardown();
    }
  }, [draw, modelLoaded, teardown]);

  const stop = useCallback(() => {
    generationRef.current += 1;
    teardown();
    setState(emptySnapshot(notesRef.current));
  }, [teardown]);

  useEffect(() => {
    if (listening) void setup();
    else stop();
    return () => stop();
  }, [listening, setup, stop]);

  return state;
}
