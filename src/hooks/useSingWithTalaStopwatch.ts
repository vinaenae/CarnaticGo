"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  readSingTalaActiveElapsedMs,
  writeSingTalaActiveElapsedMs,
} from "@/lib/sing-tala-active-session-storage";
import { SING_TALA_SILENCE_PAUSE_MS } from "@/lib/sing-tala-points";

const TICK_MS = 200;

export type SingWithTalaStopwatchState = {
  elapsedMs: number;
  paused: boolean;
  waitingToStart: boolean;
  getElapsedMs: () => number;
};

/**
 * Voice-active stopwatch for sing-with-tāla.
 * - Counts only after parent sets `armed` (user clicked start/continue).
 * - Pauses after 7s without singing; resumes when voice returns.
 */
export function useSingWithTalaStopwatch(
  sessionId: string,
  micActive: boolean,
  armed: boolean,
  voiceActive: boolean,
): SingWithTalaStopwatchState {
  const elapsedRef = useRef(0);
  const silenceMsRef = useRef(0);
  const voiceActiveRef = useRef(voiceActive);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [paused, setPaused] = useState(true);

  voiceActiveRef.current = voiceActive;

  useEffect(() => {
    elapsedRef.current = readSingTalaActiveElapsedMs(sessionId);
    setElapsedMs(elapsedRef.current);
    setPaused(true);
  }, [sessionId]);

  const persist = useCallback(() => {
    writeSingTalaActiveElapsedMs(sessionId, elapsedRef.current);
  }, [sessionId]);

  const waitingToStart = !armed;

  useEffect(() => {
    if (!micActive || !armed) {
      setPaused(true);
      silenceMsRef.current = 0;
      if (!micActive) persist();
      return;
    }

    const id = window.setInterval(() => {
      const voice = voiceActiveRef.current;

      if (voice) {
        silenceMsRef.current = 0;
        setPaused(false);
        elapsedRef.current += TICK_MS;
      } else {
        silenceMsRef.current += TICK_MS;
        const longSilence = silenceMsRef.current >= SING_TALA_SILENCE_PAUSE_MS;
        setPaused(longSilence);
        if (!longSilence) {
          elapsedRef.current += TICK_MS;
        }
      }

      setElapsedMs(elapsedRef.current);
    }, TICK_MS);

    return () => {
      window.clearInterval(id);
      persist();
    };
  }, [micActive, armed, persist]);

  useEffect(() => {
    return () => persist();
  }, [persist]);

  const getElapsedMs = useCallback(() => elapsedRef.current, []);

  return { elapsedMs, paused, waitingToStart, getElapsedMs };
}
