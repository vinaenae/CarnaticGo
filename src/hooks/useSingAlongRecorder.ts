"use client";



import { useCallback, useRef, useState } from "react";

import { float32ToWavBlob, mergeFloat32Chunks } from "@/lib/audio/recordingToWav";

import { computeRms } from "@/lib/audio/volume";



const DEFAULT_MIN_MS = 4000;



export type SingAlongRecorderPhase = "idle" | "recording" | "recorded";



export type UseSingAlongRecorderOptions = {

  /** Minimum recording length before accepting (default 4000 ms). */

  minDurationMs?: number;

};



export function useSingAlongRecorder(options?: UseSingAlongRecorderOptions) {

  const minMs = options?.minDurationMs ?? DEFAULT_MIN_MS;

  const [phase, setPhase] = useState<SingAlongRecorderPhase>("idle");

  const [elapsedMs, setElapsedMs] = useState(0);

  const [error, setError] = useState<string | null>(null);

  const [wavBlob, setWavBlob] = useState<Blob | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [liveRms, setLiveRms] = useState(0);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);



  const streamRef = useRef<MediaStream | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);

  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const chunksRef = useRef<Float32Array[]>([]);

  const tickRef = useRef<number | null>(null);

  const startedAtRef = useRef(0);

  const mergedRef = useRef<Float32Array>(new Float32Array(0));

  const rateRef = useRef(48000);

  const previewUrlRef = useRef<string | null>(null);



  const revokePreview = () => {

    if (previewUrlRef.current) {

      URL.revokeObjectURL(previewUrlRef.current);

      previewUrlRef.current = null;

    }

    setPreviewUrl(null);

  };



  const clearTick = () => {

    if (tickRef.current != null) {

      window.clearInterval(tickRef.current);

      tickRef.current = null;

    }

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
    setRecordingStream(null);

    chunksRef.current = [];

  };



  const reset = useCallback(() => {

    clearTick();

    teardownAudio();

    revokePreview();

    mergedRef.current = new Float32Array(0);

    rateRef.current = 48000;

    setPhase("idle");

    setElapsedMs(0);

    setError(null);

    setWavBlob(null);

    setLiveRms(0);
    setRecordingStream(null);

  }, []);



  const stopRecording = useCallback(() => {

    if (!processorRef.current) return;

    clearTick();

    const ctx = ctxRef.current;

    const captureRate = ctx?.sampleRate ?? 48000;

    const elapsed = performance.now() - startedAtRef.current;



    processorRef.current?.disconnect();

    sourceRef.current?.disconnect();

    processorRef.current = null;

    sourceRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());

    streamRef.current = null;



    const merged = mergeFloat32Chunks(chunksRef.current);

    chunksRef.current = [];

    void ctx?.close();

    ctxRef.current = null;



    setElapsedMs(Math.round(elapsed));



    if (elapsed < minMs) {

      mergedRef.current = new Float32Array(0);

      setError(`Record at least ${Math.round(minMs / 1000)} seconds to analyze.`);

      setPhase("idle");

      return;

    }



    if (merged.length < captureRate * 1) {

      mergedRef.current = new Float32Array(0);

      setError("Almost no audio captured — check your microphone.");

      setPhase("idle");

      return;

    }



    const wav = float32ToWavBlob(merged, captureRate);

    revokePreview();

    const url = URL.createObjectURL(wav);

    previewUrlRef.current = url;

    setPreviewUrl(url);

    setWavBlob(wav);



    setPhase("recorded");

    mergedRef.current = merged;

    rateRef.current = captureRate;

    setError(null);

  }, [minMs]);



  const startRecording = useCallback(async () => {

    setError(null);

    mergedRef.current = new Float32Array(0);

    teardownAudio();



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
      setRecordingStream(stream);

      const ctx = new AudioContext();

      await ctx.resume();

      ctxRef.current = ctx;

      chunksRef.current = [];



      const source = ctx.createMediaStreamSource(stream);

      sourceRef.current = source;

      const processor = ctx.createScriptProcessor(4096, 1, 1);

      processorRef.current = processor;



      processor.onaudioprocess = (ev) => {

        const input = ev.inputBuffer.getChannelData(0);

        const copy = new Float32Array(input.length);

        copy.set(input);

        chunksRef.current.push(copy);

        setLiveRms(computeRms(copy));

      };



      source.connect(processor);

      processor.connect(ctx.destination);



      startedAtRef.current = performance.now();

      setPhase("recording");

      tickRef.current = window.setInterval(() => {

        setElapsedMs(Math.round(performance.now() - startedAtRef.current));

      }, 320);

    } catch {

      setError("Microphone access was denied or unavailable.");

      setPhase("idle");

    }

  }, []);



  const getRecording = useCallback(

    (): { samples: Float32Array; sampleRate: number } => ({

      samples: mergedRef.current,

      sampleRate: rateRef.current,

    }),

    [],

  );



  return {

    phase,

    elapsedMs,

    error,

    wavBlob,

    previewUrl,

    liveRms,
    recordingStream,

    startRecording,

    stopRecording,

    reset,

    getRecording,

  };

}

