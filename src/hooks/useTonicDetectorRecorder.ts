"use client";

import { useCallback, useRef, useState } from "react";
import {
  analyzeSamples,
  float32ToWavBlob,
  mergeFloat32Chunks,
  resampleLinear,
  MODEL_SAMPLE_RATE,
  type RecordingDiagnostics,
} from "@/lib/audio/recordingToWav";
import { computeRms } from "@/lib/audio/volume";

/** Model trained on ~20 s KritiSamhita vocal clips. */
const MIN_MS = 10_000;
const MAX_MS = 25_000;

export type TonicRecorderPhase = "idle" | "recording" | "recorded";

export function useTonicDetectorRecorder() {
  const [phase, setPhase] = useState<TonicRecorderPhase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<RecordingDiagnostics | null>(null);
  const [liveRms, setLiveRms] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);

  const clearTick = () => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const revokePreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  };

  const teardownAudio = () => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    chunksRef.current = [];
  };

  const reset = useCallback(() => {
    clearTick();
    teardownAudio();
    revokePreview();
    setPhase("idle");
    setElapsedMs(0);
    setError(null);
    setBlob(null);
    setDiagnostics(null);
    setLiveRms(0);
  }, []);

  const stopRecording = useCallback(async () => {
    if (!processorRef.current) return;
    clearTick();

    const elapsed = performance.now() - startedAtRef.current;
    setElapsedMs(Math.round(elapsed));

    const ctx = ctxRef.current;
    const captureRate = ctx?.sampleRate ?? 48000;
    const merged = mergeFloat32Chunks(chunksRef.current);
    teardownAudio();

    if (elapsed < MIN_MS) {
      setError(`Record at least ${MIN_MS / 1000} seconds of singing, then stop.`);
      setPhase("idle");
      return;
    }

    if (merged.length < captureRate * 2) {
      setError("Almost no audio captured — check your microphone.");
      setPhase("idle");
      return;
    }

    const resampled = resampleLinear(merged, captureRate, MODEL_SAMPLE_RATE);
    const diag = analyzeSamples(resampled, MODEL_SAMPLE_RATE);
    const wav = float32ToWavBlob(resampled, MODEL_SAMPLE_RATE);

    if (diag.level === "too_soft") {
      setError("Recording is very quiet — move closer to the mic or raise input volume.");
    } else {
      setError(null);
    }

    revokePreview();
    const url = URL.createObjectURL(wav);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setBlob(wav);
    setDiagnostics(diag);
    setPhase("recorded");
  }, []);

  const startRecording = useCallback(async () => {
    reset();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      await ctx.resume();
      ctxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      sourceRef.current = source;
      processorRef.current = processor;
      chunksRef.current = [];

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(input));
        setLiveRms(computeRms(input));
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      startedAtRef.current = performance.now();
      setPhase("recording");

      tickRef.current = window.setInterval(() => {
        const ms = performance.now() - startedAtRef.current;
        setElapsedMs(Math.round(ms));
        if (ms >= MAX_MS) void stopRecording();
      }, 200);
    } catch {
      setError("Microphone access is required.");
      setPhase("idle");
    }
  }, [reset, stopRecording]);

  return {
    phase,
    elapsedMs,
    error,
    blob,
    previewUrl,
    diagnostics,
    liveRms,
    minMs: MIN_MS,
    maxMs: MAX_MS,
    startRecording,
    stopRecording,
    reset,
  };
}
