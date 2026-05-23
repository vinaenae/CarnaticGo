"use client";

import { useEffect, useRef, useState } from "react";

const POLL_MS = 300;
/** Voice must show a clear majority for this long before switching on/off. */
const STATE_CHANGE_MS = 3000;
/** ~3s of polls at POLL_MS (wall-clock span in a sliding window caps below 3s). */
const MIN_POLLS_FOR_RATING = Math.round(STATE_CHANGE_MS / POLL_MS) + 1;
/** No voice this long → show Listening… again. */
export const SHRUTI_SILENCE_LISTENING_MS = 7000;

export type ShrutiDetectorStatus = "listening" | "on" | "off";

type PitchPoll = {
  at: number;
  inTune: boolean;
};

export function useWarmupShrutiDrift(opts: {
  /** Shruti detector is enabled on this screen. */
  active: boolean;
  /** Singing/noise with a detectable pitch. */
  hasPitch: boolean;
  inTune: boolean;
}) {
  const [status, setStatus] = useState<ShrutiDetectorStatus>("listening");

  const hasPitchRef = useRef(opts.hasPitch);
  const inTuneRef = useRef(opts.inTune);
  const pollsRef = useRef<PitchPoll[]>([]);
  const lastVoiceAtRef = useRef<number | null>(null);
  const lastRatedRef = useRef<ShrutiDetectorStatus>("listening");

  hasPitchRef.current = opts.hasPitch;
  inTuneRef.current = opts.inTune;

  useEffect(() => {
    if (!opts.active) {
      pollsRef.current = [];
      lastVoiceAtRef.current = null;
      lastRatedRef.current = "listening";
      setStatus("listening");
      return;
    }

    const resetToListening = () => {
      pollsRef.current = [];
      lastVoiceAtRef.current = null;
      lastRatedRef.current = "listening";
      setStatus("listening");
    };

    const setListening = () => {
      lastRatedRef.current = "listening";
      setStatus("listening");
    };

    const setRated = (next: "on" | "off") => {
      lastRatedRef.current = next;
      setStatus(next);
    };

    const holdRatedOrListening = () => {
      if (lastRatedRef.current === "on" || lastRatedRef.current === "off") {
        setStatus(lastRatedRef.current);
      } else {
        setListening();
      }
    };

    const rateFromRecentVoice = (now: number): boolean => {
      const windowPolls = pollsRef.current.filter((poll) => now - poll.at <= STATE_CHANGE_MS);
      if (windowPolls.length < MIN_POLLS_FOR_RATING) return false;

      const onCount = windowPolls.filter((poll) => poll.inTune).length;
      const offCount = windowPolls.length - onCount;

      if (onCount > offCount) {
        setRated("on");
        return true;
      }
      if (offCount > onCount) {
        setRated("off");
        return true;
      }
      return false;
    };

    const tick = () => {
      const now = performance.now();

      if (hasPitchRef.current) {
        lastVoiceAtRef.current = now;
        pollsRef.current.push({ at: now, inTune: inTuneRef.current });
        pollsRef.current = pollsRef.current.filter(
          (poll) => now - poll.at <= STATE_CHANGE_MS * 2,
        );

        if (lastRatedRef.current === "listening") {
          setRated(inTuneRef.current ? "on" : "off");
          return;
        }

        if (!rateFromRecentVoice(now)) {
          holdRatedOrListening();
        }
        return;
      }

      if (lastVoiceAtRef.current == null) {
        pollsRef.current = [];
        setListening();
        return;
      }

      if (now - lastVoiceAtRef.current >= SHRUTI_SILENCE_LISTENING_MS) {
        resetToListening();
        return;
      }

      holdRatedOrListening();
    };

    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [opts.active]);

  return { shrutiDetector: status };
}
