"use client";

/**
 * Live Hz trace via ml5 CREPE in the browser (same stack as warmup for your song).
 * @see src/lib/audio/ml5-crepe-pitch.ts
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createMl5CrepePitchDetection } from "@/lib/audio/ml5-crepe-pitch";
import type { PitchChartPoint } from "@/lib/audio/pitchContour";
import { createYinFrameDetector } from "@/lib/audio/yinFrame";
import { computeRms } from "@/lib/audio/volume";

export type Ml5LivePitchEngine = "ml5-crepe" | "yin-fallback";

const BUFFER_SIZE = 2048;
const RMS_GATE = 0.002;
const MIN_HZ = 55;
const MAX_HZ = 2000;
/** Min ms between chart samples (~20 Hz). */
const MIN_POINT_INTERVAL_MS = 50;

export function useMl5LivePitchContour(
  stream: MediaStream | null,
  active: boolean,
) {
  const [points, setPoints] = useState<PitchChartPoint[]>([]);
  const [pitchEngine, setPitchEngine] = useState<Ml5LivePitchEngine | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef(stream);
  const activeRef = useRef(active);
  const ctxRef = useRef<AudioContext | null>(null);
  const crepeRef = useRef<Awaited<ReturnType<typeof createMl5CrepePitchDetection>> | null>(null);
  const yinProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const yinSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const yinDetectRef = useRef<ReturnType<typeof createYinFrameDetector> | null>(null);
  const yinBufferRef = useRef(new Float32Array(BUFFER_SIZE));
  const engineRef = useRef<Ml5LivePitchEngine>("ml5-crepe");
  const generationRef = useRef(0);
  const gotPitchActiveRef = useRef(false);
  const startTimeRef = useRef(0);
  const lastPointAtRef = useRef(0);
  const freqRef = useRef(0);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const appendPoint = useCallback((hz: number) => {
    const now = performance.now();
    if (now - lastPointAtRef.current < MIN_POINT_INTERVAL_MS) return;
    lastPointAtRef.current = now;
    const t = (now - startTimeRef.current) / 1000;
    setPoints((prev) => [...prev, { t, hz }]);
  }, []);

  const teardown = useCallback(() => {
    gotPitchActiveRef.current = false;
    crepeRef.current?.dispose();
    crepeRef.current = null;
    yinProcessorRef.current?.disconnect();
    yinSourceRef.current?.disconnect();
    yinProcessorRef.current = null;
    yinSourceRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    yinDetectRef.current = null;
    freqRef.current = 0;
  }, []);

  const gotPitch = useCallback(async () => {
    if (!gotPitchActiveRef.current || !activeRef.current) return;

    const crepe = crepeRef.current;
    if (crepe && engineRef.current === "ml5-crepe") {
      try {
        const frequency = await crepe.getPitch();
        if (frequency != null && frequency > MIN_HZ && frequency < MAX_HZ) {
          freqRef.current = frequency;
          appendPoint(frequency);
        }
      } catch {
        /* keep polling */
      }
      void gotPitch();
      return;
    }

    const detect = yinDetectRef.current;
    const buf = yinBufferRef.current;
    if (detect && computeRms(buf) >= RMS_GATE) {
      const yin = detect(buf);
      if (yin && yin.hz > MIN_HZ && yin.hz < MAX_HZ) {
        freqRef.current = yin.hz;
        appendPoint(yin.hz);
      }
    }
    requestAnimationFrame(() => void gotPitch());
  }, [appendPoint]);

  const modelLoaded = useCallback(async () => {
    const ctx = ctxRef.current;
    const s = streamRef.current;
    if (!ctx || !s) return;

    try {
      crepeRef.current = await createMl5CrepePitchDetection(ctx, s);
      engineRef.current = "ml5-crepe";
      setPitchEngine("ml5-crepe");
      setModelLoading(false);
      setError(null);
      gotPitchActiveRef.current = true;
      void gotPitch();
    } catch {
      engineRef.current = "yin-fallback";
      yinDetectRef.current = createYinFrameDetector({
        sampleRate: ctx.sampleRate,
        threshold: 0.13,
        probabilityThreshold: 0.1,
      });
      const source = ctx.createMediaStreamSource(s);
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
      setPitchEngine("yin-fallback");
      setModelLoading(false);
      setError("ml5 CREPE failed to load — using YIN for live chart.");
      gotPitchActiveRef.current = true;
      void gotPitch();
    }
  }, [gotPitch]);

  const setup = useCallback(async () => {
    const gen = ++generationRef.current;
    teardown();
    startTimeRef.current = performance.now();
    lastPointAtRef.current = 0;
    setPoints([]);
    setModelLoading(true);
    setError(null);
    setPitchEngine(null);

    const s = streamRef.current;
    if (!s) {
      setModelLoading(false);
      return;
    }

    try {
      const ctx = new AudioContext();
      await ctx.resume();
      if (gen !== generationRef.current) {
        void ctx.close();
        return;
      }
      ctxRef.current = ctx;
      await modelLoaded();
    } catch {
      if (gen !== generationRef.current) return;
      setModelLoading(false);
      setError("Could not start live pitch detection.");
      teardown();
    }
  }, [modelLoaded, teardown]);

  useEffect(() => {
    if (active && stream) void setup();
    else teardown();
    return () => teardown();
  }, [active, stream, setup, teardown]);

  const reset = useCallback(() => {
    setPoints([]);
    lastPointAtRef.current = 0;
    startTimeRef.current = performance.now();
  }, []);

  return {
    points,
    pitchEngine,
    modelLoading,
    error,
    reset,
  };
}
