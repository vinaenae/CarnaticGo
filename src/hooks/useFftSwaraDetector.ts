"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioFrameListener } from "@/hooks/usePracticeSession";
import { boostSamplesForPitchAnalysis } from "@/lib/audio/decodeAudioBlob";
import { analyzeShrutiFftFrame } from "@/lib/shruti-fft-client";
import type { ShrutiFftFrameResult } from "@/types/shruti-fft";

const MIN_ANALYZE_GAP_MS = 110;

export type FftSwaraLiveState = {
  enabled: boolean;
  serviceOk: boolean | null;
  analyzing: boolean;
  lastError: string | null;
  result: ShrutiFftFrameResult | null;
};

export function useFftSwaraDetector(
  subscribeAudioFrame: (listener: AudioFrameListener) => () => void,
  ragaId: string | null,
  saHz: number,
  enabled: boolean,
) {
  const [state, setState] = useState<FftSwaraLiveState>({
    enabled: false,
    serviceOk: null,
    analyzing: false,
    lastError: null,
    result: null,
  });

  const inFlightRef = useRef(false);
  const lastAtRef = useRef(0);
  const ragaRef = useRef(ragaId);
  const saRef = useRef(saHz);
  ragaRef.current = ragaId;
  saRef.current = saHz;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/shruti-fft/health");
        if (!cancelled) {
          setState((s) => ({
            ...s,
            serviceOk: res.ok,
            lastError: res.ok
              ? null
              : "Start shruti-fft: uvicorn on port 8002 (services/shruti-fft/README.md).",
          }));
        }
      } catch {
        if (!cancelled) {
          setState((s) => ({ ...s, serviceOk: false, lastError: "Cannot reach shruti-fft service." }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onFrame = useCallback(
    (buffer: Float32Array, sampleRate: number) => {
      if (!enabled) return;
      const now = performance.now();
      if (now - lastAtRef.current < MIN_ANALYZE_GAP_MS || inFlightRef.current) return;
      lastAtRef.current = now;
      inFlightRef.current = true;
      setState((s) => ({ ...s, analyzing: true }));

      const boosted = boostSamplesForPitchAnalysis(buffer);
      void analyzeShrutiFftFrame(boosted, sampleRate, {
        ragaId: ragaRef.current,
        saHz: saRef.current,
      })
        .then((result) => {
          setState((s) => ({
            ...s,
            analyzing: false,
            lastError: null,
            serviceOk: true,
            result,
          }));
        })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : "FFT analysis failed";
          setState((s) => ({
            ...s,
            analyzing: false,
            lastError: msg.includes("503") ? "Start shruti-fft: see services/shruti-fft/README.md" : msg,
            serviceOk: false,
          }));
        })
        .finally(() => {
          inFlightRef.current = false;
        });
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) {
      setState((s) => ({ ...s, result: null, analyzing: false }));
      return;
    }
    return subscribeAudioFrame(onFrame);
  }, [enabled, onFrame, subscribeAudioFrame]);

  return { ...state, enabled };
}
