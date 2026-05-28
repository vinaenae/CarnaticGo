"use client";

import { useEffect, useRef, useState } from "react";

const POLL_MS = 300;
/** Voice must show a clear majority for this long before switching on/off. */
const STATE_CHANGE_MS = 3000;
/** ~3s of polls at POLL_MS (wall-clock span in a sliding window caps below 3s). */
const MIN_POLLS_FOR_MAJORITY = Math.round(STATE_CHANGE_MS / POLL_MS) + 1;
/** Avoid locking on one noisy mobile CREPE sample. */
const MIN_POLLS_FIRST_RATING = 3;
/** Consecutive agreeing polls flip status while already rated (~1.2s on mobile). */
const STREAK_POLLS_FOR_FLIP = 4;
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

    const recentWindowPolls = (now: number) =>
      pollsRef.current.filter((poll) => now - poll.at <= STATE_CHANGE_MS);

    const trailingStreakInTune = (polls: PitchPoll[]): boolean | null => {
      if (polls.length < STREAK_POLLS_FOR_FLIP) return null;
      const latest = polls[polls.length - 1]!.inTune;
      for (let i = polls.length - STREAK_POLLS_FOR_FLIP; i < polls.length; i++) {
        if (polls[i]!.inTune !== latest) return null;
      }
      return latest;
    };

    const rateFromRecentVoice = (
      windowPolls: PitchPoll[],
      minPolls: number,
    ): boolean => {
      if (windowPolls.length < minPolls) return false;

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
      setRated(inTuneRef.current ? "on" : "off");
      return true;
    };

    const tick = () => {
      const now = performance.now();

      if (hasPitchRef.current) {
        lastVoiceAtRef.current = now;
        pollsRef.current.push({ at: now, inTune: inTuneRef.current });
        pollsRef.current = pollsRef.current.filter(
          (poll) => now - poll.at <= STATE_CHANGE_MS * 2,
        );

        const windowPolls = recentWindowPolls(now);

        if (lastRatedRef.current === "listening") {
          if (!rateFromRecentVoice(windowPolls, MIN_POLLS_FIRST_RATING)) {
            holdRatedOrListening();
          }
          return;
        }

        const streakInTune = trailingStreakInTune(pollsRef.current);
        if (streakInTune !== null) {
          const next = streakInTune ? "on" : "off";
          if (next !== lastRatedRef.current) {
            setRated(next);
            return;
          }
        }

        if (!rateFromRecentVoice(windowPolls, MIN_POLLS_FOR_MAJORITY)) {
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
